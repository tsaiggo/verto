// Library entry point for the Verto desktop shell.
//
// Tauri's recommended layout puts most of the runtime here so that the
// crate can also be linked into mobile targets later if needed. The
// binary in `main.rs` simply forwards to `run()`.

mod vault_watch;

use std::collections::HashSet;
use std::fs::{self, OpenOptions};
use std::io::{Read, Seek, SeekFrom, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};

use fs2::FileExt;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;
use vault_watch::{VaultWatchSession, VaultWatchState};

/// Result of scanning a candidate content folder for readable files. Mirrors
/// the `FolderInspection` shape consumed by the web UI (`lib/local-folder.ts`).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct FolderInspection {
    /// Whether the path exists on disk.
    exists: bool,
    /// Whether the path is a directory.
    is_dir: bool,
    /// Count of readable `.md` / `.mdx` files found beneath the folder.
    file_count: usize,
    /// A few sample relative paths, for a friendly preview.
    samples: Vec<String>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActiveLocalLibraryStatus {
    folder: Option<String>,
    available: bool,
    renderer_matches_active: bool,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct ActivatedLocalLibrary {
    folder: String,
    inspection: FolderInspection,
}

/// A readable file entry returned to the desktop webview for runtime Library
/// tree construction. Mirrors the TypeScript RawFileEntry shape.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct LocalFileEntry {
    /// Path relative to the selected folder, split into URL-safe segments by the
    /// frontend tree builder.
    path: Vec<String>,
    /// Opaque absolute path used if a later runtime reader needs raw content.
    id: String,
    /// Optional file size in bytes.
    size: Option<u64>,
    /// Modification time in milliseconds since epoch, when available.
    mtime: Option<u64>,
    /// SHA-256 content revision used to catch same-size, same-mtime rewrites.
    sha: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionedLocalFile {
    source: String,
    revision: String,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
enum LocalFileWriteOutcome {
    Saved {
        revision: String,
    },
    Conflict {
        #[serde(rename = "expectedRevision")]
        expected_revision: Option<String>,
        #[serde(rename = "actualRevision")]
        actual_revision: Option<String>,
    },
}

#[derive(Debug, PartialEq)]
enum RevisionWriteOutcome {
    Saved { revision: String },
    Conflict { actual_revision: Option<String> },
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum RecoveryClass {
    /// User-authored Markdown/MDX. On Unix, keep every displaced inode until
    /// the user explicitly reviews it because a pre-opened writer can modify
    /// that inode after the pathname exchange.
    UserDocument,
    /// High-frequency portable state. On Unix, successful saves follow the
    /// cooperative-writer contract documented at `finish_successful_displaced`:
    /// Verto and sync providers must publish through pathname replacement.
    PortableState,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
enum FailedReplacementPolicy {
    /// The replacement may contain the only recoverable copy of external data.
    Retain,
    /// The replacement is the caller's staged payload. Portable state already
    /// has a durable journal and a bounded conflict-sidecar path, so retaining
    /// this raw temporary would only create unbounded duplicate artifacts.
    DiscardKnownLocal,
}

impl RecoveryClass {
    fn staged_failure_policy(self) -> FailedReplacementPolicy {
        match self {
            Self::UserDocument => FailedReplacementPolicy::Retain,
            Self::PortableState => FailedReplacementPolicy::DiscardKnownLocal,
        }
    }
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct FileMetadataFingerprint {
    readonly: bool,
    #[cfg(unix)]
    mode: u32,
    #[cfg(windows)]
    attributes: u32,
}

#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct FileIdentity {
    #[cfg(unix)]
    device: u64,
    #[cfg(unix)]
    inode: u64,
    #[cfg(windows)]
    volume: u32,
    #[cfg(windows)]
    index: u64,
}

fn file_metadata_fingerprint(metadata: &fs::Metadata) -> FileMetadataFingerprint {
    #[cfg(unix)]
    use std::os::unix::fs::PermissionsExt;
    #[cfg(windows)]
    use std::os::windows::fs::MetadataExt;

    FileMetadataFingerprint {
        readonly: metadata.permissions().readonly(),
        #[cfg(unix)]
        mode: metadata.permissions().mode(),
        #[cfg(windows)]
        attributes: metadata.file_attributes(),
    }
}

#[cfg(windows)]
fn metadata_is_reparse_point(metadata: &fs::Metadata) -> bool {
    use std::os::windows::fs::MetadataExt;
    use windows_sys::Win32::Storage::FileSystem::FILE_ATTRIBUTE_REPARSE_POINT;

    metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0
}

#[cfg(not(windows))]
fn metadata_is_reparse_point(_metadata: &fs::Metadata) -> bool {
    false
}

#[cfg(unix)]
fn open_content_file_no_follow(path: &Path) -> std::io::Result<fs::File> {
    use std::os::unix::fs::OpenOptionsExt;

    OpenOptions::new()
        .read(true)
        // Bind the read to a regular file at the final component. O_NONBLOCK
        // prevents a raced FIFO from blocking before handle metadata rejects
        // it below.
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
        .open(path)
}

#[cfg(windows)]
fn open_content_file_no_follow(path: &Path) -> std::io::Result<fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_DELETE, FILE_SHARE_READ,
    };

    OpenOptions::new()
        .read(true)
        // Open a final-component reparse point itself so handle metadata can
        // reject it. Excluding write sharing prevents a same-length in-place
        // writer from producing a mixed snapshot, while delete sharing keeps
        // sync providers that publish by atomic pathname replacement working.
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_DELETE)
        .open(path)
}

fn consume_reader_at_limit<R: Read>(
    reader: &mut R,
    expected_size: u64,
    maximum_size: u64,
    mut consume: impl FnMut(&[u8]),
) -> Result<u64, ContentFileReadError> {
    if expected_size > maximum_size {
        return Err(ContentFileReadError::TooLarge);
    }

    let mut total = 0u64;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = reader
            .read(&mut buffer)
            .map_err(|error| ContentFileReadError::Io(format!("could not read file: {error}")))?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(read as u64)
            .ok_or(ContentFileReadError::TooLarge)?;
        if total > maximum_size {
            return Err(ContentFileReadError::TooLarge);
        }
        consume(&buffer[..read]);
    }

    if total != expected_size {
        return Err(ContentFileReadError::ChangedDuringRead);
    }
    Ok(total)
}

fn consume_bounded_reader<R: Read>(
    reader: &mut R,
    expected_size: u64,
    consume: impl FnMut(&[u8]),
) -> Result<u64, ContentFileReadError> {
    consume_reader_at_limit(reader, expected_size, MAX_CONTENT_FILE_BYTES, consume)
}

fn content_modified_millis(metadata: &fs::Metadata) -> Option<u64> {
    metadata
        .modified()
        .ok()
        .and_then(|time| time.duration_since(UNIX_EPOCH).ok())
        .and_then(|duration| u64::try_from(duration.as_millis()).ok())
}

#[cfg(test)]
fn consume_bounded_content_file_with_hook(
    path: &Path,
    consume: impl FnMut(&[u8]),
    between_passes: impl FnOnce(),
) -> Result<ContentFileFingerprint, ContentFileReadError> {
    let file = open_content_file_no_follow(path).map_err(|error| {
        ContentFileReadError::Io(format!("could not safely open content file: {error}"))
    })?;
    consume_bounded_open_content_file_with_hook(file, consume, between_passes)
}

fn consume_bounded_open_content_file_with_hook(
    mut file: fs::File,
    mut consume: impl FnMut(&[u8]),
    between_passes: impl FnOnce(),
) -> Result<ContentFileFingerprint, ContentFileReadError> {
    let before = file.metadata().map_err(|error| {
        ContentFileReadError::Io(format!("could not inspect content file: {error}"))
    })?;
    if metadata_is_reparse_point(&before) || !before.is_file() {
        return Err(ContentFileReadError::Unsafe(
            "selected content path must be a real file".to_string(),
        ));
    }
    if before.len() > MAX_CONTENT_FILE_BYTES {
        return Err(ContentFileReadError::TooLarge);
    }

    let before_modified = before.modified().ok();
    let mut first_digest = Sha256::new();
    let total = consume_bounded_reader(&mut file, before.len(), |chunk| {
        Digest::update(&mut first_digest, chunk);
        consume(chunk);
    })?;
    let after = file.metadata().map_err(|error| {
        ContentFileReadError::Io(format!(
            "could not re-inspect content file after reading: {error}"
        ))
    })?;
    if metadata_is_reparse_point(&after)
        || !after.is_file()
        || after.len() != before.len()
        || after.modified().ok() != before_modified
    {
        return Err(ContentFileReadError::ChangedDuringRead);
    }

    let first_sha = first_digest.finalize();
    between_passes();

    // Windows denies in-place writers for the lifetime of this handle. POSIX
    // cannot do that for an unrelated process, so verify a second streamed
    // fingerprint from the same inode. This catches same-length writes even on
    // filesystems whose modification timestamps are too coarse to change
    // during the first pass, without retaining a second content buffer.
    #[cfg(not(windows))]
    {
        file.seek(SeekFrom::Start(0)).map_err(|error| {
            ContentFileReadError::Io(format!(
                "could not rewind content file for verification: {error}"
            ))
        })?;
        let mut verification_digest = Sha256::new();
        consume_bounded_reader(&mut file, before.len(), |chunk| {
            Digest::update(&mut verification_digest, chunk);
        })?;
        let verified = file.metadata().map_err(|error| {
            ContentFileReadError::Io(format!(
                "could not re-inspect verified content file: {error}"
            ))
        })?;
        if metadata_is_reparse_point(&verified)
            || !verified.is_file()
            || verified.len() != before.len()
            || verified.modified().ok() != before_modified
            || verification_digest.finalize() != first_sha
        {
            return Err(ContentFileReadError::ChangedDuringRead);
        }
    }

    Ok(ContentFileFingerprint {
        size: total,
        mtime: content_modified_millis(&after),
        sha: format!("{first_sha:x}"),
    })
}

fn consume_confined_bounded_content_file(
    root: &Path,
    path: &Path,
    consume: impl FnMut(&[u8]),
) -> Result<ContentFileFingerprint, ContentFileReadError> {
    if !path.starts_with(root) {
        return Err(ContentFileReadError::Unsafe(
            "selected content path escaped the active Vault".to_string(),
        ));
    }
    let parent = path.parent().ok_or_else(|| {
        ContentFileReadError::Unsafe("selected content path has no parent".to_string())
    })?;
    let guard = DirectoryLineageGuard::for_parent(parent).map_err(ContentFileReadError::Unsafe)?;
    let file = open_bound_child(&guard, path, false).map_err(|error| {
        ContentFileReadError::Io(format!("could not safely open bound content file: {error}"))
    })?;
    let fingerprint = consume_bounded_open_content_file_with_hook(file, consume, || {})?;
    guard.validate().map_err(ContentFileReadError::Unsafe)?;
    Ok(fingerprint)
}

pub(crate) fn fingerprint_confined_content_file_bounded(
    root: &Path,
    path: &Path,
) -> Result<ContentFileFingerprint, ContentFileReadError> {
    consume_confined_bounded_content_file(root, path, |_| {})
}

fn read_confined_content_file_bounded(
    root: &Path,
    path: &Path,
) -> Result<String, ContentFileReadError> {
    let capacity = fs::symlink_metadata(path)
        .ok()
        .map(|metadata| metadata.len().min(MAX_CONTENT_FILE_BYTES))
        .and_then(|length| usize::try_from(length).ok())
        .unwrap_or(0);
    let mut bytes = Vec::with_capacity(capacity);
    consume_confined_bounded_content_file(root, path, |chunk| bytes.extend_from_slice(chunk))?;
    String::from_utf8(bytes).map_err(|error| {
        ContentFileReadError::Io(format!("Markdown/MDX file is not valid UTF-8: {error}"))
    })
}

#[cfg(unix)]
fn open_owner_marker_no_follow(path: &Path) -> std::io::Result<fs::File> {
    use std::os::unix::fs::OpenOptionsExt;

    OpenOptions::new()
        .read(true)
        // O_NOFOLLOW binds validation to the marker inode rather than a
        // pathname target. O_NONBLOCK prevents a raced FIFO from blocking the
        // caller before handle metadata can reject it.
        .custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK)
        .open(path)
}

#[cfg(windows)]
fn open_owner_marker_no_follow(path: &Path) -> std::io::Result<fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ};

    OpenOptions::new()
        .read(true)
        // Open the reparse point itself, then reject its handle metadata below.
        // Denying write/delete sharing also prevents pathname replacement while
        // the marker's bounded contents are being validated.
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .share_mode(FILE_SHARE_READ)
        .open(path)
}

fn validate_owner_marker(path: &Path, expected: &[u8], label: &str) -> Result<(), String> {
    let mut marker = open_owner_marker_no_follow(path)
        .map_err(|e| format!("could not safely open {label}: {e}"))?;
    let metadata = marker
        .metadata()
        .map_err(|e| format!("could not inspect {label}: {e}"))?;
    if metadata_is_reparse_point(&metadata) || !metadata.is_file() {
        return Err(format!("{label} must be a real file"));
    }
    if metadata.len() != expected.len() as u64 {
        return Err(format!("{label} is not recognized"));
    }

    let mut bytes = vec![0; expected.len()];
    marker
        .read_exact(&mut bytes)
        .map_err(|e| format!("could not read {label}: {e}"))?;
    let mut trailing = [0u8; 1];
    if marker
        .read(&mut trailing)
        .map_err(|e| format!("could not read {label}: {e}"))?
        != 0
        || bytes != expected
    {
        return Err(format!("{label} is not recognized"));
    }
    Ok(())
}

#[cfg(windows)]
fn file_identity(file: &fs::File) -> Result<FileIdentity, String> {
    use std::os::windows::io::AsRawHandle;
    use windows_sys::Win32::Storage::FileSystem::{
        GetFileInformationByHandle, BY_HANDLE_FILE_INFORMATION,
    };

    let mut information = unsafe { std::mem::zeroed::<BY_HANDLE_FILE_INFORMATION>() };
    let succeeded = unsafe {
        GetFileInformationByHandle(file.as_raw_handle() as _, &mut information as *mut _)
    };
    if succeeded == 0 {
        return Err(format!(
            "could not identify protected target: {}",
            std::io::Error::last_os_error()
        ));
    }
    Ok(FileIdentity {
        volume: information.dwVolumeSerialNumber,
        index: ((information.nFileIndexHigh as u64) << 32) | information.nFileIndexLow as u64,
    })
}

/// Pins every directory component used by a filesystem operation.
///
/// Windows directory handles deliberately deny delete sharing, so junction or
/// directory rename/replacement is impossible while the guard is alive. POSIX
/// directory handles do not prevent rename, so operations use the deepest
/// handle with `*at` syscalls and `validate()` rejects a moved/replaced
/// pathname before any remaining pathname-only recovery work.
struct DirectoryLineageGuard {
    paths: Vec<PathBuf>,
    identities: Vec<FileIdentity>,
    handles: Vec<fs::File>,
}

#[cfg(unix)]
fn open_directory_no_follow(path: &Path) -> std::io::Result<fs::File> {
    use std::os::unix::fs::OpenOptionsExt;

    OpenOptions::new()
        .read(true)
        .custom_flags(libc::O_DIRECTORY | libc::O_NOFOLLOW | libc::O_CLOEXEC)
        .open(path)
}

#[cfg(windows)]
fn open_directory_no_follow(path: &Path) -> std::io::Result<fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_BACKUP_SEMANTICS, FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ, FILE_SHARE_WRITE,
    };

    OpenOptions::new()
        .read(true)
        // Excluding FILE_SHARE_DELETE pins this directory component until the
        // guarded operation finishes. OPEN_REPARSE_POINT lets metadata reject
        // junctions and other reparse points instead of following them.
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
        .custom_flags(FILE_FLAG_BACKUP_SEMANTICS | FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
}

#[cfg(not(any(unix, windows)))]
fn open_directory_no_follow(path: &Path) -> std::io::Result<fs::File> {
    fs::File::open(path)
}

fn absolute_directory_lineage(parent: &Path) -> Result<Vec<PathBuf>, String> {
    if !parent.is_absolute() {
        return Err("guarded directory path must be absolute".to_string());
    }
    let mut paths = parent
        .ancestors()
        .map(Path::to_path_buf)
        .collect::<Vec<_>>();
    paths.reverse();
    if paths.is_empty() {
        return Err("guarded directory lineage is empty".to_string());
    }
    Ok(paths)
}

impl DirectoryLineageGuard {
    fn for_parent(parent: &Path) -> Result<Self, String> {
        let paths = absolute_directory_lineage(parent)?;
        let mut identities = Vec::with_capacity(paths.len());
        let mut handles = Vec::with_capacity(paths.len());
        for path in &paths {
            let handle = open_directory_no_follow(path).map_err(|error| {
                format!(
                    "could not bind guarded directory {}: {error}",
                    path.to_string_lossy()
                )
            })?;
            let metadata = handle.metadata().map_err(|error| {
                format!(
                    "could not inspect guarded directory {}: {error}",
                    path.to_string_lossy()
                )
            })?;
            if metadata_is_reparse_point(&metadata) || !metadata.is_dir() {
                return Err(format!(
                    "guarded directory component must be a real directory at {}",
                    path.to_string_lossy()
                ));
            }
            identities.push(file_identity(&handle)?);
            handles.push(handle);
        }
        let guard = Self {
            paths,
            identities,
            handles,
        };
        guard.validate()?;
        Ok(guard)
    }

    fn parent_path(&self) -> &Path {
        self.paths
            .last()
            .map(PathBuf::as_path)
            .expect("directory lineage always has a parent")
    }

    #[allow(dead_code)]
    fn parent_handle(&self) -> &fs::File {
        self.handles
            .last()
            .expect("directory lineage always has a parent handle")
    }

    fn validate(&self) -> Result<(), String> {
        for ((path, expected_identity), bound_handle) in
            self.paths.iter().zip(&self.identities).zip(&self.handles)
        {
            if file_identity(bound_handle)? != *expected_identity {
                return Err(format!(
                    "guarded directory handle changed identity at {}",
                    path.to_string_lossy()
                ));
            }
            let current = open_directory_no_follow(path).map_err(|error| {
                format!(
                    "guarded directory lineage moved or became unsafe at {}: {error}",
                    path.to_string_lossy()
                )
            })?;
            let metadata = current.metadata().map_err(|error| {
                format!(
                    "could not re-inspect guarded directory {}: {error}",
                    path.to_string_lossy()
                )
            })?;
            if metadata_is_reparse_point(&metadata)
                || !metadata.is_dir()
                || file_identity(&current)? != *expected_identity
            {
                return Err(format!(
                    "guarded directory lineage was replaced at {}",
                    path.to_string_lossy()
                ));
            }
        }
        Ok(())
    }

    fn validate_child_path<'a>(&self, path: &'a Path) -> Result<&'a std::ffi::OsStr, String> {
        if path.parent() != Some(self.parent_path()) {
            return Err("guarded file is not a direct child of the bound parent".to_string());
        }
        path.file_name()
            .ok_or_else(|| "guarded file path has no file name".to_string())
    }
}

#[cfg(unix)]
fn open_bound_child(
    guard: &DirectoryLineageGuard,
    path: &Path,
    write: bool,
) -> std::io::Result<fs::File> {
    use std::ffi::CString;
    use std::os::fd::{AsRawFd, FromRawFd};
    use std::os::unix::ffi::OsStrExt;

    let name = guard
        .validate_child_path(path)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidInput, error))?;
    let name = CString::new(name.as_bytes())
        .map_err(|_| std::io::Error::new(std::io::ErrorKind::InvalidInput, "NUL in file name"))?;
    let access = if write { libc::O_RDWR } else { libc::O_RDONLY };
    let descriptor = unsafe {
        libc::openat(
            guard.parent_handle().as_raw_fd(),
            name.as_ptr(),
            access | libc::O_NOFOLLOW | libc::O_NONBLOCK | libc::O_CLOEXEC,
        )
    };
    if descriptor < 0 {
        return Err(std::io::Error::last_os_error());
    }
    Ok(unsafe { fs::File::from_raw_fd(descriptor) })
}

#[cfg(windows)]
fn open_bound_identity_child(
    guard: &DirectoryLineageGuard,
    path: &Path,
) -> std::io::Result<fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
    };

    guard
        .validate_child_path(path)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidInput, error))?;
    OpenOptions::new()
        .read(true)
        .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .open(path)
}

#[cfg(not(windows))]
fn open_bound_identity_child(
    guard: &DirectoryLineageGuard,
    path: &Path,
) -> std::io::Result<fs::File> {
    open_bound_child(guard, path, false)
}

#[cfg(windows)]
fn open_bound_child(
    guard: &DirectoryLineageGuard,
    path: &Path,
    write: bool,
) -> std::io::Result<fs::File> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{
        FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_DELETE, FILE_SHARE_READ,
    };

    guard
        .validate_child_path(path)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidInput, error))?;
    if write {
        OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(FILE_SHARE_READ)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(path)
    } else {
        OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_DELETE)
            .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
            .open(path)
    }
}

#[cfg(not(any(unix, windows)))]
fn open_bound_child(
    guard: &DirectoryLineageGuard,
    path: &Path,
    write: bool,
) -> std::io::Result<fs::File> {
    guard
        .validate_child_path(path)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidInput, error))?;
    OpenOptions::new().read(true).write(write).open(path)
}

#[cfg(unix)]
fn file_identity(file: &fs::File) -> Result<FileIdentity, String> {
    use std::os::unix::fs::MetadataExt;

    let metadata = file
        .metadata()
        .map_err(|e| format!("could not identify protected target: {e}"))?;
    Ok(FileIdentity {
        device: metadata.dev(),
        inode: metadata.ino(),
    })
}

#[cfg(windows)]
fn open_committed_target(path: &Path) -> Result<fs::File, String> {
    use std::os::windows::fs::OpenOptionsExt;
    use windows_sys::Win32::Storage::FileSystem::{FILE_FLAG_OPEN_REPARSE_POINT, FILE_SHARE_READ};

    OpenOptions::new()
        .read(true)
        .write(true)
        // Publishing is finished. Excluding both write and delete sharing
        // protects the new canonical inode and pathname until durable
        // verification completes.
        .custom_flags(FILE_FLAG_OPEN_REPARSE_POINT)
        .share_mode(FILE_SHARE_READ)
        .open(path)
        .map_err(|e| format!("could not protect the committed target: {e}"))
}

#[cfg(not(windows))]
fn open_committed_target(path: &Path) -> Result<fs::File, String> {
    #[cfg(unix)]
    use std::os::unix::fs::OpenOptionsExt;

    let mut options = OpenOptions::new();
    options.read(true).write(true);
    #[cfg(unix)]
    options.custom_flags(libc::O_NOFOLLOW | libc::O_NONBLOCK);
    options
        .open(path)
        .map_err(|e| format!("could not open the committed target: {e}"))
}

fn path_file_identity(path: &Path) -> Result<Option<FileIdentity>, String> {
    match fs::File::open(path) {
        Ok(file) => file_identity(&file).map(Some),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "could not identify the canonical pathname: {error}"
        )),
    }
}

#[allow(dead_code)]
fn protect_published_replacement(
    path: &Path,
    expected_identity: FileIdentity,
) -> Result<(fs::File, bool), String> {
    let file = open_committed_target(path)?;
    let guarded_identity = file_identity(&file)?;
    let still_canonical = guarded_identity == expected_identity
        && path_file_identity(path)? == Some(guarded_identity);
    Ok((file, still_canonical))
}

struct ProtectedFileSnapshot {
    revision: String,
    size: u64,
    metadata: FileMetadataFingerprint,
    identity: FileIdentity,
}

fn recovery_read_limit(recovery_class: RecoveryClass) -> u64 {
    match recovery_class {
        RecoveryClass::UserDocument => MAX_CONTENT_FILE_BYTES,
        RecoveryClass::PortableState => MAX_STATE_BYTES as u64,
    }
}

fn bounded_revision_pass(
    file: &mut fs::File,
    expected_size: u64,
    max_bytes: u64,
) -> Result<String, String> {
    if expected_size > max_bytes {
        return Err(format!(
            "file is {expected_size} bytes and exceeds the save safety limit of {max_bytes} bytes"
        ));
    }
    file.seek(SeekFrom::Start(0))
        .map_err(|error| format!("could not rewind protected file: {error}"))?;
    let mut digest = Sha256::new();
    let mut total = 0u64;
    let mut buffer = [0u8; 64 * 1024];
    loop {
        let read = file
            .read(&mut buffer)
            .map_err(|error| format!("could not read protected file: {error}"))?;
        if read == 0 {
            break;
        }
        total = total
            .checked_add(read as u64)
            .ok_or_else(|| "protected file size overflowed while reading".to_string())?;
        if total > max_bytes {
            return Err(format!(
                "file grew beyond the save safety limit of {max_bytes} bytes while it was being read"
            ));
        }
        Digest::update(&mut digest, &buffer[..read]);
    }
    if total != expected_size {
        return Err("protected file changed size while it was being read".to_string());
    }
    Ok(format!("{:x}", digest.finalize()))
}

fn bounded_open_file_snapshot(
    file: &mut fs::File,
    max_bytes: u64,
) -> Result<(String, u64, FileMetadataFingerprint), String> {
    let before = file
        .metadata()
        .map_err(|error| format!("could not inspect protected file metadata: {error}"))?;
    if metadata_is_reparse_point(&before) || !before.is_file() {
        return Err("protected path must remain a real file".to_string());
    }
    if before.len() > max_bytes {
        return Err(format!(
            "file is {} bytes and exceeds the save safety limit of {max_bytes} bytes",
            before.len()
        ));
    }
    let before_fingerprint = file_metadata_fingerprint(&before);
    let before_modified = before.modified().ok();
    let revision = bounded_revision_pass(file, before.len(), max_bytes)?;
    let after = file
        .metadata()
        .map_err(|error| format!("could not re-inspect protected file: {error}"))?;
    if metadata_is_reparse_point(&after)
        || !after.is_file()
        || after.len() != before.len()
        || after.modified().ok() != before_modified
        || file_metadata_fingerprint(&after) != before_fingerprint
    {
        return Err("protected file changed while it was being read".to_string());
    }

    // Windows protected/committed handles deny write sharing. POSIX cannot
    // exclude an unrelated in-place writer, so require two identical streamed
    // fingerprints from the same opened inode.
    #[cfg(not(windows))]
    {
        let verified_revision = bounded_revision_pass(file, before.len(), max_bytes)?;
        let verified = file
            .metadata()
            .map_err(|error| format!("could not inspect verified protected file: {error}"))?;
        if verified_revision != revision
            || metadata_is_reparse_point(&verified)
            || !verified.is_file()
            || verified.len() != before.len()
            || verified.modified().ok() != before_modified
            || file_metadata_fingerprint(&verified) != before_fingerprint
        {
            return Err("protected file changed while it was being verified".to_string());
        }
    }

    Ok((revision, before.len(), before_fingerprint))
}

fn read_protected_snapshot(
    file: &mut fs::File,
    recovery_class: RecoveryClass,
) -> Result<ProtectedFileSnapshot, String> {
    let (revision, size, metadata) =
        bounded_open_file_snapshot(file, recovery_read_limit(recovery_class))?;
    Ok(ProtectedFileSnapshot {
        revision,
        size,
        metadata,
        identity: file_identity(file)?,
    })
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(rename_all = "camelCase")]
struct VersionedVaultState {
    json: Option<String>,
    revision: Option<String>,
}

#[derive(Debug, PartialEq, Serialize)]
#[serde(tag = "status", rename_all = "camelCase")]
enum VaultStateWriteOutcome {
    Saved {
        revision: String,
    },
    Conflict {
        #[serde(rename = "expectedRevision")]
        expected_revision: Option<String>,
        #[serde(rename = "actualRevision")]
        actual_revision: Option<String>,
        #[serde(rename = "conflictPath")]
        conflict_path: Option<String>,
        #[serde(rename = "preservationError")]
        preservation_error: Option<String>,
    },
}

/// Number of sample paths surfaced for a friendly preview.
const INSPECT_SAMPLE_LIMIT: usize = 5;
const AUTHORIZED_ROOTS_VERSION: u8 = 1;
const MAX_AUTHORIZED_ROOTS: usize = 8;
pub(crate) const MAX_CONTENT_FILE_BYTES: u64 = 32 * 1024 * 1024;
const MAX_STATE_BYTES: usize = 8 * 1024 * 1024;
const MAX_STATE_CONFLICTS_PER_WRITER: usize = 5;
const MAX_STATE_CONFLICTS_PER_VAULT: usize = 64;
const MAX_STATE_CONFLICT_BYTES_PER_VAULT: u64 = 512 * 1024 * 1024;
const CONFLICT_DIRECTORY_MARKER: &str = ".verto-owner";
const CONFLICT_DIRECTORY_MARKER_CONTENT: &[u8] = b"verto-state-conflicts-v1\n";

#[derive(Debug, PartialEq, Eq)]
pub(crate) enum ContentFileReadError {
    TooLarge,
    ChangedDuringRead,
    Unsafe(String),
    Io(String),
}

impl std::fmt::Display for ContentFileReadError {
    fn fmt(&self, formatter: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            Self::TooLarge => write!(
                formatter,
                "file exceeds the {} MiB Markdown/MDX content limit",
                MAX_CONTENT_FILE_BYTES / (1024 * 1024)
            ),
            Self::ChangedDuringRead => {
                write!(formatter, "file changed while it was being read; try again")
            }
            Self::Unsafe(message) | Self::Io(message) => formatter.write_str(message),
        }
    }
}

#[derive(Debug)]
pub(crate) struct ContentFileFingerprint {
    pub size: u64,
    pub mtime: Option<u64>,
    pub sha: String,
}

#[derive(Clone, Deserialize, Serialize)]
struct AuthorizedRootsFile {
    version: u8,
    active: Option<PathBuf>,
    recent: Vec<PathBuf>,
}

impl Default for AuthorizedRootsFile {
    fn default() -> Self {
        Self {
            version: AUTHORIZED_ROOTS_VERSION,
            active: None,
            recent: Vec::new(),
        }
    }
}

struct AuthorizedRoots {
    file: PathBuf,
    inner: Mutex<AuthorizedRootsFile>,
}

fn atomic_write(path: &Path, content: &[u8]) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "target path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("could not create parent directory: {e}"))?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("could not create temporary file: {e}"))?;
    temp.write_all(content)
        .map_err(|e| format!("could not write temporary file: {e}"))?;
    temp.as_file()
        .sync_all()
        .map_err(|e| format!("could not sync temporary file: {e}"))?;
    temp.persist(path)
        .map_err(|e| format!("could not replace target file: {}", e.error))?;
    let expected_revision = content_revision(content);
    let actual_revision = sync_and_verify_committed_revision(path, MAX_STATE_BYTES as u64)?;
    if actual_revision.as_deref() == Some(expected_revision.as_str()) {
        Ok(())
    } else {
        Err(format!(
            "another writer replaced the file before the durable commit completed (expected {expected_revision}, found {})",
            actual_revision.as_deref().unwrap_or("missing")
        ))
    }
}

/// Atomically replace user-authored Markdown without silently changing its
/// existing mode or bypassing an explicit read-only flag. State and registry
/// files intentionally keep `atomic_write`'s private temporary-file defaults.
#[cfg(test)]
fn atomic_write_markdown(path: &Path, content: &[u8]) -> Result<(), String> {
    let existing_permissions = match fs::metadata(path) {
        Ok(metadata) => {
            let permissions = metadata.permissions();
            if permissions.readonly() {
                return Err("read-only Markdown files cannot be replaced".to_string());
            }
            Some(permissions)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => None,
        Err(error) => return Err(format!("could not inspect Markdown permissions: {error}")),
    };
    let parent = path
        .parent()
        .ok_or_else(|| "target path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("could not create parent directory: {e}"))?;
    let mut temp = tempfile::NamedTempFile::new_in(parent)
        .map_err(|e| format!("could not create temporary file: {e}"))?;
    if let Some(permissions) = existing_permissions {
        temp.as_file()
            .set_permissions(permissions)
            .map_err(|e| format!("could not preserve Markdown permissions: {e}"))?;
    }
    temp.write_all(content)
        .map_err(|e| format!("could not write temporary file: {e}"))?;
    temp.as_file()
        .sync_all()
        .map_err(|e| format!("could not sync temporary file: {e}"))?;
    temp.persist(path)
        .map_err(|e| format!("could not replace target file: {}", e.error))?;
    Ok(())
}

struct PreparedReplacement {
    path: tempfile::TempPath,
    identity: FileIdentity,
}

static NEXT_BOUND_TEMP: AtomicU64 = AtomicU64::new(0);

#[cfg(unix)]
fn create_bound_temp_file(
    guard: &DirectoryLineageGuard,
    path: &Path,
) -> std::io::Result<(fs::File, tempfile::TempPath)> {
    use std::ffi::CString;
    use std::os::fd::{AsRawFd, FromRawFd};
    use std::os::unix::ffi::OsStrExt;

    guard
        .validate_child_path(path)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidInput, error))?;
    let name = path
        .file_name()
        .ok_or_else(|| std::io::Error::other("temporary path has no file name"))?;
    let name = CString::new(name.as_bytes()).map_err(|_| {
        std::io::Error::new(
            std::io::ErrorKind::InvalidInput,
            "NUL in temporary file name",
        )
    })?;
    let descriptor = unsafe {
        libc::openat(
            guard.parent_handle().as_raw_fd(),
            name.as_ptr(),
            libc::O_RDWR | libc::O_CREAT | libc::O_EXCL | libc::O_NOFOLLOW | libc::O_CLOEXEC,
            0o600,
        )
    };
    if descriptor < 0 {
        return Err(std::io::Error::last_os_error());
    }
    let file = unsafe { fs::File::from_raw_fd(descriptor) };
    let temp_path = tempfile::TempPath::try_from_path(path)?;
    Ok((file, temp_path))
}

#[cfg(not(unix))]
fn create_bound_temp_file(
    guard: &DirectoryLineageGuard,
    path: &Path,
) -> std::io::Result<(fs::File, tempfile::TempPath)> {
    guard
        .validate_child_path(path)
        .map_err(|error| std::io::Error::new(std::io::ErrorKind::InvalidInput, error))?;
    let file = OpenOptions::new()
        .create_new(true)
        .read(true)
        .write(true)
        .open(path)?;
    let temp_path = tempfile::TempPath::try_from_path(path)?;
    Ok((file, temp_path))
}

fn prepared_bound_temp_path(
    guard: &DirectoryLineageGuard,
    content: &[u8],
    permissions: Option<fs::Permissions>,
) -> Result<PreparedReplacement, String> {
    guard.validate()?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is before the Unix epoch".to_string())?
        .as_nanos();
    for attempt in 0..64u8 {
        let sequence = NEXT_BOUND_TEMP.fetch_add(1, Ordering::Relaxed);
        let path = guard.parent_path().join(format!(
            ".verto-write-{}-{timestamp:x}-{sequence:x}-{attempt:02}",
            std::process::id()
        ));
        let (mut file, mut temp_path) = match create_bound_temp_file(guard, &path) {
            Ok(result) => result,
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => continue,
            Err(error) => {
                return Err(format!(
                    "could not create guarded temporary file in {}: {error}",
                    guard.parent_path().to_string_lossy()
                ))
            }
        };
        if let Some(permissions) = permissions {
            if let Err(error) = file.set_permissions(permissions) {
                temp_path.disable_cleanup(true);
                return Err(format!(
                    "could not preserve guarded temporary permissions: {error}; raw temporary retained at {}",
                    path.to_string_lossy()
                ));
            }
        }
        if let Err(error) = file.write_all(content).and_then(|()| file.sync_all()) {
            temp_path.disable_cleanup(true);
            return Err(format!(
                "could not durably stage guarded temporary file: {error}; raw temporary retained at {}",
                path.to_string_lossy()
            ));
        }
        let identity = match file_identity(&file) {
            Ok(identity) => identity,
            Err(error) => {
                temp_path.disable_cleanup(true);
                return Err(format!(
                    "could not identify guarded temporary file: {error}; raw temporary retained at {}",
                    path.to_string_lossy()
                ));
            }
        };
        return Ok(PreparedReplacement {
            path: temp_path,
            identity,
        });
    }
    Err("could not reserve a unique guarded temporary file after 64 attempts".to_string())
}

fn prepared_temp_path_in(
    parent: &Path,
    content: &[u8],
    permissions: Option<fs::Permissions>,
) -> Result<PreparedReplacement, String> {
    let mut temp = tempfile::Builder::new()
        .prefix(".verto-write-")
        .tempfile_in(parent)
        .map_err(|e| format!("could not create temporary file: {e}"))?;
    if let Some(permissions) = permissions {
        temp.as_file()
            .set_permissions(permissions)
            .map_err(|e| format!("could not preserve file permissions: {e}"))?;
    }
    temp.write_all(content)
        .map_err(|e| format!("could not write temporary file: {e}"))?;
    temp.as_file()
        .sync_all()
        .map_err(|e| format!("could not sync temporary file: {e}"))?;
    let identity = file_identity(temp.as_file())
        .map_err(|e| format!("could not inspect prepared temporary file: {e}"))?;
    Ok(PreparedReplacement {
        path: temp.into_temp_path(),
        identity,
    })
}

#[allow(dead_code)]
fn prepared_temp_path(
    path: &Path,
    content: &[u8],
    permissions: Option<fs::Permissions>,
) -> Result<PreparedReplacement, String> {
    let parent = path
        .parent()
        .ok_or_else(|| "target path has no parent directory".to_string())?;
    fs::create_dir_all(parent).map_err(|e| format!("could not create parent directory: {e}"))?;
    prepared_temp_path_in(parent, content, permissions)
}

struct FailedNoClobberPublish {
    path: tempfile::TempPath,
    error: std::io::Error,
}

#[cfg(not(windows))]
fn publish_sidecar_noclobber(
    replacement: tempfile::TempPath,
    destination: &Path,
) -> Result<(), FailedNoClobberPublish> {
    replacement
        .persist_noclobber(destination)
        .map_err(|error| FailedNoClobberPublish {
            path: error.path,
            error: error.error,
        })
}

#[cfg(windows)]
fn publish_sidecar_noclobber(
    replacement: tempfile::TempPath,
    destination: &Path,
) -> Result<(), FailedNoClobberPublish> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileExW, MOVEFILE_WRITE_THROUGH};

    let replacement_wide = replacement
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let destination_wide = destination
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    // Omitting MOVEFILE_REPLACE_EXISTING preserves no-clobber semantics.
    // MOVEFILE_WRITE_THROUGH asks Windows not to acknowledge publication until
    // the move has reached the filesystem.
    let moved = unsafe {
        MoveFileExW(
            replacement_wide.as_ptr(),
            destination_wide.as_ptr(),
            MOVEFILE_WRITE_THROUGH,
        )
    };
    if moved == 0 {
        return Err(FailedNoClobberPublish {
            path: replacement,
            error: std::io::Error::last_os_error(),
        });
    }
    drop(replacement);
    Ok(())
}

#[cfg(any(target_os = "linux", target_os = "android"))]
fn publish_bound_noclobber(
    guard: &DirectoryLineageGuard,
    mut replacement: tempfile::TempPath,
    destination: &Path,
) -> Result<(), FailedNoClobberPublish> {
    use std::ffi::CString;
    use std::os::fd::AsRawFd;
    use std::os::unix::ffi::OsStrExt;

    if let Err(error) = guard.validate() {
        replacement.disable_cleanup(true);
        return Err(FailedNoClobberPublish {
            path: replacement,
            error: std::io::Error::other(error),
        });
    }
    let source = match guard.validate_child_path(&replacement) {
        Ok(name) => name,
        Err(error) => {
            replacement.disable_cleanup(true);
            return Err(FailedNoClobberPublish {
                path: replacement,
                error: std::io::Error::other(error),
            });
        }
    };
    let target = match guard.validate_child_path(destination) {
        Ok(name) => name,
        Err(error) => {
            replacement.disable_cleanup(true);
            return Err(FailedNoClobberPublish {
                path: replacement,
                error: std::io::Error::other(error),
            });
        }
    };
    let source = match CString::new(source.as_bytes()) {
        Ok(name) => name,
        Err(_) => {
            replacement.disable_cleanup(true);
            return Err(FailedNoClobberPublish {
                path: replacement,
                error: std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "NUL in guarded temporary file name",
                ),
            });
        }
    };
    let target = match CString::new(target.as_bytes()) {
        Ok(name) => name,
        Err(_) => {
            replacement.disable_cleanup(true);
            return Err(FailedNoClobberPublish {
                path: replacement,
                error: std::io::Error::new(
                    std::io::ErrorKind::InvalidInput,
                    "NUL in guarded target file name",
                ),
            });
        }
    };
    let renamed = unsafe {
        libc::renameat2(
            guard.parent_handle().as_raw_fd(),
            source.as_ptr(),
            guard.parent_handle().as_raw_fd(),
            target.as_ptr(),
            libc::RENAME_NOREPLACE,
        )
    };
    if renamed != 0 {
        return Err(FailedNoClobberPublish {
            path: replacement,
            error: std::io::Error::last_os_error(),
        });
    }
    // The source pathname no longer exists in the bound directory. Never let
    // TempPath follow a concurrently repurposed textual ancestor on drop.
    replacement.disable_cleanup(true);
    drop(replacement);
    Ok(())
}

#[cfg(target_vendor = "apple")]
fn publish_bound_noclobber(
    guard: &DirectoryLineageGuard,
    mut replacement: tempfile::TempPath,
    destination: &Path,
) -> Result<(), FailedNoClobberPublish> {
    use std::ffi::CString;
    use std::os::fd::AsRawFd;
    use std::os::unix::ffi::OsStrExt;

    if let Err(error) = guard.validate() {
        replacement.disable_cleanup(true);
        return Err(FailedNoClobberPublish {
            path: replacement,
            error: std::io::Error::other(error),
        });
    }
    let source = guard.validate_child_path(&replacement).and_then(|name| {
        CString::new(name.as_bytes()).map_err(|_| "NUL in guarded temporary file name".to_string())
    });
    let target = guard.validate_child_path(destination).and_then(|name| {
        CString::new(name.as_bytes()).map_err(|_| "NUL in guarded target file name".to_string())
    });
    let (source, target) = match (source, target) {
        (Ok(source), Ok(target)) => (source, target),
        (Err(error), _) | (_, Err(error)) => {
            replacement.disable_cleanup(true);
            return Err(FailedNoClobberPublish {
                path: replacement,
                error: std::io::Error::other(error),
            });
        }
    };
    let renamed = unsafe {
        libc::renameatx_np(
            guard.parent_handle().as_raw_fd(),
            source.as_ptr(),
            guard.parent_handle().as_raw_fd(),
            target.as_ptr(),
            libc::RENAME_EXCL,
        )
    };
    if renamed != 0 {
        return Err(FailedNoClobberPublish {
            path: replacement,
            error: std::io::Error::last_os_error(),
        });
    }
    replacement.disable_cleanup(true);
    drop(replacement);
    Ok(())
}

#[cfg(windows)]
fn publish_bound_noclobber(
    guard: &DirectoryLineageGuard,
    replacement: tempfile::TempPath,
    destination: &Path,
) -> Result<(), FailedNoClobberPublish> {
    if let Err(error) = guard.validate() {
        let mut replacement = replacement;
        replacement.disable_cleanup(true);
        return Err(FailedNoClobberPublish {
            path: replacement,
            error: std::io::Error::other(error),
        });
    }
    publish_sidecar_noclobber(replacement, destination)
}

#[cfg(not(any(unix, windows)))]
fn publish_bound_noclobber(
    guard: &DirectoryLineageGuard,
    replacement: tempfile::TempPath,
    destination: &Path,
) -> Result<(), FailedNoClobberPublish> {
    let _ = guard;
    publish_sidecar_noclobber(replacement, destination)
}

#[cfg(windows)]
fn vacant_temp_path(parent: &Path) -> Result<tempfile::TempPath, String> {
    let path = tempfile::Builder::new()
        .prefix(".verto-displaced-")
        .tempfile_in(parent)
        .map_err(|e| format!("could not reserve displaced-file path: {e}"))?
        .into_temp_path();
    fs::remove_file(&path).map_err(|e| format!("could not prepare displaced-file path: {e}"))?;
    Ok(path)
}

fn retain_failed_temporaries(context: &str, paths: Vec<tempfile::TempPath>) -> String {
    let mut retained = Vec::new();
    for mut path in paths {
        if !path.exists() {
            continue;
        }
        let retained_path = path.to_path_buf();
        // TempPath::keep normalizes Windows file attributes. A failed
        // ReplaceFileW backup may be the user's exact external version, so
        // disable cleanup without mutating the file instead.
        path.disable_cleanup(true);
        retained.push(retained_path.to_string_lossy().into_owned());
    }

    let mut message = context.to_string();
    if !retained.is_empty() {
        message.push_str("; recoverable temporary copies were retained at ");
        message.push_str(&retained.join(", "));
    }
    message
}

fn retain_displaced_failure(context: &str, mut path: tempfile::TempPath) -> String {
    let retained_path = path.to_path_buf();
    // Surface the raw pathname even when the triggering error also prevents an
    // existence check. Cleanup remains disabled, so Verto will never unlink a
    // potentially unique displaced version while reporting the failure.
    path.disable_cleanup(true);
    format!(
        "{context}; raw displaced temporary path was retained at {}",
        retained_path.to_string_lossy()
    )
}

fn handle_failed_replacement(
    context: &str,
    replacement: tempfile::TempPath,
    replacement_policy: FailedReplacementPolicy,
    mut ambiguous_paths: Vec<tempfile::TempPath>,
) -> String {
    match replacement_policy {
        FailedReplacementPolicy::Retain => ambiguous_paths.insert(0, replacement),
        FailedReplacementPolicy::DiscardKnownLocal => drop(replacement),
    }
    retain_failed_temporaries(context, ambiguous_paths)
}

/// Atomically replace an existing target while keeping the exact file that
/// occupied the target name at the replacement instant.
///
/// Windows `ReplaceFileW` creates the displaced backup in the same operation.
/// Linux and Apple platforms exchange the prepared temporary path and target,
/// so the temporary path becomes the displaced copy. If a supported platform
/// cannot provide that primitive, the save fails without deliberately falling
/// back to a lossy compare-then-rename sequence.
#[cfg(windows)]
fn replace_existing_capturing(
    guard: &DirectoryLineageGuard,
    target: &Path,
    replacement: tempfile::TempPath,
    replacement_policy: FailedReplacementPolicy,
) -> Result<tempfile::TempPath, String> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{MoveFileW, ReplaceFileW};

    guard.validate()?;
    guard.validate_child_path(target)?;
    let parent = guard.parent_path();
    let backup = match vacant_temp_path(parent) {
        Ok(path) => path,
        Err(error) => {
            return Err(handle_failed_replacement(
                &error,
                replacement,
                replacement_policy,
                Vec::new(),
            ))
        }
    };
    let target_wide = target
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let replacement_wide = replacement
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let backup_wide = backup
        .as_os_str()
        .encode_wide()
        .chain(std::iter::once(0))
        .collect::<Vec<_>>();
    let replaced = unsafe {
        ReplaceFileW(
            target_wide.as_ptr(),
            replacement_wide.as_ptr(),
            backup_wide.as_ptr(),
            0,
            std::ptr::null(),
            std::ptr::null(),
        )
    };
    if replaced == 0 {
        let error = std::io::Error::last_os_error();
        let mut candidates = Vec::new();
        let target_missing = matches!(
            fs::symlink_metadata(target),
            Err(error) if error.kind() == std::io::ErrorKind::NotFound
        );
        if target_missing && backup.exists() {
            // ERROR_UNABLE_TO_MOVE_REPLACEMENT_2 may move the original to the
            // requested backup even though ReplaceFileW reports failure. Put
            // it back only if the canonical name is still empty; a new writer
            // that appeared meanwhile must win.
            let restored = unsafe { MoveFileW(backup_wide.as_ptr(), target_wide.as_ptr()) };
            if restored == 0 {
                candidates.push(backup);
            } else {
                drop(backup);
            }
        } else if backup.exists() {
            candidates.push(backup);
        }
        return Err(handle_failed_replacement(
            &format!("could not atomically replace target file: {error}"),
            replacement,
            replacement_policy,
            candidates,
        ));
    }
    drop(replacement);
    Ok(backup)
}

#[cfg(any(target_os = "linux", target_os = "android"))]
fn replace_existing_capturing(
    guard: &DirectoryLineageGuard,
    target: &Path,
    mut replacement: tempfile::TempPath,
    replacement_policy: FailedReplacementPolicy,
) -> Result<tempfile::TempPath, String> {
    use std::ffi::CString;
    use std::os::fd::AsRawFd;
    use std::os::unix::ffi::OsStrExt;

    guard.validate()?;
    let target_name = guard.validate_child_path(target)?;
    let replacement_name = guard.validate_child_path(&replacement)?;
    let target_path = CString::new(target_name.as_bytes())
        .map_err(|_| "target file name contains a NUL byte".to_string())?;
    let replacement_path = CString::new(replacement_name.as_bytes())
        .map_err(|_| "replacement file name contains a NUL byte".to_string())?;
    let exchanged = unsafe {
        libc::renameat2(
            guard.parent_handle().as_raw_fd(),
            replacement_path.as_ptr(),
            guard.parent_handle().as_raw_fd(),
            target_path.as_ptr(),
            libc::RENAME_EXCHANGE,
        )
    };
    if exchanged != 0 {
        let error = std::io::Error::last_os_error();
        if let Err(lineage_error) = guard.validate() {
            replacement.disable_cleanup(true);
            return Err(format!(
                "could not atomically exchange target file: {error}; \
                 the parent directory lineage also changed: {lineage_error}; \
                 automatic staging-file cleanup was disabled because its pathname is no longer trustworthy"
            ));
        }
        return Err(handle_failed_replacement(
            &format!("could not atomically exchange target file: {error}"),
            replacement,
            replacement_policy,
            Vec::new(),
        ));
    }
    Ok(replacement)
}

#[cfg(target_vendor = "apple")]
fn replace_existing_capturing(
    guard: &DirectoryLineageGuard,
    target: &Path,
    mut replacement: tempfile::TempPath,
    replacement_policy: FailedReplacementPolicy,
) -> Result<tempfile::TempPath, String> {
    use std::ffi::CString;
    use std::os::fd::AsRawFd;
    use std::os::unix::ffi::OsStrExt;

    guard.validate()?;
    let target_name = guard.validate_child_path(target)?;
    let replacement_name = guard.validate_child_path(&replacement)?;
    let target_path = CString::new(target_name.as_bytes())
        .map_err(|_| "target file name contains a NUL byte".to_string())?;
    let replacement_path = CString::new(replacement_name.as_bytes())
        .map_err(|_| "replacement file name contains a NUL byte".to_string())?;
    let exchanged = unsafe {
        libc::renameatx_np(
            guard.parent_handle().as_raw_fd(),
            replacement_path.as_ptr(),
            guard.parent_handle().as_raw_fd(),
            target_path.as_ptr(),
            libc::RENAME_SWAP,
        )
    };
    if exchanged != 0 {
        let error = std::io::Error::last_os_error();
        if let Err(lineage_error) = guard.validate() {
            replacement.disable_cleanup(true);
            return Err(format!(
                "could not atomically exchange target file: {error}; \
                 the parent directory lineage also changed: {lineage_error}; \
                 automatic staging-file cleanup was disabled because its pathname is no longer trustworthy"
            ));
        }
        return Err(handle_failed_replacement(
            &format!("could not atomically exchange target file: {error}"),
            replacement,
            replacement_policy,
            Vec::new(),
        ));
    }
    Ok(replacement)
}

#[cfg(not(any(
    windows,
    target_os = "linux",
    target_os = "android",
    target_vendor = "apple"
)))]
fn replace_existing_capturing(
    guard: &DirectoryLineageGuard,
    _target: &Path,
    replacement: tempfile::TempPath,
    replacement_policy: FailedReplacementPolicy,
) -> Result<tempfile::TempPath, String> {
    let _ = guard;
    Err(handle_failed_replacement(
        "this platform cannot safely capture an externally displaced file",
        replacement,
        replacement_policy,
        Vec::new(),
    ))
}

const DISPLACED_RECOVERY_PREFIX: &str = ".verto-recovery-";
const RECOVERY_DIRECTORY_NAME: &str = ".verto-recovery";
const RECOVERY_OWNER_MARKER: &str = ".verto-owner";
const RECOVERY_OWNER_MARKER_CONTENT: &[u8] = b"verto-cas-recovery-v1\n";
const MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY: usize = 64;
const MAX_DOCUMENT_RECOVERY_BYTES_PER_DIRECTORY: u64 = 512 * 1024 * 1024;

#[cfg(unix)]
fn sync_directory(path: &Path) -> Result<(), String> {
    fs::File::open(path)
        .and_then(|directory| directory.sync_all())
        .map_err(|e| {
            format!(
                "could not durably flush directory {}: {e}",
                path.to_string_lossy()
            )
        })
}

#[cfg(not(unix))]
fn sync_directory(_path: &Path) -> Result<(), String> {
    Ok(())
}

fn validate_recovery_directory(path: &Path) -> Result<(), String> {
    let metadata = fs::symlink_metadata(path)
        .map_err(|e| format!("could not inspect Verto recovery directory: {e}"))?;
    if metadata_is_reparse_point(&metadata)
        || metadata.file_type().is_symlink()
        || !metadata.is_dir()
    {
        return Err("Verto recovery path must be a real directory".to_string());
    }
    let canonical = fs::canonicalize(path)
        .map_err(|e| format!("could not resolve Verto recovery directory: {e}"))?;
    if canonical != path {
        return Err("Verto recovery directory must resolve directly in its parent".to_string());
    }
    let marker = path.join(RECOVERY_OWNER_MARKER);
    match fs::symlink_metadata(&marker) {
        Ok(_) => validate_owner_marker(
            &marker,
            RECOVERY_OWNER_MARKER_CONTENT,
            "Verto recovery ownership marker",
        )?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err("Verto recovery directory is missing its ownership marker".to_string())
        }
        Err(error) => {
            return Err(format!(
                "could not inspect Verto recovery ownership marker: {error}"
            ))
        }
    }
    Ok(())
}

fn existing_recovery_directory(parent: &Path) -> Result<Option<PathBuf>, String> {
    let path = parent.join(RECOVERY_DIRECTORY_NAME);
    match fs::symlink_metadata(&path) {
        Ok(_) => {
            validate_recovery_directory(&path)?;
            Ok(Some(path))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "could not inspect Verto recovery directory: {error}"
        )),
    }
}

fn recovery_directory(parent: &Path) -> Result<PathBuf, String> {
    if let Some(path) = existing_recovery_directory(parent)? {
        return Ok(path);
    }

    let path = parent.join(RECOVERY_DIRECTORY_NAME);
    match fs::create_dir(&path) {
        Ok(()) => {}
        Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {
            validate_recovery_directory(&path)?;
            return Ok(path);
        }
        Err(error) => {
            return Err(format!(
                "could not create Verto recovery directory: {error}"
            ))
        }
    }
    let marker = path.join(RECOVERY_OWNER_MARKER);
    let mut marker_owned_by_this_call = false;
    let marker_result = OpenOptions::new()
        .create_new(true)
        .write(true)
        .open(&marker)
        .and_then(|mut file| {
            marker_owned_by_this_call = true;
            file.write_all(RECOVERY_OWNER_MARKER_CONTENT)?;
            file.sync_all()
        });
    if let Err(error) = marker_result {
        // A concurrent process may have populated the newly created directory.
        // Remove the marker only when this call successfully reserved it.
        if marker_owned_by_this_call {
            let _ = fs::remove_file(&marker);
        }
        let _ = fs::remove_dir(&path);
        return Err(format!(
            "could not mark Verto recovery directory as app-owned: {error}"
        ));
    }
    sync_directory(&path)?;
    if let Some(parent) = path.parent() {
        sync_directory(parent)?;
    }
    Ok(path)
}

fn ensure_recovery_capacity(path: &Path, displaced_bytes: u64) -> Result<(), String> {
    let parent = path
        .parent()
        .ok_or_else(|| "document target has no parent directory".to_string())?;
    let recovery_path = parent.join(RECOVERY_DIRECTORY_NAME);
    if displaced_bytes > MAX_DOCUMENT_RECOVERY_BYTES_PER_DIRECTORY {
        return Err(format!(
            "document save paused: the displaced file is {displaced_bytes} bytes, which exceeds \
             the Verto recovery limit of {} bytes for {}; review or move the file before retrying",
            MAX_DOCUMENT_RECOVERY_BYTES_PER_DIRECTORY,
            recovery_path.to_string_lossy()
        ));
    }
    let Some(recovery) = existing_recovery_directory(parent)? else {
        return Ok(());
    };
    let mut artifact_count = 0usize;
    let mut artifact_bytes = 0u64;
    for entry in fs::read_dir(&recovery)
        .map_err(|e| format!("could not inspect document recovery capacity: {e}"))?
    {
        let entry =
            entry.map_err(|e| format!("could not inspect document recovery capacity: {e}"))?;
        if entry.file_name() == RECOVERY_OWNER_MARKER {
            continue;
        }
        if !entry
            .file_name()
            .to_str()
            .is_some_and(|name| name.starts_with(DISPLACED_RECOVERY_PREFIX))
        {
            return Err(format!(
                "Verto recovery directory contains an unrecognized entry at {}; review it before saving",
                entry.path().to_string_lossy()
            ));
        }
        let metadata = entry
            .metadata()
            .map_err(|e| format!("could not inspect document recovery artifact: {e}"))?;
        if !metadata.is_file() {
            return Err(
                "Verto recovery directory contains an unexpected non-file entry; review it before saving"
                    .to_string(),
            );
        }
        artifact_count = artifact_count.saturating_add(1);
        artifact_bytes = artifact_bytes.saturating_add(metadata.len());
    }

    let would_exceed_count = artifact_count >= MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY;
    let would_exceed_bytes = artifact_bytes
        .checked_add(displaced_bytes)
        .is_none_or(|total| total > MAX_DOCUMENT_RECOVERY_BYTES_PER_DIRECTORY);
    if would_exceed_count || would_exceed_bytes {
        return Err(format!(
            "document save paused: the Verto recovery file limit for this directory \
             ({MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY} files or {} bytes) would be \
             exceeded; manually review and export or move files from {}, then retry",
            MAX_DOCUMENT_RECOVERY_BYTES_PER_DIRECTORY,
            recovery.to_string_lossy()
        ));
    }
    Ok(())
}

fn retain_displaced_snapshot(displaced: tempfile::TempPath) -> Result<(), String> {
    retain_displaced_snapshot_with_hook(displaced, || {})
}

fn retain_displaced_snapshot_with_hook<F>(
    displaced: tempfile::TempPath,
    before_persist: F,
) -> Result<(), String>
where
    F: FnOnce(),
{
    let mut displaced = displaced;
    // From this point onward the TempPath can contain the only copy of a user
    // or provider version. Any fallible recovery preparation must leave that
    // exact pathname in place instead of letting TempPath unlink it on drop.
    displaced.disable_cleanup(true);
    let original = displaced.to_path_buf();
    let parent = match original.parent() {
        Some(parent) => parent,
        None => {
            return Err(retain_displaced_failure(
                "displaced snapshot has no parent directory",
                displaced,
            ))
        }
    };
    let displaced_bytes = match fs::metadata(&original) {
        Ok(metadata) => metadata.len(),
        Err(error) => {
            return Err(retain_displaced_failure(
                &format!("could not inspect displaced recovery snapshot: {error}"),
                displaced,
            ))
        }
    };
    if let Err(error) = ensure_recovery_capacity(&original, displaced_bytes) {
        return Err(retain_displaced_failure(&error, displaced));
    }
    let recovery = match recovery_directory(parent) {
        Ok(recovery) => recovery,
        Err(error) => return Err(retain_displaced_failure(&error, displaced)),
    };
    let timestamp = match SystemTime::now().duration_since(UNIX_EPOCH) {
        Ok(duration) => duration.as_nanos(),
        Err(_) => {
            return Err(retain_displaced_failure(
                "system clock is before the Unix epoch",
                displaced,
            ))
        }
    };
    let suffix = original
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("snapshot");
    before_persist();
    for attempt in 0..32u8 {
        if let Err(error) = validate_recovery_directory(&recovery) {
            return Err(retain_displaced_failure(&error, displaced));
        }
        let retained = recovery.join(format!(
            "{DISPLACED_RECOVERY_PREFIX}{timestamp}-{}-{attempt}-{suffix}.bak",
            std::process::id()
        ));
        match displaced.persist_noclobber(&retained) {
            Ok(()) => {
                sync_directory(&recovery).map_err(|error| {
                    format!(
                        "displaced recovery snapshot was retained at {}, but {error}",
                        retained.to_string_lossy()
                    )
                })?;
                return Ok(());
            }
            Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                displaced = error.path;
            }
            Err(error) => {
                return Err(retain_displaced_failure(
                    &format!(
                        "could not retain displaced recovery snapshot at {}: {}",
                        retained.to_string_lossy(),
                        error.error
                    ),
                    error.path,
                ));
            }
        }
    }
    Err(retain_displaced_failure(
        "could not reserve a unique displaced recovery snapshot after 32 attempts",
        displaced,
    ))
}

fn retain_linked_snapshot(source: &Path) -> Result<PathBuf, String> {
    let parent = source
        .parent()
        .ok_or_else(|| "recovery source has no parent directory".to_string())?;
    let bytes = fs::metadata(source)
        .map_err(|e| format!("could not inspect recovery source: {e}"))?
        .len();
    ensure_recovery_capacity(source, bytes)?;
    let recovery = recovery_directory(parent)?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is before the Unix epoch".to_string())?
        .as_nanos();
    let suffix = source
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or("snapshot");

    for attempt in 0..32u8 {
        validate_recovery_directory(&recovery)?;
        let retained = recovery.join(format!(
            "{DISPLACED_RECOVERY_PREFIX}{timestamp}-{}-{attempt}-{suffix}.bak",
            std::process::id()
        ));
        match fs::hard_link(source, &retained) {
            Ok(()) => {
                sync_directory(&recovery).map_err(|error| {
                    format!(
                        "linked recovery snapshot was retained at {}, but {error}",
                        retained.to_string_lossy()
                    )
                })?;
                return Ok(retained);
            }
            Err(error) if error.kind() == std::io::ErrorKind::AlreadyExists => {}
            Err(error) => {
                return Err(format!(
                    "could not retain a linked recovery snapshot from {}: {error}",
                    source.to_string_lossy()
                ))
            }
        }
    }
    Err("could not reserve a unique linked recovery snapshot after 32 attempts".to_string())
}

fn finish_successful_displaced(
    displaced: tempfile::TempPath,
    recovery_class: RecoveryClass,
) -> Result<(), String> {
    #[cfg(windows)]
    {
        let _ = recovery_class;
        // The protected handles exclude old and new write handles while
        // ReplaceFileW captures the exact displaced identity, so it is safe to
        // unlink a fully verified displaced file.
        drop(displaced);
        Ok(())
    }

    #[cfg(unix)]
    {
        match recovery_class {
            RecoveryClass::UserDocument => retain_displaced_snapshot(displaced),
            RecoveryClass::PortableState => {
                // POSIX cannot exclude an uncooperative process that opened the
                // old inode for writing before the exchange. Keeping every old
                // inode would make frequent reading-state writes grow without
                // bound, so portable state intentionally supports cooperative
                // writers only: Verto's advisory lock and providers that publish
                // by atomic pathname replacement. Detected races still restore
                // the provider version and preserve Verto's payload in a conflict
                // sidecar. A process that writes arbitrarily late through an old
                // inode is outside this contract; no finite-storage algorithm can
                // preserve an unbounded number of such writes.
                drop(displaced);
                Ok(())
            }
        }
    }

    #[cfg(not(any(windows, unix)))]
    {
        let _ = recovery_class;
        drop(displaced);
        Err("this platform has no audited displaced-file recovery policy".to_string())
    }
}

fn read_path_revision(path: &Path, max_bytes: u64) -> Result<Option<String>, String> {
    let mut file = match open_content_file_no_follow(path) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
            "could not acquire a protected target snapshot for the current file revision: {error}"
        ))
        }
    };
    bounded_open_file_snapshot(&mut file, max_bytes)
        .map(|(revision, _, _)| Some(revision))
        .map_err(|error| format!("could not read current file revision: {error}"))
}

fn read_bound_path_revision(
    guard: &DirectoryLineageGuard,
    path: &Path,
    max_bytes: u64,
) -> Result<Option<String>, String> {
    guard.validate()?;
    let mut file = match open_bound_child(guard, path, false) {
        Ok(file) => file,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => {
            return Err(format!(
                "could not acquire a bound target snapshot for the current file revision: {error}"
            ))
        }
    };
    let revision = bounded_open_file_snapshot(&mut file, max_bytes)
        .map(|(revision, _, _)| Some(revision))
        .map_err(|error| format!("could not read current bound file revision: {error}"))?;
    guard.validate()?;
    Ok(revision)
}

fn open_bound_protected_target(
    guard: &DirectoryLineageGuard,
    path: &Path,
) -> Result<fs::File, String> {
    guard.validate()?;
    open_bound_child(guard, path, false)
        .map_err(|error| format!("could not acquire a bound protected target snapshot: {error}"))
}

fn open_bound_committed_target(
    guard: &DirectoryLineageGuard,
    path: &Path,
) -> Result<fs::File, String> {
    guard.validate()?;
    open_bound_child(guard, path, true)
        .map_err(|error| format!("could not protect the bound committed target: {error}"))
}

fn bound_path_file_identity(
    guard: &DirectoryLineageGuard,
    path: &Path,
) -> Result<Option<FileIdentity>, String> {
    guard.validate()?;
    match open_bound_identity_child(guard, path) {
        Ok(file) => {
            let metadata = file
                .metadata()
                .map_err(|error| format!("could not inspect bound canonical pathname: {error}"))?;
            if metadata_is_reparse_point(&metadata) || !metadata.is_file() {
                return Err("bound canonical pathname must remain a real file".to_string());
            }
            file_identity(&file).map(Some)
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(format!(
            "could not identify the bound canonical pathname: {error}"
        )),
    }
}

fn protect_bound_published_replacement(
    guard: &DirectoryLineageGuard,
    path: &Path,
    expected_identity: FileIdentity,
) -> Result<(fs::File, bool), String> {
    let file = open_bound_committed_target(guard, path)?;
    let guarded_identity = file_identity(&file)?;
    let still_canonical = guarded_identity == expected_identity
        && bound_path_file_identity(guard, path)? == Some(guarded_identity);
    Ok((file, still_canonical))
}

fn sync_and_verify_bound_committed_guard(
    guard: &DirectoryLineageGuard,
    path: &Path,
    file: &mut fs::File,
    max_bytes: u64,
) -> Result<Option<String>, String> {
    guard.validate()?;
    let (flushed_revision, _, _) = bounded_open_file_snapshot(file, max_bytes)?;
    file.sync_all()
        .map_err(|error| format!("could not flush bound committed file: {error}"))?;

    #[cfg(unix)]
    guard
        .parent_handle()
        .sync_all()
        .map_err(|error| format!("could not flush bound committed directory: {error}"))?;

    let guarded_identity = file_identity(file)?;
    if bound_path_file_identity(guard, path)? != Some(guarded_identity) {
        return read_bound_path_revision(guard, path, max_bytes);
    }
    guard.validate()?;
    Ok(Some(flushed_revision))
}

fn sync_and_verify_committed_revision(
    path: &Path,
    max_bytes: u64,
) -> Result<Option<String>, String> {
    match fs::symlink_metadata(path) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err("committed file must not be a symbolic link".to_string())
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("could not inspect committed file: {error}")),
    };
    let mut file = open_committed_target(path)?;
    let (flushed_revision, _, _) = bounded_open_file_snapshot(&mut file, max_bytes)?;
    file.sync_all()
        .map_err(|e| format!("could not flush committed file: {e}"))?;

    #[cfg(unix)]
    if let Some(parent) = path.parent() {
        fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|e| format!("could not flush committed directory: {e}"))?;
    }

    let guarded_identity = file_identity(&file)?;
    if path_file_identity(path)? == Some(guarded_identity) {
        return Ok(Some(flushed_revision));
    }
    // Another pathname publication won after our flush. Release the old
    // committed guard before opening the new canonical identity.
    drop(file);
    read_path_revision(path, max_bytes)
}

#[allow(dead_code)]
fn sync_and_verify_committed_guard(
    path: &Path,
    file: &mut fs::File,
    max_bytes: u64,
) -> Result<Option<String>, String> {
    let (flushed_revision, _, _) = bounded_open_file_snapshot(file, max_bytes)?;
    file.sync_all()
        .map_err(|e| format!("could not flush committed file: {e}"))?;

    #[cfg(unix)]
    if let Some(parent) = path.parent() {
        fs::File::open(parent)
            .and_then(|directory| directory.sync_all())
            .map_err(|e| format!("could not flush committed directory: {e}"))?;
    }

    let guarded_identity = file_identity(file)?;
    if path_file_identity(path)? != Some(guarded_identity) {
        return read_path_revision(path, max_bytes);
    }
    Ok(Some(flushed_revision))
}

const MAX_CONFLICT_RESTORE_ATTEMPTS: usize = 8;

fn discard_proven_snapshot(mut snapshot: tempfile::TempPath) {
    snapshot.disable_cleanup(false);
    drop(snapshot);
}

fn restore_latest_displaced(
    guard: &DirectoryLineageGuard,
    path: &Path,
    mut candidate: tempfile::TempPath,
    mut expected_canonical_identity: FileIdentity,
    recovery_class: RecoveryClass,
) -> Result<Option<String>, String> {
    candidate.disable_cleanup(true);

    for attempt in 0..MAX_CONFLICT_RESTORE_ATTEMPTS {
        if let Err(error) = guard.validate() {
            return Err(retain_displaced_failure(&error, candidate));
        }
        let mut candidate_handle = match open_bound_protected_target(guard, &candidate) {
            Ok(file) => file,
            Err(error) => {
                return Err(retain_failed_temporaries(
                    &format!("could not protect the external version before restoration: {error}"),
                    vec![candidate],
                ))
            }
        };
        let candidate_identity =
            match read_protected_snapshot(&mut candidate_handle, recovery_class) {
                Ok(snapshot) => snapshot.identity,
                Err(error) => {
                    drop(candidate_handle);
                    return Err(retain_failed_temporaries(
                        &format!(
                            "could not verify the external version before restoration: {error}"
                        ),
                        vec![candidate],
                    ));
                }
            };
        // User-authored documents conservatively retain every provider version
        // observed by the retry loop. Portable state instead follows the
        // cooperative pathname-publish contract: consuming one recovery slot
        // per retry can strand a newer provider version when the bounded
        // recovery directory fills before that version is promoted.
        if recovery_class == RecoveryClass::UserDocument {
            if let Err(error) = retain_linked_snapshot(&candidate) {
                drop(candidate_handle);
                return Err(retain_failed_temporaries(&error, vec![candidate]));
            }
        }
        drop(candidate_handle);

        let mut captured =
            replace_existing_capturing(guard, path, candidate, FailedReplacementPolicy::Retain)?;
        captured.disable_cleanup(true);
        if let Err(error) = guard.validate() {
            return Err(retain_displaced_failure(
                &format!("guarded target lineage changed after restoration: {error}"),
                captured,
            ));
        }

        let mut committed = match open_bound_committed_target(guard, path) {
            Ok(file) => file,
            Err(error) => {
                let retention_error = retain_displaced_snapshot(captured).err();
                let mut message =
                    format!("could not protect the restored canonical version: {error}");
                if let Some(retention_error) = retention_error {
                    message.push_str("; ");
                    message.push_str(&retention_error);
                }
                return Err(message);
            }
        };
        let committed_identity = match file_identity(&committed) {
            Ok(identity) => identity,
            Err(error) => {
                drop(committed);
                return Err(retain_failed_temporaries(&error, vec![captured]));
            }
        };
        let current_path_identity = match bound_path_file_identity(guard, path) {
            Ok(identity) => identity,
            Err(error) => {
                drop(committed);
                return Err(retain_failed_temporaries(&error, vec![captured]));
            }
        };
        let committed_is_candidate = committed_identity == candidate_identity
            && current_path_identity == Some(committed_identity);

        let mut captured_handle = match open_bound_protected_target(guard, &captured) {
            Ok(file) => file,
            Err(error) => {
                drop(committed);
                return Err(retain_failed_temporaries(
                    &format!("could not protect the version captured during restoration: {error}"),
                    vec![captured],
                ));
            }
        };
        let captured_identity = match read_protected_snapshot(&mut captured_handle, recovery_class)
        {
            Ok(snapshot) => snapshot.identity,
            Err(error) => {
                drop(captured_handle);
                drop(committed);
                return Err(retain_failed_temporaries(
                    &format!("could not verify the version captured during restoration: {error}"),
                    vec![captured],
                ));
            }
        };
        drop(captured_handle);
        let captured_is_expected = captured_identity == expected_canonical_identity;

        if !committed_is_candidate {
            // A later provider version is already canonical. Preserve anything
            // captured that was not proven to be our expected predecessor and
            // report the pathname's current revision.
            if captured_is_expected {
                if recovery_class == RecoveryClass::UserDocument && attempt == 0 {
                    retain_displaced_snapshot(captured)?;
                } else {
                    discard_proven_snapshot(captured);
                }
            } else {
                retain_displaced_snapshot(captured)?;
            }
            drop(committed);
            return read_bound_path_revision(guard, path, recovery_read_limit(recovery_class));
        }

        if captured_is_expected {
            if recovery_class == RecoveryClass::UserDocument && attempt == 0 {
                retain_displaced_snapshot(captured)?;
            } else {
                discard_proven_snapshot(captured);
            }
            return sync_and_verify_bound_committed_guard(
                guard,
                path,
                &mut committed,
                recovery_read_limit(recovery_class),
            );
        }

        // The captured file is a second, newer provider publication. Promote
        // it in the next bounded iteration; the just-published candidate is
        // already protected by its recovery hard link.
        drop(committed);
        expected_canonical_identity = candidate_identity;
        candidate = captured;
    }

    let retention_error = retain_displaced_snapshot(candidate).err();
    let mut message = format!(
        "external writers changed the canonical pathname during all \
         {MAX_CONFLICT_RESTORE_ATTEMPTS} bounded restoration attempts"
    );
    if let Some(retention_error) = retention_error {
        message.push_str("; ");
        message.push_str(&retention_error);
    }
    Err(message)
}

fn restore_displaced_after_verification_error(
    guard: &DirectoryLineageGuard,
    path: &Path,
    displaced: tempfile::TempPath,
    verification_error: &str,
    expected_canonical_identity: FileIdentity,
    recovery_class: RecoveryClass,
) -> String {
    match restore_latest_displaced(
        guard,
        path,
        displaced,
        expected_canonical_identity,
        recovery_class,
    ) {
        Ok(_) => verification_error.to_string(),
        Err(error) => {
            format!("{verification_error}; the displaced file could not be restored: {error}")
        }
    }
}

fn restore_displaced_after_guarded_verification_error(
    guard: &DirectoryLineageGuard,
    path: &Path,
    displaced: tempfile::TempPath,
    committed_target: fs::File,
    verification_error: &str,
    expected_canonical_identity: FileIdentity,
    recovery_class: RecoveryClass,
) -> String {
    // On Windows the committed-target guard denies delete sharing, which is
    // exactly what protects a successful publication. Release it before the
    // restoration helper invokes ReplaceFileW, then let the bounded restore
    // loop acquire a fresh guard for the restored canonical inode.
    drop(committed_target);
    restore_displaced_after_verification_error(
        guard,
        path,
        displaced,
        verification_error,
        expected_canonical_identity,
        recovery_class,
    )
}

fn conditional_atomic_write(
    path: &Path,
    content: &[u8],
    expected_revision: Option<&str>,
    force: bool,
    preserve_permissions: bool,
    recovery_class: RecoveryClass,
) -> Result<RevisionWriteOutcome, String> {
    conditional_atomic_write_with_hooks(
        path,
        content,
        expected_revision,
        force,
        preserve_permissions,
        recovery_class,
        || {},
        || {},
        || {},
    )
}

#[cfg(test)]
fn conditional_atomic_write_with_hook<F>(
    path: &Path,
    content: &[u8],
    expected_revision: Option<&str>,
    force: bool,
    preserve_permissions: bool,
    recovery_class: RecoveryClass,
    before_replace: F,
) -> Result<RevisionWriteOutcome, String>
where
    F: FnOnce(),
{
    conditional_atomic_write_with_hooks(
        path,
        content,
        expected_revision,
        force,
        preserve_permissions,
        recovery_class,
        before_replace,
        || {},
        || {},
    )
}

// Separate phase hooks keep filesystem race regressions deterministic without
// adding test-only globals to the production writer.
#[allow(clippy::too_many_arguments)]
fn conditional_atomic_write_with_hooks<F, G, H>(
    path: &Path,
    content: &[u8],
    expected_revision: Option<&str>,
    force: bool,
    preserve_permissions: bool,
    recovery_class: RecoveryClass,
    after_staging: F,
    after_protected_snapshot: G,
    after_displaced_snapshot: H,
) -> Result<RevisionWriteOutcome, String>
where
    F: FnOnce(),
    G: FnOnce(),
    H: FnOnce(),
{
    let max_bytes = recovery_read_limit(recovery_class);
    if content.len() as u64 > max_bytes {
        return Err(format!(
            "save payload is {} bytes and exceeds the safety limit of {max_bytes} bytes",
            content.len()
        ));
    }
    let parent = path
        .parent()
        .ok_or_else(|| "target path has no parent directory".to_string())?;
    let lineage = DirectoryLineageGuard::for_parent(parent)?;
    let (initial_revision, initial_metadata) = match open_bound_child(&lineage, path, false) {
        Ok(mut file) => {
            let snapshot = read_protected_snapshot(&mut file, recovery_class)?;
            let metadata = file
                .metadata()
                .map_err(|error| format!("could not inspect bound target metadata: {error}"))?;
            (Some(snapshot.revision), Some(metadata))
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => (None, None),
        Err(error) => {
            return Err(format!(
                "could not acquire initial bound protected target snapshot: {error}"
            ))
        }
    };
    lineage.validate()?;
    if !force && initial_revision.as_deref() != expected_revision {
        return Ok(RevisionWriteOutcome::Conflict {
            actual_revision: initial_revision,
        });
    }

    let initial_fingerprint = initial_metadata.as_ref().map(file_metadata_fingerprint);
    let permissions = if preserve_permissions {
        initial_metadata
            .as_ref()
            .map(|metadata| {
                let permissions = metadata.permissions();
                if permissions.readonly() {
                    return Err("read-only Markdown files cannot be replaced".to_string());
                }
                Ok(permissions)
            })
            .transpose()?
    } else {
        None
    };
    let target_existed_at_stage = initial_metadata.is_some();
    let PreparedReplacement {
        path: mut replacement,
        identity: replacement_identity,
    } = prepared_bound_temp_path(&lineage, content, permissions)?;
    after_staging();
    if let Err(error) = lineage.validate() {
        replacement.disable_cleanup(true);
        return Err(format!(
            "guarded target lineage changed after staging: {error}; raw temporary retained at {}",
            replacement.to_string_lossy()
        ));
    }
    // Keep the protected handle alive through the final flush. On Windows it
    // excludes competing write handles while still sharing delete access with
    // ReplaceFileW. Other platforms cannot exclude an uncooperative writer,
    // but the handle gives us an authoritative pre-exchange snapshot.
    let mut protected_target: Option<fs::File> = None;
    let mut committed_target: fs::File;

    if !target_existed_at_stage {
        after_protected_snapshot();
        if let Err(error) = lineage.validate() {
            replacement.disable_cleanup(true);
            return Err(format!(
                "guarded target lineage changed before creation: {error}; raw temporary retained at {}",
                replacement.to_string_lossy()
            ));
        }
        match publish_bound_noclobber(&lineage, replacement, path) {
            Ok(()) => {
                lineage.validate()?;
                let (committed, still_expected) =
                    protect_bound_published_replacement(&lineage, path, replacement_identity)?;
                if !still_expected {
                    drop(committed);
                    return Ok(RevisionWriteOutcome::Conflict {
                        actual_revision: read_bound_path_revision(&lineage, path, max_bytes)?,
                    });
                }
                committed_target = committed;
            }
            Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                let mut replacement = error.path;
                if let Err(lineage_error) = lineage.validate() {
                    replacement.disable_cleanup(true);
                    return Err(format!(
                        "guarded target lineage changed during creation: {lineage_error}; raw temporary retained at {}",
                        replacement.to_string_lossy()
                    ));
                }
                let actual_revision = read_bound_path_revision(&lineage, path, max_bytes)?;
                if !force {
                    return Ok(RevisionWriteOutcome::Conflict { actual_revision });
                }
                let mut protected = open_bound_protected_target(&lineage, path)?;
                let protected_snapshot = read_protected_snapshot(&mut protected, recovery_class)?;
                ensure_recovery_capacity(path, protected_snapshot.size)?;
                protected_target = Some(protected);
                let displaced = replace_existing_capturing(
                    &lineage,
                    path,
                    replacement,
                    recovery_class.staged_failure_policy(),
                )?;
                if let Err(lineage_error) = lineage.validate() {
                    return Err(retain_displaced_failure(
                        &format!(
                            "guarded target lineage changed after forced replacement: {lineage_error}"
                        ),
                        displaced,
                    ));
                }
                let (committed, still_expected) =
                    match protect_bound_published_replacement(&lineage, path, replacement_identity)
                    {
                        Ok(result) => result,
                        Err(error) => {
                            return Err(restore_displaced_after_verification_error(
                                &lineage,
                                path,
                                displaced,
                                &format!("could not protect the forced replacement: {error}"),
                                replacement_identity,
                                recovery_class,
                            ))
                        }
                    };
                if !still_expected {
                    drop(committed);
                    retain_displaced_snapshot(displaced)?;
                    return Ok(RevisionWriteOutcome::Conflict {
                        actual_revision: read_bound_path_revision(&lineage, path, max_bytes)?,
                    });
                }
                committed_target = committed;
                // A force-create raced a provider-created path, so retain the
                // exact overwritten version regardless of platform.
                retain_displaced_snapshot(displaced)?;
            }
            Err(mut error) => {
                if lineage.validate().is_err() {
                    error.path.disable_cleanup(true);
                }
                return Err(format!(
                    "could not create bound target without overwriting another writer: {}; temporary path: {}",
                    error.error,
                    error.path.to_string_lossy()
                ));
            }
        }
        after_displaced_snapshot();
        lineage.validate()?;
    } else {
        let mut protected = open_bound_protected_target(&lineage, path)?;
        let protected_snapshot = read_protected_snapshot(&mut protected, recovery_class)?;
        let protected_revision = protected_snapshot.revision;
        if !force
            && (Some(protected_revision.as_str()) != expected_revision
                || Some(protected_snapshot.metadata) != initial_fingerprint)
        {
            return Ok(RevisionWriteOutcome::Conflict {
                actual_revision: Some(protected_revision),
            });
        }
        ensure_recovery_capacity(path, protected_snapshot.size)?;
        let protected_fingerprint = protected_snapshot.metadata;
        let protected_identity = protected_snapshot.identity;
        protected_target = Some(protected);
        after_protected_snapshot();
        if let Err(error) = lineage.validate() {
            replacement.disable_cleanup(true);
            return Err(format!(
                "guarded target lineage changed after the protected snapshot: {error}; raw temporary retained at {}",
                replacement.to_string_lossy()
            ));
        }

        let displaced = replace_existing_capturing(
            &lineage,
            path,
            replacement,
            recovery_class.staged_failure_policy(),
        )?;
        if let Err(error) = lineage.validate() {
            return Err(retain_displaced_failure(
                &format!("guarded target lineage changed after replacement: {error}"),
                displaced,
            ));
        }
        let (committed, still_expected) =
            match protect_bound_published_replacement(&lineage, path, replacement_identity) {
                Ok(result) => result,
                Err(error) => {
                    return Err(restore_displaced_after_verification_error(
                        &lineage,
                        path,
                        displaced,
                        &format!("could not protect the committed replacement: {error}"),
                        replacement_identity,
                        recovery_class,
                    ))
                }
            };
        if !still_expected {
            drop(committed);
            retain_displaced_snapshot(displaced)?;
            return Ok(RevisionWriteOutcome::Conflict {
                actual_revision: read_bound_path_revision(&lineage, path, max_bytes)?,
            });
        }
        committed_target = committed;
        let mut displaced_handle = match open_bound_protected_target(&lineage, &displaced) {
            Ok(file) => file,
            Err(error) => {
                let message = restore_displaced_after_guarded_verification_error(
                    &lineage,
                    path,
                    displaced,
                    committed_target,
                    &format!("could not protect the displaced file: {error}"),
                    replacement_identity,
                    recovery_class,
                );
                return Err(message);
            }
        };
        let displaced_snapshot =
            match read_protected_snapshot(&mut displaced_handle, recovery_class) {
                Ok(snapshot) => snapshot,
                Err(error) => {
                    drop(displaced_handle);
                    let message = restore_displaced_after_guarded_verification_error(
                        &lineage,
                        path,
                        displaced,
                        committed_target,
                        &format!("could not verify the displaced file: {error}"),
                        replacement_identity,
                        recovery_class,
                    );
                    return Err(message);
                }
            };
        after_displaced_snapshot();
        if let Err(error) = lineage.validate() {
            drop(displaced_handle);
            drop(committed_target);
            return Err(retain_displaced_failure(
                &format!("guarded target lineage changed after displaced verification: {error}"),
                displaced,
            ));
        }
        let displaced_revision = displaced_snapshot.revision;
        if !force
            && (displaced_revision != protected_revision
                || displaced_snapshot.metadata != protected_fingerprint
                || displaced_snapshot.identity != protected_identity)
        {
            drop(displaced_handle);
            drop(committed_target);
            let restored_revision = restore_latest_displaced(
                &lineage,
                path,
                displaced,
                replacement_identity,
                recovery_class,
            )?;
            return Ok(RevisionWriteOutcome::Conflict {
                actual_revision: restored_revision.or(Some(displaced_revision)),
            });
        }
        if displaced_snapshot.identity == protected_identity {
            // On Windows, keep the share-deny-write handle alive until after
            // the verified backup has been unlinked. On Unix, the handle makes
            // the retained identity auditable but cannot exclude late writers.
            finish_successful_displaced(displaced, recovery_class)?;
        } else {
            // Force overwrite may intentionally continue after a path-identity
            // change, but the displaced provider version stays recoverable.
            retain_displaced_snapshot(displaced)?;
        }
        drop(displaced_handle);
    }

    let revision = content_revision(content);
    let actual_revision =
        sync_and_verify_bound_committed_guard(&lineage, path, &mut committed_target, max_bytes)?;
    drop(protected_target);
    drop(committed_target);
    if actual_revision.as_deref() == Some(revision.as_str()) {
        Ok(RevisionWriteOutcome::Saved { revision })
    } else {
        // The provider won after our replacement. It remains canonical, while
        // the renderer/recovery journal still owns the unsaved local bytes.
        Ok(RevisionWriteOutcome::Conflict { actual_revision })
    }
}

fn load_authorized_roots(file: &Path) -> AuthorizedRootsFile {
    let Ok(raw) = fs::read_to_string(file) else {
        return AuthorizedRootsFile::default();
    };
    let Ok(registry) = serde_json::from_str::<AuthorizedRootsFile>(&raw) else {
        return AuthorizedRootsFile::default();
    };
    if registry.version != AUTHORIZED_ROOTS_VERSION {
        return AuthorizedRootsFile::default();
    }
    registry
}

fn persist_authorized_roots(file: &Path, next: &AuthorizedRootsFile) -> Result<(), String> {
    let json = serde_json::to_vec_pretty(next)
        .map_err(|e| format!("could not encode authorized libraries: {e}"))?;
    atomic_write(file, &json)
}

/// True when `name` is a readable content file (`.md` / `.mdx`), matching the
/// build-time local source's rules.
fn is_readable_name(name: &str) -> bool {
    Path::new(name)
        .extension()
        .and_then(|extension| extension.to_str())
        .map(|extension| {
            extension.eq_ignore_ascii_case("md") || extension.eq_ignore_ascii_case("mdx")
        })
        .unwrap_or(false)
}

/// Shared by the recursive listing and native watcher so a directory can
/// never be present in the full index while its changes are ignored.
fn is_ignored_content_segment(segment: &str) -> bool {
    let lower = segment.to_ascii_lowercase();
    segment.starts_with('.')
        || lower.ends_with('~')
        || lower.ends_with(".tmp")
        || lower.ends_with(".temp")
        || lower.ends_with(".swp")
        || lower.ends_with(".part")
}

fn readable_file_name(path: &Path, action: &str) -> Result<(), String> {
    let name = path
        .file_name()
        .and_then(|name| name.to_str())
        .ok_or_else(|| "file name is not valid UTF-8".to_string())?;
    if !is_readable_name(name) {
        return Err(format!("only .md and .mdx files can be {action}"));
    }
    Ok(())
}

/// Resolve a user-selected library root to its real filesystem location.
/// Every file operation compares canonical paths against this root so `..`
/// components and symlinks cannot escape the selected library.
fn canonical_library_root(root: &str) -> Result<PathBuf, String> {
    let trimmed = root.trim();
    if trimmed.is_empty() {
        return Err("no active local library was provided".to_string());
    }
    let canonical = fs::canonicalize(trimmed)
        .map_err(|e| format!("could not resolve active local library: {e}"))?;
    let metadata = fs::metadata(&canonical)
        .map_err(|e| format!("could not read active local library metadata: {e}"))?;
    if !metadata.is_dir() {
        return Err("active local library is not a directory".to_string());
    }
    Ok(canonical)
}

fn path_as_utf8(path: &Path) -> Result<String, String> {
    path.to_str()
        .map(ToOwned::to_owned)
        .ok_or_else(|| "selected library path is not valid UTF-8".to_string())
}

/// Keep canonical paths for authorization checks, but do not leak Windows'
/// verbatim (`\\?\`) prefix into renderer-visible labels or localStorage.
fn renderer_path_text(value: &str) -> String {
    if let Some(rest) = value.strip_prefix(r"\\?\UNC\") {
        format!(r"\\{rest}")
    } else if let Some(rest) = value.strip_prefix(r"\\?\") {
        rest.to_string()
    } else {
        value.to_string()
    }
}

fn path_as_renderer_utf8(path: &Path) -> Result<String, String> {
    path_as_utf8(path).map(|value| renderer_path_text(&value))
}

fn register_authorized_root(roots: &AuthorizedRoots, root: PathBuf) -> Result<(), String> {
    let mut registry = roots
        .inner
        .lock()
        .map_err(|_| "authorized library registry is unavailable".to_string())?;
    let mut next = registry.clone();
    next.recent.retain(|candidate| candidate != &root);
    next.recent.insert(0, root);
    next.recent.truncate(MAX_AUTHORIZED_ROOTS);
    persist_authorized_roots(&roots.file, &next)?;
    *registry = next;
    Ok(())
}

fn activate_authorized_root(roots: &AuthorizedRoots, selector: &str) -> Result<PathBuf, String> {
    let canonical = canonical_library_root(selector)?;
    let mut registry = roots
        .inner
        .lock()
        .map_err(|_| "authorized library registry is unavailable".to_string())?;
    let mut next = registry.clone();
    if !next.recent.iter().any(|candidate| candidate == &canonical) {
        return Err(
            "local library is not authorized; choose it with the native picker".to_string(),
        );
    }
    next.active = Some(canonical.clone());
    next.recent.retain(|candidate| candidate != &canonical);
    next.recent.insert(0, canonical.clone());
    persist_authorized_roots(&roots.file, &next)?;
    *registry = next;
    Ok(canonical)
}

fn authorized_active_root(roots: &AuthorizedRoots, selector: &str) -> Result<PathBuf, String> {
    let canonical = canonical_library_root(selector)?;
    let registry = roots
        .inner
        .lock()
        .map_err(|_| "authorized library registry is unavailable".to_string())?;
    if registry.active.as_ref() != Some(&canonical)
        || !registry
            .recent
            .iter()
            .any(|candidate| candidate == &canonical)
    {
        return Err(
            "local library is not the active authorized library; choose or reconnect it first"
                .to_string(),
        );
    }
    Ok(canonical)
}

fn ensure_within_library(root: &Path, path: &Path) -> Result<(), String> {
    if path.starts_with(root) {
        Ok(())
    } else {
        Err("requested file is outside the active local library".to_string())
    }
}

fn canonical_regular_file(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    let link_metadata =
        fs::symlink_metadata(candidate).map_err(|e| format!("could not inspect file: {e}"))?;
    if link_metadata.file_type().is_symlink() {
        return Err("symbolic links are not readable content".to_string());
    }
    let path = fs::canonicalize(candidate).map_err(|e| format!("could not resolve file: {e}"))?;
    ensure_within_library(root, &path)?;
    if !fs::metadata(&path)
        .map_err(|e| format!("could not read file metadata: {e}"))?
        .is_file()
    {
        return Err("selected path is not a file".to_string());
    }
    Ok(path)
}

fn ensure_no_symlink_components(
    root: &Path,
    path: &Path,
    symlink_error: &str,
) -> Result<(), String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "requested file is outside the active local library".to_string())?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        if let Component::Normal(part) = component {
            current.push(part);
            match fs::symlink_metadata(&current) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err(symlink_error.to_string())
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
                Err(error) => return Err(format!("could not inspect target path: {error}")),
            }
        }
    }
    Ok(())
}

#[allow(dead_code)]
fn canonical_markdown_file(root: &Path, candidate: &Path, action: &str) -> Result<PathBuf, String> {
    readable_file_name(candidate, action)?;
    canonical_regular_file(root, candidate)
}

/// Remove `.` and `..` without touching the filesystem. This is needed for a
/// new write target whose complete path cannot be canonicalized yet.
fn normalize_lexically(path: &Path) -> Result<PathBuf, String> {
    let mut normalized = PathBuf::new();
    let mut normal_components = 0usize;

    for component in path.components() {
        match component {
            Component::Prefix(prefix) => normalized.push(prefix.as_os_str()),
            Component::RootDir => normalized.push(component.as_os_str()),
            Component::CurDir => {}
            Component::ParentDir => {
                if normal_components == 0 {
                    return Err("requested path escapes the filesystem root".to_string());
                }
                normalized.pop();
                normal_components -= 1;
            }
            Component::Normal(part) => {
                normalized.push(part);
                normal_components += 1;
            }
        }
    }

    Ok(normalized)
}

fn candidate_path(root: &Path, id: &str) -> Result<PathBuf, String> {
    let trimmed = id.trim();
    if trimmed.is_empty() {
        return Err("file path is empty".to_string());
    }
    let requested = PathBuf::from(trimmed);
    let candidate = if requested.is_absolute() {
        // Renderer-visible Windows IDs intentionally omit canonical `\\?\`
        // prefixes. Map an ID beneath that presentation root back onto the
        // canonical authorization root before doing lexical and symlink
        // confinement checks.
        let renderer_root = PathBuf::from(path_as_renderer_utf8(root)?);
        match requested.strip_prefix(&renderer_root) {
            Ok(relative) => root.join(relative),
            Err(_) => requested,
        }
    } else {
        root.join(requested)
    };
    normalize_lexically(&candidate)
}

fn ensure_visible_content_path(root: &Path, candidate: &Path) -> Result<(), String> {
    let relative = candidate
        .strip_prefix(root)
        .map_err(|_| "requested file is outside the active local library".to_string())?;
    for component in relative.components() {
        if let Component::Normal(part) = component {
            let part = part
                .to_str()
                .ok_or_else(|| "file path is not valid UTF-8".to_string())?;
            if is_ignored_content_segment(part) {
                return Err("hidden files and directories are not readable content".to_string());
            }
        }
    }
    Ok(())
}

fn canonical_existing_ancestor(path: &Path) -> Result<PathBuf, String> {
    let mut current = Some(path);
    while let Some(candidate) = current {
        match fs::symlink_metadata(candidate) {
            Ok(_) => {
                return fs::canonicalize(candidate)
                    .map_err(|e| format!("could not resolve target directory: {e}"));
            }
            Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
                current = candidate.parent();
            }
            Err(error) => {
                return Err(format!("could not inspect target directory: {error}"));
            }
        }
    }
    Err("could not find an existing parent directory".to_string())
}

fn confined_write_target(root: &Path, candidate: &Path) -> Result<PathBuf, String> {
    ensure_no_symlink_components(root, candidate, "symbolic-link paths cannot be written")?;
    match fs::symlink_metadata(candidate) {
        Ok(_) => return canonical_regular_file(root, candidate),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("could not inspect target file: {error}")),
    }

    let parent = candidate
        .parent()
        .ok_or_else(|| "file path has no parent directory".to_string())?;
    let existing_ancestor = canonical_existing_ancestor(parent)?;
    ensure_within_library(root, &existing_ancestor)?;

    fs::create_dir_all(parent).map_err(|e| format!("could not create parent directory: {e}"))?;
    let canonical_parent =
        fs::canonicalize(parent).map_err(|e| format!("could not resolve target directory: {e}"))?;
    ensure_within_library(root, &canonical_parent)?;
    if canonical_parent != parent {
        return Err("target directory must resolve directly inside the library".to_string());
    }

    let file_name = candidate
        .file_name()
        .ok_or_else(|| "file path has no file name".to_string())?;
    let path = canonical_parent.join(file_name);
    match fs::symlink_metadata(&path) {
        Ok(_) => canonical_regular_file(root, &path),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(path),
        Err(error) => Err(format!("could not inspect target file: {error}")),
    }
}

fn valid_state_name(name: &str) -> bool {
    let bytes = name.as_bytes();
    !bytes.is_empty()
        && bytes.len() <= 64
        && bytes[0].is_ascii_alphanumeric()
        && bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(*byte, b'.' | b'_' | b'-'))
}

/// Recursively count readable files beneath `dir`, collecting up to
/// `INSPECT_SAMPLE_LIMIT` relative sample paths. Every visited directory is
/// canonicalized and checked against `root`; this rejects junction/reparse
/// escapes and the visited set breaks filesystem cycles. Dotfiles and
/// unreadable subdirectories are skipped without aborting the scan.
fn confined_scan_path(root: &Path, candidate: &Path) -> Option<PathBuf> {
    let metadata = fs::symlink_metadata(candidate).ok()?;
    if metadata.file_type().is_symlink() {
        return None;
    }
    let canonical = fs::canonicalize(candidate).ok()?;
    ensure_within_library(root, &canonical).ok()?;
    Some(canonical)
}

fn scan_readable(
    root: &Path,
    dir: &Path,
    rel: &str,
    count: &mut usize,
    samples: &mut Vec<String>,
    visited: &mut HashSet<PathBuf>,
) {
    let Some(canonical_dir) = confined_scan_path(root, dir) else {
        return;
    };
    if !visited.insert(canonical_dir.clone()) {
        return;
    }
    let entries = match fs::read_dir(&canonical_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let Some(name) = entry.file_name().to_str().map(ToOwned::to_owned) else {
            continue;
        };
        if is_ignored_content_segment(&name) {
            continue;
        }
        let child_rel = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => {
                scan_readable(root, &entry.path(), &child_rel, count, samples, visited)
            }
            Ok(ft) if ft.is_file() && is_readable_name(&name) => {
                let Some(path) = confined_scan_path(root, &entry.path()) else {
                    continue;
                };
                if !fs::metadata(path)
                    .map(|metadata| metadata.is_file() && metadata.len() <= MAX_CONTENT_FILE_BYTES)
                    .unwrap_or(false)
                {
                    continue;
                }
                *count += 1;
                if samples.len() < INSPECT_SAMPLE_LIMIT {
                    samples.push(child_rel);
                }
            }
            _ => {}
        }
    }
}

fn collect_readable_files(
    root: &Path,
    dir: &Path,
    rel: &[String],
    files: &mut Vec<LocalFileEntry>,
    visited: &mut HashSet<PathBuf>,
) {
    let Some(canonical_dir) = confined_scan_path(root, dir) else {
        return;
    };
    if !visited.insert(canonical_dir.clone()) {
        return;
    }
    let entries = match fs::read_dir(&canonical_dir) {
        Ok(entries) => entries,
        Err(_) => return,
    };
    for entry in entries.flatten() {
        let Some(name) = entry.file_name().to_str().map(ToOwned::to_owned) else {
            continue;
        };
        if is_ignored_content_segment(&name) {
            continue;
        }
        let mut child_rel = rel.to_vec();
        child_rel.push(name.clone());
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => {
                collect_readable_files(root, &entry.path(), &child_rel, files, visited)
            }
            Ok(ft) if ft.is_file() && is_readable_name(&name) => {
                let Some(path) = confined_scan_path(root, &entry.path()) else {
                    continue;
                };
                let Ok(fingerprint) = fingerprint_confined_content_file_bounded(root, &path) else {
                    continue;
                };
                files.push(LocalFileEntry {
                    path: child_rel,
                    id: match path_as_renderer_utf8(&path) {
                        Ok(id) => id,
                        Err(_) => continue,
                    },
                    size: Some(fingerprint.size),
                    mtime: fingerprint.mtime,
                    sha: fingerprint.sha,
                });
            }
            _ => {}
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicU64, Ordering};
    use std::sync::Arc;
    use std::time::{SystemTime, UNIX_EPOCH};

    static NEXT_TEMP_DIR: AtomicU64 = AtomicU64::new(0);

    struct TempTestDir(PathBuf);

    impl TempTestDir {
        fn path(&self) -> &std::path::Path {
            &self.0
        }
    }

    impl Drop for TempTestDir {
        fn drop(&mut self) {
            // Test cleanup must never obscure the assertion that failed. The
            // unique path below prevents tests from deleting one another's
            // fixtures even when Rust runs them in parallel.
            let _ = fs::remove_dir_all(&self.0);
        }
    }

    fn temp_test_dir() -> TempTestDir {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        let sequence = NEXT_TEMP_DIR.fetch_add(1, Ordering::Relaxed);
        let path = std::env::temp_dir().join(format!(
            "verto-local-list-{}-{unique}-{sequence}",
            std::process::id()
        ));
        fs::create_dir(&path).expect("create unique temp dir");
        TempTestDir(fs::canonicalize(path).expect("canonicalize unique temp dir"))
    }

    #[test]
    fn list_local_dir_returns_readable_markdown_entries() {
        let root = temp_test_dir();
        let docs = root.path().join("docs");
        let hidden = root.path().join(".hidden");
        let temporary = root.path().join("scratch.tmp");
        fs::create_dir_all(&docs).expect("create docs dir");
        fs::create_dir_all(&hidden).expect("create hidden dir");
        fs::create_dir_all(&temporary).expect("create temporary dir");
        fs::write(root.path().join("intro.md"), "# Intro").expect("write intro");
        fs::write(docs.join("guide.mdx"), "# Guide").expect("write guide");
        fs::write(root.path().join("cover.png"), "binary").expect("write image");
        fs::write(hidden.join("secret.md"), "# Secret").expect("write hidden");
        fs::write(temporary.join("transient.md"), "# Transient").expect("write temporary note");

        let entries = list_local_dir_at(root.path());
        let intro = entries
            .iter()
            .find(|entry| entry.path == vec!["intro.md"])
            .expect("listed intro");
        assert_eq!(intro.sha, content_revision(b"# Intro"));
        assert_eq!(
            intro.id,
            path_as_renderer_utf8(&root.path().join("intro.md")).expect("renderer path")
        );
        assert!(!intro.id.starts_with(r"\\?\"));
        assert_eq!(
            read_local_file_at(root.path(), &intro.id).expect("read by renderer-visible id"),
            "# Intro"
        );

        let mut paths: Vec<String> = entries
            .into_iter()
            .map(|entry| entry.path.join("/"))
            .collect();
        paths.sort();

        assert_eq!(paths, vec!["docs/guide.mdx", "intro.md"]);
    }

    #[test]
    fn read_local_file_returns_markdown_text() {
        let root = temp_test_dir();
        let file = root.path().join("README.md");
        fs::write(&file, "# Runtime README").expect("write markdown");

        let text = read_local_file_at(root.path(), &file.to_string_lossy()).expect("read markdown");

        assert_eq!(text, "# Runtime README");
    }

    #[test]
    fn list_and_inspection_ignore_content_beyond_the_size_limit() {
        let root = temp_test_dir();
        fs::write(root.path().join("kept.md"), "# Kept").expect("write normal note");
        let oversized = root.path().join("oversized.mdx");
        fs::File::create(&oversized)
            .expect("create oversized note")
            .set_len(MAX_CONTENT_FILE_BYTES + 1)
            .expect("extend oversized note");

        let inspection = inspect_local_dir_at(root.path());
        let entries = list_local_dir_at(root.path());

        assert_eq!(inspection.file_count, 1);
        assert_eq!(inspection.samples, vec!["kept.md"]);
        assert_eq!(entries.len(), 1);
        assert_eq!(entries[0].path, vec!["kept.md"]);
    }

    #[test]
    fn opening_content_beyond_the_size_limit_returns_a_clear_error() {
        let root = temp_test_dir();
        let file = root.path().join("oversized.md");
        fs::File::create(&file)
            .expect("create oversized note")
            .set_len(MAX_CONTENT_FILE_BYTES + 1)
            .expect("extend oversized note");

        let error = read_local_file_at(root.path(), &file.to_string_lossy())
            .expect_err("oversized content must not be loaded");

        assert!(error.contains("32 MiB Markdown/MDX content limit"));
    }

    #[test]
    fn save_refuses_an_oversized_existing_document_before_replacement() {
        let root = temp_test_dir();
        let file = root.path().join("oversized.md");
        fs::File::create(&file)
            .expect("create oversized note")
            .set_len(MAX_CONTENT_FILE_BYTES + 1)
            .expect("extend oversized note");

        let error = conditional_atomic_write(
            &file,
            b"# Replacement",
            None,
            true,
            true,
            RecoveryClass::UserDocument,
        )
        .expect_err("force must not replace an oversized canonical document");

        assert!(error.contains("save safety limit"));
        assert_eq!(
            fs::metadata(&file).expect("inspect untouched note").len(),
            MAX_CONTENT_FILE_BYTES + 1
        );
        assert!(fs::read_dir(root.path())
            .expect("list Vault")
            .flatten()
            .all(|entry| !entry
                .file_name()
                .to_string_lossy()
                .starts_with(".verto-write-")));
    }

    #[test]
    fn save_rejects_an_oversized_document_payload_before_staging() {
        let root = temp_test_dir();
        let file = root.path().join("note.md");
        fs::write(&file, "# Original").expect("write original note");
        let payload = vec![b'x'; (MAX_CONTENT_FILE_BYTES + 1) as usize];

        let error = conditional_atomic_write(
            &file,
            &payload,
            Some(&content_revision(b"# Original")),
            false,
            true,
            RecoveryClass::UserDocument,
        )
        .expect_err("oversized document payload must be rejected before staging");

        assert!(error.contains("exceeds the safety limit"));
        assert_eq!(
            fs::read_to_string(&file).expect("read untouched note"),
            "# Original"
        );
        assert!(fs::read_dir(root.path())
            .expect("list Vault")
            .flatten()
            .all(|entry| !entry
                .file_name()
                .to_string_lossy()
                .starts_with(".verto-write-")));
    }

    #[test]
    fn bounded_reader_rejects_a_stream_that_grows_after_inspection() {
        let mut growing = std::io::Cursor::new(b"now larger".to_vec());

        let error = consume_bounded_reader(&mut growing, 3, |_| {})
            .expect_err("growth during a bounded read must be rejected");

        assert_eq!(error, ContentFileReadError::ChangedDuringRead);
    }

    #[test]
    fn bounded_reader_stops_at_the_limit_even_when_the_stream_keeps_growing() {
        let mut growing = std::io::repeat(0).take(MAX_CONTENT_FILE_BYTES + 1);

        let error = consume_bounded_reader(&mut growing, MAX_CONTENT_FILE_BYTES, |_| {})
            .expect_err("the reader must stop once it observes the first excess byte");

        assert_eq!(error, ContentFileReadError::TooLarge);
    }

    #[cfg(unix)]
    #[test]
    fn bounded_content_snapshot_rejects_a_same_length_write_between_passes() {
        let root = temp_test_dir();
        let file = root.path().join("changing.md");
        fs::write(&file, "first").expect("write first version");
        let mut captured = Vec::new();

        let error = consume_bounded_content_file_with_hook(
            &file,
            |chunk| captured.extend_from_slice(chunk),
            || fs::write(&file, "later").expect("write same-length second version"),
        )
        .expect_err("two streamed fingerprints must reject a mixed-generation read");

        assert_eq!(captured, b"first");
        assert_eq!(error, ContentFileReadError::ChangedDuringRead);
    }

    #[cfg(windows)]
    #[test]
    fn bounded_content_snapshot_excludes_an_in_place_windows_writer() {
        use std::cell::RefCell;

        let root = temp_test_dir();
        let file = root.path().join("changing.md");
        fs::write(&file, "first").expect("write first version");
        let writer_result = RefCell::new(None);

        let source = consume_bounded_content_file_with_hook(
            &file,
            |_| {},
            || {
                *writer_result.borrow_mut() = Some(fs::write(&file, "later"));
            },
        )
        .expect("read a protected Windows snapshot");

        assert_eq!(source.sha, content_revision(b"first"));
        assert!(
            writer_result
                .into_inner()
                .expect("record attempted writer")
                .is_err(),
            "the content read handle must deny same-path in-place writers"
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read unchanged note"),
            "first"
        );
    }

    #[test]
    fn read_local_file_rejects_non_markdown_files() {
        let root = temp_test_dir();
        let file = root.path().join("secret.txt");
        fs::write(&file, "secret").expect("write text");

        let result = read_local_file_at(root.path(), &file.to_string_lossy());

        assert!(result.is_err());
    }

    #[test]
    fn write_local_file_creates_markdown_file() {
        let root = temp_test_dir();
        let file = root.path().join("note.md");

        write_local_file_at(root.path(), &file.to_string_lossy(), "# Written")
            .expect("write markdown");

        let text = fs::read_to_string(&file).expect("read back");
        assert_eq!(text, "# Written");
    }

    #[test]
    fn versioned_save_rejects_an_external_change_without_overwriting_it() {
        let root = temp_test_dir();
        let file = root.path().join("note.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let opened = read_local_file_versioned_at(root.path(), &file.to_string_lossy())
            .expect("open versioned markdown");
        fs::write(&file, "# Changed elsewhere").expect("simulate external edit");

        let outcome = write_local_file_if_revision_at(
            root.path(),
            &file.to_string_lossy(),
            "# Local draft",
            Some(&opened.revision),
            false,
        )
        .expect("return a structured conflict");

        assert_eq!(
            outcome,
            LocalFileWriteOutcome::Conflict {
                expected_revision: Some(opened.revision),
                actual_revision: Some(content_revision(b"# Changed elsewhere")),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read external version"),
            "# Changed elsewhere"
        );
    }

    #[test]
    fn revision_writer_restores_a_change_that_lands_between_compare_and_replace() {
        let root = temp_test_dir();
        let file = root.path().join("race.md");
        let user_owned_similar_name = root.path().join(".verto-recovery-0-personal.bak");
        fs::write(&file, "# Opened").expect("write original markdown");
        fs::write(&user_owned_similar_name, "personal backup")
            .expect("write similarly named user file");
        let baseline = content_revision(b"# Opened");

        let outcome = conditional_atomic_write_with_hook(
            &file,
            b"# Local draft",
            Some(&baseline),
            false,
            true,
            RecoveryClass::UserDocument,
            || fs::write(&file, "# Synced during save").expect("simulate racy provider write"),
        )
        .expect("return a structured race conflict");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Conflict {
                actual_revision: Some(content_revision(b"# Synced during save")),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read restored provider version"),
            "# Synced during save"
        );
        assert_eq!(
            fs::read_to_string(user_owned_similar_name)
                .expect("preserve similarly named user file"),
            "personal backup"
        );
    }

    #[cfg(unix)]
    #[test]
    fn revision_writer_never_follows_a_parent_symlink_swap_outside_the_vault() {
        use std::os::unix::fs::symlink;

        let fixture = temp_test_dir();
        let vault = fixture.path().join("vault");
        let docs = vault.join("docs");
        let moved_docs = vault.join("docs-before-swap");
        let outside = fixture.path().join("outside");
        fs::create_dir_all(&docs).expect("create Vault docs");
        fs::create_dir_all(&outside).expect("create outside directory");
        let file = docs.join("note.md");
        let outside_file = outside.join("note.md");
        fs::write(&file, "# Opened").expect("write Vault note");
        // Matching bytes and metadata made the old pathname-only CAS accept the
        // outside inode after the parent swap.
        fs::write(&outside_file, "# Opened").expect("write matching outside note");
        let baseline = content_revision(b"# Opened");

        let error = conditional_atomic_write_with_hook(
            &file,
            b"# Local draft",
            Some(&baseline),
            false,
            true,
            RecoveryClass::UserDocument,
            || {
                fs::rename(&docs, &moved_docs).expect("move bound parent");
                symlink(&outside, &docs).expect("replace parent with outside symlink");
            },
        )
        .expect_err("a parent symlink swap must abort the guarded save");

        assert!(error.contains("guarded target lineage changed"));
        assert_eq!(
            fs::read_to_string(&outside_file).expect("read untouched outside note"),
            "# Opened"
        );
        assert_eq!(
            fs::read_to_string(moved_docs.join("note.md")).expect("read original Vault note"),
            "# Opened"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_directory_handles_block_parent_replacement_during_save() {
        let fixture = temp_test_dir();
        let docs = fixture.path().join("docs");
        let moved_docs = fixture.path().join("docs-before-swap");
        fs::create_dir_all(&docs).expect("create guarded docs");
        let file = docs.join("note.md");
        fs::write(&file, "# Opened").expect("write guarded note");
        let rename_was_blocked = Arc::new(Mutex::new(false));
        let result_for_hook = Arc::clone(&rename_was_blocked);

        let outcome = conditional_atomic_write_with_hook(
            &file,
            b"# Local draft",
            Some(&content_revision(b"# Opened")),
            false,
            true,
            RecoveryClass::UserDocument,
            || {
                *result_for_hook.lock().expect("lock rename result") =
                    fs::rename(&docs, &moved_docs).is_err();
            },
        )
        .expect("complete the save with its parent pinned");

        assert!(*rename_was_blocked.lock().expect("read rename result"));
        assert_eq!(
            outcome,
            RevisionWriteOutcome::Saved {
                revision: content_revision(b"# Local draft"),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read guarded note"),
            "# Local draft"
        );
    }

    #[cfg(windows)]
    #[test]
    fn windows_lineage_rejects_a_preexisting_directory_junction() {
        use std::process::Command;

        struct JunctionGuard(PathBuf);
        impl Drop for JunctionGuard {
            fn drop(&mut self) {
                let _ = fs::remove_dir(&self.0);
            }
        }

        let fixture = temp_test_dir();
        let vault = fixture.path().join("vault");
        let outside = fixture.path().join("outside");
        let junction = vault.join("docs");
        fs::create_dir_all(&vault).expect("create Vault");
        fs::create_dir_all(&outside).expect("create outside directory");
        let outside_file = outside.join("note.md");
        fs::write(&outside_file, "# Outside").expect("write outside note");
        let junction_arg = junction.to_string_lossy().into_owned();
        let outside_arg = outside.to_string_lossy().into_owned();
        let status = Command::new("cmd")
            .args(["/C", "mklink", "/J", &junction_arg, &outside_arg])
            .status()
            .expect("run mklink");
        let _junction_guard = JunctionGuard(junction.clone());
        assert!(status.success(), "create test junction");

        let error = conditional_atomic_write(
            &junction.join("note.md"),
            b"# Local draft",
            Some(&content_revision(b"# Outside")),
            false,
            true,
            RecoveryClass::UserDocument,
        )
        .expect_err("a junction in the target lineage must be rejected");

        assert!(error.contains("real directory"));
        assert_eq!(
            fs::read_to_string(&outside_file).expect("read untouched outside note"),
            "# Outside"
        );
    }

    #[cfg(windows)]
    #[test]
    fn committed_replacement_rejects_a_late_writer_before_conflict_restoration() {
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::{
            FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
        };

        let root = temp_test_dir();
        let file = root.path().join("late-writer.md");
        let original_identity = root.path().join("provider-old-identity.md");
        let provider_replacement = root.path().join("provider-replacement.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let baseline = content_revision(b"# Opened");
        let late_writer_was_rejected = Arc::new(Mutex::new(false));
        let late_writer_result_for_hook = Arc::clone(&late_writer_was_rejected);

        let outcome = conditional_atomic_write_with_hooks(
            &file,
            b"# Local draft",
            Some(&baseline),
            false,
            true,
            RecoveryClass::UserDocument,
            || {},
            || {
                fs::write(&provider_replacement, "# Provider replacement")
                    .expect("stage provider replacement");
                fs::rename(&file, &original_identity).expect("move original identity aside");
                fs::rename(&provider_replacement, &file).expect("publish provider replacement");
            },
            || {
                let result = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
                    .open(&file);
                *late_writer_result_for_hook
                    .lock()
                    .expect("lock late writer result") = result.is_err();
            },
        )
        .expect("restore provider path as a conflict");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Conflict {
                actual_revision: Some(content_revision(b"# Provider replacement")),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read restored provider file"),
            "# Provider replacement"
        );
        assert!(*late_writer_was_rejected
            .lock()
            .expect("read late writer result"));
    }

    #[cfg(windows)]
    #[test]
    fn committed_replacement_excludes_late_writers_until_saved_is_acknowledged() {
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::{
            FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
        };

        let root = temp_test_dir();
        let file = root.path().join("guarded-commit.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let late_writer_was_rejected = Arc::new(Mutex::new(false));
        let late_writer_result_for_hook = Arc::clone(&late_writer_was_rejected);

        let outcome = conditional_atomic_write_with_hooks(
            &file,
            b"# Local draft",
            Some(&content_revision(b"# Opened")),
            false,
            true,
            RecoveryClass::UserDocument,
            || {},
            || {},
            || {
                let result = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
                    .open(&file);
                *late_writer_result_for_hook
                    .lock()
                    .expect("lock late writer result") = result.is_err();
            },
        )
        .expect("commit while excluding late writer handles");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Saved {
                revision: content_revision(b"# Local draft"),
            }
        );
        assert!(*late_writer_was_rejected
            .lock()
            .expect("read late writer result"));
        assert_eq!(
            fs::read_to_string(&file).expect("read committed Markdown"),
            "# Local draft"
        );
    }

    #[test]
    fn revision_writer_never_clobbers_a_file_created_while_seeding() {
        let root = temp_test_dir();
        let file = root.path().join("created-during-save.md");

        let outcome = conditional_atomic_write_with_hook(
            &file,
            b"# Local seed",
            None,
            false,
            true,
            RecoveryClass::UserDocument,
            || fs::write(&file, "# Provider seed").expect("simulate concurrent create"),
        )
        .expect("return a structured create conflict");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Conflict {
                actual_revision: Some(content_revision(b"# Provider seed")),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read provider-created version"),
            "# Provider seed"
        );
    }

    #[test]
    fn revision_writer_rejects_a_metadata_change_between_compare_and_replace() {
        let root = temp_test_dir();
        let file = root.path().join("metadata-race.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let baseline = content_revision(b"# Opened");
        let original_permissions = fs::metadata(&file)
            .expect("inspect original permissions")
            .permissions();

        let outcome = conditional_atomic_write_with_hook(
            &file,
            b"# Local draft",
            Some(&baseline),
            false,
            true,
            RecoveryClass::UserDocument,
            || {
                let mut permissions = fs::metadata(&file)
                    .expect("inspect provider permissions")
                    .permissions();
                permissions.set_readonly(true);
                fs::set_permissions(&file, permissions).expect("simulate provider metadata update");
            },
        )
        .expect("return a structured metadata conflict");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Conflict {
                actual_revision: Some(baseline),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read provider version"),
            "# Opened"
        );
        assert!(fs::metadata(&file)
            .expect("inspect preserved metadata")
            .permissions()
            .readonly());

        fs::set_permissions(&file, original_permissions).expect("restore cleanup permissions");
    }

    #[cfg(unix)]
    #[test]
    fn posix_document_save_keeps_a_preopened_late_writer_recoverable() {
        use std::io::{Seek, SeekFrom};

        let root = temp_test_dir();
        let file = root.path().join("late-writer.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let baseline = content_revision(b"# Opened");
        let delayed_writer = Arc::new(Mutex::new(None::<fs::File>));
        let writer_for_open = Arc::clone(&delayed_writer);
        let writer_for_update = Arc::clone(&delayed_writer);

        let outcome = conditional_atomic_write_with_hooks(
            &file,
            b"# Local draft",
            Some(&baseline),
            false,
            true,
            RecoveryClass::UserDocument,
            || {},
            || {
                let writer = OpenOptions::new()
                    .read(true)
                    .write(true)
                    .open(&file)
                    .expect("preopen the old canonical inode");
                *writer_for_open.lock().expect("lock delayed writer") = Some(writer);
            },
            || {
                let mut guard = writer_for_update.lock().expect("lock delayed writer");
                let writer = guard.as_mut().expect("access delayed writer");
                writer.set_len(0).expect("truncate old inode");
                writer.seek(SeekFrom::Start(0)).expect("rewind old inode");
                writer
                    .write_all(b"# Delayed provider data")
                    .expect("complete delayed provider write");
                writer.sync_all().expect("flush delayed provider write");
            },
        )
        .expect("save while retaining the displaced identity");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Saved {
                revision: content_revision(b"# Local draft"),
            }
        );
        drop(delayed_writer.lock().expect("lock delayed writer").take());
        assert_eq!(
            fs::read_to_string(&file).expect("read committed local document"),
            "# Local draft"
        );
        let recovery = recovery_directory(root.path()).expect("open marked recovery directory");
        assert!(fs::read_dir(recovery)
            .expect("list retained recovery snapshots")
            .filter_map(Result::ok)
            .filter(|entry| {
                entry
                    .file_name()
                    .to_str()
                    .is_some_and(|name| name.starts_with(DISPLACED_RECOVERY_PREFIX))
            })
            .any(|entry| {
                fs::read_to_string(entry.path())
                    .is_ok_and(|value| value == "# Delayed provider data")
            }));
    }

    #[test]
    fn document_recovery_budget_fails_before_replacement() {
        let root = temp_test_dir();
        let file = root.path().join("budget.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        for index in 0..MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY {
            fs::write(
                recovery.join(format!("{DISPLACED_RECOVERY_PREFIX}{index}.bak")),
                "# Recovery",
            )
            .expect("seed a recovery candidate");
        }

        let error = conditional_atomic_write(
            &file,
            b"# Local draft",
            Some(&content_revision(b"# Opened")),
            false,
            true,
            RecoveryClass::UserDocument,
        )
        .expect_err("a full recovery budget must pause before replacement");

        assert!(error.contains("document save paused"));
        assert_eq!(
            fs::read_to_string(&file).expect("read unchanged document"),
            "# Opened"
        );
    }

    #[test]
    fn oversized_first_recovery_artifact_is_rejected_without_creating_a_directory() {
        let root = temp_test_dir();
        let file = root.path().join("oversized.md");

        let error = ensure_recovery_capacity(
            &file,
            MAX_DOCUMENT_RECOVERY_BYTES_PER_DIRECTORY.saturating_add(1),
        )
        .expect_err("the first oversized artifact must exceed the empty budget");

        assert!(error.contains("exceeds the Verto recovery limit"));
        assert!(existing_recovery_directory(root.path())
            .expect("inspect recovery directory")
            .is_none());
    }

    #[test]
    fn post_exchange_recovery_failure_keeps_the_raw_displaced_path() {
        let root = temp_test_dir();
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        for index in 0..MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY {
            fs::write(
                recovery.join(format!("{DISPLACED_RECOVERY_PREFIX}{index}.bak")),
                "# Recovery",
            )
            .expect("fill recovery budget");
        }
        let mut displaced = tempfile::Builder::new()
            .prefix(".verto-displaced-")
            .tempfile_in(root.path())
            .expect("create displaced snapshot");
        displaced
            .write_all(b"# Only displaced copy")
            .expect("write displaced snapshot");
        displaced
            .as_file()
            .sync_all()
            .expect("flush displaced snapshot");
        let displaced = displaced.into_temp_path();
        let raw_path = displaced.to_path_buf();

        let error = retain_displaced_snapshot(displaced)
            .expect_err("full post-exchange budget must fail visibly");

        assert!(error.contains("document save paused"));
        assert!(error.contains(raw_path.to_string_lossy().as_ref()));
        assert!(raw_path.exists());
        assert_eq!(
            fs::read_to_string(raw_path).expect("read retained raw displaced snapshot"),
            "# Only displaced copy"
        );
    }

    #[test]
    fn displaced_retention_revalidates_the_marker_before_persisting() {
        let root = temp_test_dir();
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        let marker = recovery.join(RECOVERY_OWNER_MARKER);
        let mut displaced = tempfile::Builder::new()
            .prefix(".verto-displaced-")
            .tempfile_in(root.path())
            .expect("create displaced snapshot");
        displaced
            .write_all(b"# Provider version")
            .expect("write displaced snapshot");
        displaced
            .as_file()
            .sync_all()
            .expect("flush displaced snapshot");
        let displaced = displaced.into_temp_path();
        let raw_path = displaced.to_path_buf();

        let error = retain_displaced_snapshot_with_hook(displaced, || {
            fs::write(&marker, b"not-verto-owned\n").expect("invalidate recovery marker")
        })
        .expect_err("marker replacement must fail closed before persistence");

        assert!(error.contains("ownership marker is not recognized"));
        assert!(error.contains(raw_path.to_string_lossy().as_ref()));
        assert_eq!(
            fs::read_to_string(&raw_path).expect("read retained raw snapshot"),
            "# Provider version"
        );
        assert_eq!(
            fs::read_dir(&recovery)
                .expect("list recovery directory")
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name() != RECOVERY_OWNER_MARKER)
                .count(),
            0
        );
    }

    #[test]
    fn recovery_marker_validation_rejects_non_exact_content() {
        let root = temp_test_dir();
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        fs::write(
            recovery.join(RECOVERY_OWNER_MARKER),
            [RECOVERY_OWNER_MARKER_CONTENT, b"extra"].concat(),
        )
        .expect("write oversized marker");

        let error = validate_recovery_directory(&recovery)
            .expect_err("an oversized marker must be rejected without an unbounded read");

        assert!(error.contains("ownership marker is not recognized"));
    }

    #[cfg(unix)]
    #[test]
    fn recovery_marker_validation_does_not_follow_symlinks() {
        use std::os::unix::fs::symlink;

        let root = temp_test_dir();
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        let marker = recovery.join(RECOVERY_OWNER_MARKER);
        let outside = root.path().join("outside-marker");
        fs::write(&outside, RECOVERY_OWNER_MARKER_CONTENT).expect("write lookalike marker");
        fs::remove_file(&marker).expect("remove real marker");
        symlink(&outside, &marker).expect("replace marker with symlink");

        let error = validate_recovery_directory(&recovery)
            .expect_err("ownership validation must not follow a marker symlink");

        assert!(error.contains("could not safely open Verto recovery ownership marker"));
    }

    #[test]
    fn unowned_lookalike_recovery_files_do_not_block_document_saves() {
        let root = temp_test_dir();
        let file = root.path().join("lookalikes.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        for index in 0..MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY {
            fs::write(
                root.path()
                    .join(format!("{DISPLACED_RECOVERY_PREFIX}{index}.bak")),
                "# User-owned lookalike",
            )
            .expect("seed an unowned lookalike");
        }

        let outcome = conditional_atomic_write(
            &file,
            b"# Local draft",
            Some(&content_revision(b"# Opened")),
            false,
            true,
            RecoveryClass::UserDocument,
        )
        .expect("lookalikes outside the marked directory must not block saving");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Saved {
                revision: content_revision(b"# Local draft"),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read committed document"),
            "# Local draft"
        );
    }

    #[cfg(unix)]
    #[test]
    fn portable_state_conflict_restoration_keeps_the_latest_provider_publish_canonical() {
        let root = temp_test_dir();
        let file = root.path().join("portable-state.json");
        let provider_b = root.path().join("provider-b.json");
        let provider_c = root.path().join("provider-c.json");
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        for index in 0..MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY - 1 {
            fs::write(
                recovery.join(format!("{DISPLACED_RECOVERY_PREFIX}{index}.bak")),
                [],
            )
            .expect("seed recovery artifact");
        }
        fs::write(&file, r#"{"version":"A"}"#).expect("write opened state");

        let outcome = conditional_atomic_write_with_hooks(
            &file,
            br#"{"version":"local"}"#,
            Some(&content_revision(br#"{"version":"A"}"#)),
            false,
            false,
            RecoveryClass::PortableState,
            || {},
            || {
                fs::write(&provider_b, r#"{"version":"B"}"#).expect("stage provider B");
                fs::rename(&provider_b, &file).expect("publish provider B");
            },
            || {
                fs::write(&provider_c, r#"{"version":"C"}"#).expect("stage provider C");
                fs::rename(&provider_c, &file).expect("publish provider C");
            },
        )
        .expect("return a conflict after bounded restoration");

        assert_eq!(
            outcome,
            RevisionWriteOutcome::Conflict {
                actual_revision: Some(content_revision(br#"{"version":"C"}"#)),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read latest provider state"),
            r#"{"version":"C"}"#
        );
        assert_eq!(
            fs::read_dir(&recovery)
                .expect("list recovery artifacts")
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name() != RECOVERY_OWNER_MARKER)
                .count(),
            MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY - 1
        );
    }

    #[test]
    fn portable_restore_retries_with_an_almost_full_recovery_budget() {
        let root = temp_test_dir();
        let file = root.path().join("bounded-portable-state.json");
        let provider_c = root.path().join("bounded-provider-c.json");
        fs::write(&file, r#"{"version":"local"}"#).expect("write local canonical state");
        let expected_local_identity =
            file_identity(&fs::File::open(&file).expect("open local state for identity"))
                .expect("identify local state");
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        for index in 0..MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY - 1 {
            fs::write(
                recovery.join(format!("{DISPLACED_RECOVERY_PREFIX}{index}.bak")),
                [],
            )
            .expect("seed recovery artifact");
        }

        let mut provider_b = tempfile::Builder::new()
            .prefix(".bounded-provider-b-")
            .tempfile_in(root.path())
            .expect("create provider B candidate");
        provider_b
            .write_all(br#"{"version":"B"}"#)
            .expect("write provider B candidate");
        provider_b
            .as_file()
            .sync_all()
            .expect("flush provider B candidate");
        fs::write(&provider_c, r#"{"version":"C"}"#).expect("stage provider C");
        fs::remove_file(&file).expect("remove superseded local pathname");
        fs::rename(&provider_c, &file).expect("publish provider C");

        let lineage =
            DirectoryLineageGuard::for_parent(root.path()).expect("bind recovery test root");
        let actual_revision = restore_latest_displaced(
            &lineage,
            &file,
            provider_b.into_temp_path(),
            expected_local_identity,
            RecoveryClass::PortableState,
        )
        .expect("promote C without consuming the final recovery slot");

        assert_eq!(
            actual_revision,
            Some(content_revision(br#"{"version":"C"}"#))
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read latest provider state"),
            r#"{"version":"C"}"#
        );
        assert_eq!(
            fs::read_dir(&recovery)
                .expect("list recovery artifacts")
                .filter_map(Result::ok)
                .filter(|entry| entry.file_name() != RECOVERY_OWNER_MARKER)
                .count(),
            MAX_DOCUMENT_RECOVERY_ARTIFACTS_PER_DIRECTORY - 1
        );
    }

    #[cfg(unix)]
    #[test]
    fn verification_error_restoration_does_not_downgrade_a_newer_provider_publish() {
        let root = temp_test_dir();
        let file = root.path().join("verification-state.json");
        let provider_c = root.path().join("provider-c.json");
        fs::write(&file, r#"{"version":"local"}"#).expect("write staged local state");
        let expected_local_identity =
            file_identity(&fs::File::open(&file).expect("open staged local state for identity"))
                .expect("identify staged local state");

        let mut provider_b = tempfile::Builder::new()
            .prefix(".provider-b-")
            .tempfile_in(root.path())
            .expect("create provider B candidate");
        provider_b
            .write_all(br#"{"version":"B"}"#)
            .expect("write provider B candidate");
        provider_b
            .as_file()
            .sync_all()
            .expect("flush provider B candidate");
        let provider_b = provider_b.into_temp_path();

        fs::write(&provider_c, r#"{"version":"C"}"#).expect("stage provider C");
        fs::rename(&provider_c, &file).expect("publish provider C");

        let lineage =
            DirectoryLineageGuard::for_parent(root.path()).expect("bind recovery test root");
        let actual_revision = restore_latest_displaced(
            &lineage,
            &file,
            provider_b,
            expected_local_identity,
            RecoveryClass::PortableState,
        )
        .expect("restore without downgrading provider C");

        assert_eq!(
            actual_revision,
            Some(content_revision(br#"{"version":"C"}"#))
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read latest provider state"),
            r#"{"version":"C"}"#
        );
    }

    #[cfg(windows)]
    #[test]
    fn verification_error_restoration_releases_the_committed_guard() {
        let root = temp_test_dir();
        let file = root.path().join("verification-guard-state.json");
        fs::write(&file, r#"{"version":"local"}"#).expect("write committed local state");
        let expected_local_identity =
            file_identity(&fs::File::open(&file).expect("open committed local state"))
                .expect("identify committed local state");
        let committed_guard = open_committed_target(&file).expect("guard committed local pathname");

        let mut provider = tempfile::Builder::new()
            .prefix(".provider-restore-")
            .tempfile_in(root.path())
            .expect("create provider candidate");
        provider
            .write_all(br#"{"version":"provider"}"#)
            .expect("write provider candidate");
        provider
            .as_file()
            .sync_all()
            .expect("flush provider candidate");

        let lineage =
            DirectoryLineageGuard::for_parent(root.path()).expect("bind recovery test root");
        let message = restore_displaced_after_guarded_verification_error(
            &lineage,
            &file,
            provider.into_temp_path(),
            committed_guard,
            "injected displaced verification failure",
            expected_local_identity,
            RecoveryClass::PortableState,
        );

        assert_eq!(message, "injected displaced verification failure");
        assert_eq!(
            fs::read_to_string(&file).expect("read restored provider state"),
            r#"{"version":"provider"}"#
        );
        assert!(existing_recovery_directory(root.path())
            .expect("inspect recovery directory")
            .is_none());
    }

    #[test]
    fn unrecognized_entries_inside_the_marked_recovery_directory_fail_closed() {
        let root = temp_test_dir();
        let file = root.path().join("obstructed.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let recovery = recovery_directory(root.path()).expect("create marked recovery directory");
        fs::write(recovery.join("user-file.txt"), "# Not Verto-owned")
            .expect("seed an unrecognized entry");

        let error = conditional_atomic_write(
            &file,
            b"# Local draft",
            Some(&content_revision(b"# Opened")),
            false,
            true,
            RecoveryClass::UserDocument,
        )
        .expect_err("an unrecognized recovery entry must obstruct saving");

        assert!(error.contains("unrecognized entry"));
        assert_eq!(
            fs::read_to_string(&file).expect("read unchanged document"),
            "# Opened"
        );
    }

    #[test]
    fn portable_state_known_local_failure_artifacts_do_not_accumulate() {
        let root = temp_test_dir();
        for version in 0..100 {
            let mut temp = tempfile::Builder::new()
                .prefix(".verto-write-")
                .tempfile_in(root.path())
                .expect("create staged portable state");
            write!(temp, r#"{{"progress":{version}}}"#).expect("write staged portable state");
            let path = temp.path().to_path_buf();
            let message = handle_failed_replacement(
                "simulated pre-exchange failure",
                temp.into_temp_path(),
                FailedReplacementPolicy::DiscardKnownLocal,
                Vec::new(),
            );
            assert_eq!(message, "simulated pre-exchange failure");
            assert!(!path.exists());
        }

        assert_eq!(
            fs::read_dir(root.path())
                .expect("list failed save directory")
                .filter_map(Result::ok)
                .count(),
            0
        );
    }

    #[test]
    fn frequent_state_saves_do_not_accumulate_recovery_snapshots() {
        let root = temp_test_dir();
        let file = root.path().join("reading-state.json");
        fs::write(&file, r#"{"progress":0}"#).expect("write original state");
        let mut expected = content_revision(br#"{"progress":0}"#);

        for version in 1..=1_000 {
            let content = format!(r#"{{"progress":{version}}}"#);
            let outcome = conditional_atomic_write(
                &file,
                content.as_bytes(),
                Some(&expected),
                false,
                false,
                RecoveryClass::PortableState,
            )
            .expect("save portable state");
            expected = content_revision(content.as_bytes());
            assert_eq!(
                outcome,
                RevisionWriteOutcome::Saved {
                    revision: expected.clone(),
                }
            );
        }

        assert!(existing_recovery_directory(root.path())
            .expect("inspect save directory")
            .is_none());
    }

    #[cfg(windows)]
    #[test]
    fn revision_writer_refuses_to_replace_a_file_with_an_open_writer_handle() {
        use std::io::{Seek, SeekFrom};
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::{
            FILE_SHARE_DELETE, FILE_SHARE_READ, FILE_SHARE_WRITE,
        };

        let root = temp_test_dir();
        let file = root.path().join("open-writer.md");
        fs::write(&file, "# Opened").expect("write original markdown");
        let baseline = content_revision(b"# Opened");
        let mut provider = OpenOptions::new()
            .read(true)
            .write(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE)
            .open(&file)
            .expect("open provider writer");

        let error = conditional_atomic_write(
            &file,
            b"# Local draft",
            Some(&baseline),
            false,
            true,
            RecoveryClass::UserDocument,
        )
        .expect_err("an active provider writer must block replacement");
        assert!(error.contains("protected target snapshot"));
        assert_eq!(
            fs::read_to_string(&file).expect("read unchanged canonical file"),
            "# Opened"
        );

        provider.set_len(0).expect("truncate provider file");
        provider
            .seek(SeekFrom::Start(0))
            .expect("rewind provider file");
        provider
            .write_all(b"# Provider final")
            .expect("finish provider write");
        provider.sync_all().expect("flush provider write");
        drop(provider);
        assert_eq!(
            fs::read_to_string(&file).expect("read provider version"),
            "# Provider final"
        );
    }

    #[test]
    fn versioned_save_requires_an_explicit_force_to_resolve_a_conflict() {
        let root = temp_test_dir();
        let file = root.path().join("note.mdx");
        fs::write(&file, "# Opened").expect("write original markdown");
        let opened = read_local_file_versioned_at(root.path(), &file.to_string_lossy())
            .expect("open versioned markdown");
        fs::write(&file, "# Changed elsewhere").expect("simulate external edit");

        let outcome = write_local_file_if_revision_at(
            root.path(),
            &file.to_string_lossy(),
            "# Explicit replacement",
            Some(&opened.revision),
            true,
        )
        .expect("force the replacement");

        assert_eq!(
            outcome,
            LocalFileWriteOutcome::Saved {
                revision: content_revision(b"# Explicit replacement"),
            }
        );
        assert_eq!(
            fs::read_to_string(&file).expect("read forced version"),
            "# Explicit replacement"
        );
    }

    #[test]
    fn write_local_file_rejects_non_markdown() {
        let root = temp_test_dir();
        let file = root.path().join("config.json");

        let result = write_local_file_at(root.path(), &file.to_string_lossy(), "{}");

        assert!(result.is_err());
    }

    #[test]
    fn direct_content_access_rejects_hidden_paths() {
        let root = temp_test_dir();
        let hidden = root.path().join(".private");
        fs::create_dir(&hidden).expect("create hidden dir");
        let file = hidden.join("secret.md");
        fs::write(&file, "# Secret").expect("write hidden markdown");

        assert!(read_local_file_at(root.path(), &file.to_string_lossy()).is_err());
        assert!(write_local_file_at(root.path(), &file.to_string_lossy(), "# Changed").is_err());
        assert_eq!(
            fs::read_to_string(file).expect("read unchanged file"),
            "# Secret"
        );
    }

    #[test]
    fn write_local_file_creates_parent_dirs() {
        let root = temp_test_dir();
        let file = root.path().join("sub").join("deep").join("page.mdx");

        write_local_file_at(root.path(), &file.to_string_lossy(), "# Deep")
            .expect("write into nested dirs");

        let text = fs::read_to_string(&file).expect("read back");
        assert_eq!(text, "# Deep");
    }

    #[test]
    fn read_local_file_rejects_parent_traversal_outside_library() {
        let fixture = temp_test_dir();
        let library = fixture.path().join("library");
        let outside = fixture.path().join("private.md");
        fs::create_dir(&library).expect("create library");
        fs::write(&outside, "# Private").expect("write outside file");
        let traversal = library.join("..").join("private.md");

        let result = read_local_file_at(&library, &traversal.to_string_lossy());

        assert_eq!(
            result.expect_err("parent traversal must be rejected"),
            "requested file is outside the active local library"
        );
    }

    #[test]
    fn write_local_file_rejects_parent_traversal_outside_library() {
        let fixture = temp_test_dir();
        let library = fixture.path().join("library");
        fs::create_dir(&library).expect("create library");
        let outside = fixture.path().join("escaped.md");
        let traversal = library.join("new").join("..").join("..").join("escaped.md");

        let result = write_local_file_at(&library, &traversal.to_string_lossy(), "# Escaped");

        assert_eq!(
            result.expect_err("parent traversal must be rejected"),
            "requested file is outside the active local library"
        );
        assert!(!outside.exists());
    }

    #[cfg(unix)]
    #[test]
    fn read_local_file_rejects_symlink_escape() {
        use std::os::unix::fs::symlink;

        let fixture = temp_test_dir();
        let library = fixture.path().join("library");
        let outside = fixture.path().join("private.md");
        fs::create_dir(&library).expect("create library");
        fs::write(&outside, "# Private").expect("write outside file");
        let link = library.join("linked.md");
        symlink(&outside, &link).expect("create symlink");

        let result = read_local_file_at(&library, &link.to_string_lossy());

        assert_eq!(
            result.expect_err("symlink escape must be rejected"),
            "symbolic links are not readable content"
        );
    }

    #[cfg(unix)]
    #[test]
    fn library_scan_skips_directory_links_outside_the_root() {
        use std::os::unix::fs::symlink;

        let fixture = temp_test_dir();
        let library = fixture.path().join("library");
        let outside = fixture.path().join("outside");
        fs::create_dir(&library).expect("create library");
        fs::create_dir(&outside).expect("create outside dir");
        fs::write(library.join("inside.md"), "# Inside").expect("write inside markdown");
        fs::write(outside.join("private.md"), "# Private").expect("write outside markdown");
        symlink(&outside, library.join("linked")).expect("create directory symlink");

        let inspection = inspect_local_dir_at(&library);
        let files = list_local_dir_at(&library);

        assert_eq!(inspection.file_count, 1);
        assert_eq!(inspection.samples, vec!["inside.md"]);
        assert_eq!(files.len(), 1);
        assert_eq!(files[0].path, vec!["inside.md"]);
    }

    #[cfg(unix)]
    #[test]
    fn write_local_file_rejects_symlinked_parent_escape() {
        use std::os::unix::fs::symlink;

        let fixture = temp_test_dir();
        let library = fixture.path().join("library");
        let outside = fixture.path().join("outside");
        fs::create_dir(&library).expect("create library");
        fs::create_dir(&outside).expect("create outside dir");
        let linked_parent = library.join("linked");
        symlink(&outside, &linked_parent).expect("create directory symlink");
        let target = linked_parent.join("escaped.md");

        let result = write_local_file_at(&library, &target.to_string_lossy(), "# Escaped");

        assert_eq!(
            result.expect_err("symlinked parent escape must be rejected"),
            "symbolic-link paths cannot be written"
        );
        assert!(!outside.join("escaped.md").exists());
    }

    #[cfg(unix)]
    #[test]
    fn write_local_file_rejects_in_library_file_symlink() {
        use std::os::unix::fs::symlink;

        let root = temp_test_dir();
        let victim = root.path().join("package.json");
        fs::write(&victim, r#"{"private":true}"#).expect("write victim");
        let link = root.path().join("evil.md");
        symlink(&victim, &link).expect("create file symlink");

        assert!(write_local_file_at(root.path(), &link.to_string_lossy(), "# Corrupt").is_err());
        assert_eq!(
            fs::read_to_string(victim).expect("read unchanged victim"),
            r#"{"private":true}"#
        );
    }

    #[cfg(unix)]
    #[test]
    fn markdown_atomic_write_preserves_mode_and_rejects_read_only_files() {
        use std::os::unix::fs::PermissionsExt;

        let root = temp_test_dir();
        let note = root.path().join("note.md");
        fs::write(&note, "before").expect("write note");
        fs::set_permissions(&note, fs::Permissions::from_mode(0o640)).expect("set note mode");

        write_local_file_at(root.path(), &note.to_string_lossy(), "after")
            .expect("replace writable note");
        assert_eq!(
            fs::metadata(&note)
                .expect("note metadata")
                .permissions()
                .mode()
                & 0o777,
            0o640
        );

        fs::set_permissions(&note, fs::Permissions::from_mode(0o440)).expect("set read-only mode");
        assert!(write_local_file_at(root.path(), &note.to_string_lossy(), "blocked").is_err());
        assert_eq!(
            fs::read_to_string(&note).expect("read unchanged note"),
            "after"
        );
        fs::set_permissions(&note, fs::Permissions::from_mode(0o640)).expect("restore mode");
    }

    #[test]
    fn portable_state_round_trips_and_rejects_invalid_names() {
        let root = temp_test_dir();

        write_vault_state_at(root.path(), "reading-state", r#"{"version":2}"#)
            .expect("write portable state");

        assert_eq!(
            read_vault_state_at(root.path(), "reading-state").expect("read portable state"),
            Some(r#"{"version":2}"#.to_string())
        );
        assert!(write_vault_state_at(root.path(), "../escape", "{}").is_err());
        assert!(read_vault_state_at(root.path(), ".hidden").is_err());
        assert!(write_vault_state_if_revision_at(
            root.path(),
            "bookmarks",
            "[]",
            None,
            "renderer.with-dot",
            "recovery-1",
        )
        .is_err());
    }

    #[cfg(unix)]
    #[test]
    fn portable_state_reader_rejects_a_same_inode_same_length_write_between_passes() {
        use std::os::unix::fs::MetadataExt;

        let root = temp_test_dir();
        write_vault_state_at(root.path(), "reading-state", r#"{"page":1}"#)
            .expect("write initial portable state");
        let state_path =
            state_file_path(root.path(), "reading-state").expect("resolve portable state path");
        let before = fs::metadata(&state_path).expect("inspect initial portable state");
        let original_modified = before
            .modified()
            .expect("portable state should have a modification time");

        let error = read_vault_state_at_with_hook(root.path(), "reading-state", || {
            fs::write(&state_path, r#"{"page":2}"#)
                .expect("rewrite the same inode with valid same-length JSON");
            let rewritten = OpenOptions::new()
                .write(true)
                .open(&state_path)
                .expect("open rewritten portable state");
            rewritten
                .set_times(fs::FileTimes::new().set_modified(original_modified))
                .expect("restore the original modification time");
        })
        .expect_err("the stable double-read must reject the changed inode contents");

        let after = fs::metadata(&state_path).expect("inspect rewritten portable state");
        assert_eq!(before.dev(), after.dev());
        assert_eq!(before.ino(), after.ino());
        assert_eq!(before.len(), after.len());
        assert_eq!(
            before.modified().expect("before modified time"),
            after.modified().expect("after modified time")
        );
        assert!(error.contains("changed while it was being read"));
        assert_eq!(
            fs::read_to_string(&state_path).expect("read rewritten portable state"),
            r#"{"page":2}"#
        );
    }

    #[test]
    fn versioned_portable_state_seeds_and_reads_an_opaque_revision() {
        let root = temp_test_dir();
        let missing =
            read_vault_state_versioned_at(root.path(), "bookmarks").expect("read missing state");
        assert_eq!(
            missing,
            VersionedVaultState {
                json: None,
                revision: None
            }
        );

        let outcome = write_vault_state_if_revision_at(
            root.path(),
            "bookmarks",
            r#"[{"href":"/read/intro"}]"#,
            None,
            "renderer-device-a",
            "recovery-1",
        )
        .expect("seed portable state");
        let expected_revision = content_revision(br#"[{"href":"/read/intro"}]"#);
        assert_eq!(
            outcome,
            VaultStateWriteOutcome::Saved {
                revision: expected_revision.clone()
            }
        );
        assert_eq!(
            read_vault_state_versioned_at(root.path(), "bookmarks").expect("read seeded state"),
            VersionedVaultState {
                json: Some(r#"[{"href":"/read/intro"}]"#.to_string()),
                revision: Some(expected_revision)
            }
        );
    }

    #[test]
    fn portable_state_cas_preserves_a_losing_payload_without_overwriting_disk() {
        let root = temp_test_dir();
        write_vault_state_at(root.path(), "annotations", r#"{"version":1}"#)
            .expect("write baseline");
        let baseline = read_vault_state_versioned_at(root.path(), "annotations")
            .expect("read baseline")
            .revision
            .expect("baseline revision");
        write_vault_state_at(
            root.path(),
            "annotations",
            r#"{"version":2,"device":"remote"}"#,
        )
        .expect("simulate external sync");

        let outcome = write_vault_state_if_revision_at(
            root.path(),
            "annotations",
            r#"{"version":2,"device":"local"}"#,
            Some(&baseline),
            "renderer-device-a",
            "recovery-2",
        )
        .expect("return conflict");

        let VaultStateWriteOutcome::Conflict {
            expected_revision,
            actual_revision,
            conflict_path,
            preservation_error,
        } = outcome
        else {
            panic!("expected portable-state conflict");
        };
        assert_eq!(expected_revision, Some(baseline));
        assert_eq!(
            actual_revision,
            Some(content_revision(br#"{"version":2,"device":"remote"}"#))
        );
        assert!(preservation_error.is_none());
        let conflict_path = PathBuf::from(conflict_path.expect("preserved conflict path"));
        assert_eq!(
            fs::read_to_string(conflict_path).expect("read conflict copy"),
            r#"{"version":2,"device":"local"}"#
        );
        assert_eq!(
            read_vault_state_at(root.path(), "annotations").expect("read canonical state"),
            Some(r#"{"version":2,"device":"remote"}"#.to_string())
        );
    }

    #[test]
    fn portable_state_cas_treats_an_already_durable_payload_as_success() {
        let root = temp_test_dir();
        write_vault_state_at(root.path(), "reading-state", r#"{"page":7}"#)
            .expect("write already durable state");

        let outcome = write_vault_state_if_revision_at(
            root.path(),
            "reading-state",
            r#"{"page":7}"#,
            Some("stale-revision"),
            "renderer-device-a",
            "recovery-3",
        )
        .expect("recognize idempotent recovery");

        assert_eq!(
            outcome,
            VaultStateWriteOutcome::Saved {
                revision: content_revision(br#"{"page":7}"#)
            }
        );
        assert!(!root.path().join(".verto").join("conflicts").exists());
    }

    #[test]
    fn portable_state_conflict_budget_is_scoped_to_the_writer() {
        let root = temp_test_dir();
        write_vault_state_at(root.path(), "collections", r#"{"remote":true}"#)
            .expect("write remote state");

        for sequence in 0..MAX_STATE_CONFLICTS_PER_WRITER {
            let outcome = write_vault_state_if_revision_at(
                root.path(),
                "collections",
                &format!(r#"{{"local":{sequence}}}"#),
                None,
                "renderer-device-a",
                &format!("recovery-{sequence}"),
            )
            .expect("preserve own conflict");
            assert!(matches!(
                outcome,
                VaultStateWriteOutcome::Conflict {
                    conflict_path: Some(_),
                    preservation_error: None,
                    ..
                }
            ));
        }
        for sequence in MAX_STATE_CONFLICTS_PER_WRITER..MAX_STATE_CONFLICTS_PER_WRITER + 2 {
            let outcome = write_vault_state_if_revision_at(
                root.path(),
                "collections",
                &format!(r#"{{"local":{sequence}}}"#),
                None,
                "renderer-device-a",
                &format!("recovery-{sequence}"),
            )
            .expect("return a conflict with a preservation error");
            let VaultStateWriteOutcome::Conflict {
                conflict_path,
                preservation_error,
                ..
            } = outcome
            else {
                panic!("expected portable-state conflict");
            };
            assert!(conflict_path.is_none());
            assert!(preservation_error
                .as_deref()
                .is_some_and(|error| error.contains("state and writer is full")));
        }
        let other = write_vault_state_if_revision_at(
            root.path(),
            "collections",
            r#"{"other":true}"#,
            None,
            "renderer-device-b",
            "recovery-other",
        )
        .expect("preserve other writer conflict");
        assert!(matches!(other, VaultStateWriteOutcome::Conflict { .. }));

        let conflicts = root.path().join(".verto").join("conflicts");
        let artifacts = state_conflict_artifacts(&conflicts).expect("list conflicts");
        let state_key = content_revision(b"collections");
        let first_writer_key = content_revision(b"renderer-device-a");
        let second_writer_key = content_revision(b"renderer-device-b");
        assert_eq!(
            artifacts
                .iter()
                .filter(|artifact| {
                    artifact.state_key == state_key && artifact.writer_key == first_writer_key
                })
                .count(),
            MAX_STATE_CONFLICTS_PER_WRITER
        );
        assert_eq!(
            artifacts
                .iter()
                .filter(|artifact| {
                    artifact.state_key == state_key && artifact.writer_key == second_writer_key
                })
                .count(),
            1
        );
    }

    #[test]
    fn portable_state_writer_budget_never_deletes_existing_conflicts() {
        let root = temp_test_dir();
        write_vault_state_at(root.path(), "summaries", r#"{"remote":true}"#)
            .expect("write remote state");
        let conflicts = conflict_directory(root.path()).expect("conflict directory");
        let state_key = content_revision(b"summaries");
        let writer_key = content_revision(b"renderer-device-a");
        let mut existing_paths = Vec::new();
        for sequence in 0..5 {
            let recovery_key = content_revision(format!("future-{sequence}").as_bytes());
            let name = format!(
                "v1-{state_key}-{writer_key}-9999999999999999999{}-{recovery_key}-00.json",
                9 - sequence,
            );
            let path = conflicts.join(name);
            fs::write(&path, format!(r#"{{"existing":{sequence}}}"#))
                .expect("write future-dated conflict");
            existing_paths.push(path);
        }

        let outcome = write_vault_state_if_revision_at(
            root.path(),
            "summaries",
            r#"{"local":true}"#,
            None,
            "renderer-device-a",
            "recovery-current",
        )
        .expect("return a conflict with a preservation error");
        let VaultStateWriteOutcome::Conflict {
            conflict_path,
            preservation_error,
            ..
        } = outcome
        else {
            panic!("expected portable-state conflict");
        };

        assert!(conflict_path.is_none());
        assert!(preservation_error
            .as_deref()
            .is_some_and(|error| error.contains("state and writer is full")));
        for (sequence, path) in existing_paths.iter().enumerate() {
            assert_eq!(
                fs::read_to_string(path).expect("read untouched existing conflict"),
                format!(r#"{{"existing":{sequence}}}"#)
            );
        }
        assert_eq!(
            state_conflict_artifacts(&conflicts)
                .expect("list conflicts")
                .iter()
                .filter(|artifact| {
                    artifact.state_key == state_key && artifact.writer_key == writer_key
                })
                .count(),
            MAX_STATE_CONFLICTS_PER_WRITER
        );
    }

    #[test]
    fn portable_state_conflicts_stop_at_the_vault_wide_file_budget() {
        let root = temp_test_dir();
        for index in 0..MAX_STATE_CONFLICTS_PER_VAULT {
            preserve_state_conflict(
                root.path(),
                &format!("state-{index}"),
                &format!(r#"{{"local":{index}}}"#),
                &format!("renderer-{index}"),
                &format!("recovery-{index}"),
            )
            .expect("preserve conflict within global budget");
        }

        let error = preserve_state_conflict(
            root.path(),
            "overflow-state",
            r#"{"overflow":true}"#,
            "overflow-renderer",
            "overflow-recovery",
        )
        .expect_err("the next conflict must stop at the global budget");

        assert!(error.contains("conflict recovery is full"));
        let conflicts = root.path().join(".verto").join("conflicts");
        assert_eq!(
            state_conflict_artifacts(&conflicts)
                .expect("list globally bounded conflicts")
                .len(),
            MAX_STATE_CONFLICTS_PER_VAULT
        );
    }

    #[test]
    fn portable_state_conflict_byte_budget_rejects_an_oversized_first_copy() {
        let root = temp_test_dir();
        let conflicts = conflict_directory(root.path()).expect("conflict directory");

        let error = ensure_state_conflict_capacity(
            &conflicts,
            MAX_STATE_CONFLICT_BYTES_PER_VAULT.saturating_add(1),
        )
        .expect_err("oversized incoming conflict must fail before writing");

        assert!(error.contains("larger than the Vault recovery budget"));
        assert!(state_conflict_artifacts(&conflicts)
            .expect("list empty conflicts")
            .is_empty());
    }

    #[test]
    fn abandoned_sidecar_staging_file_does_not_block_conflict_preservation() {
        let root = temp_test_dir();
        let state = state_directory(root.path(), true)
            .expect("create portable state directory")
            .expect("portable state directory");
        let abandoned = state.join(".verto-write-abandoned");
        fs::write(&abandoned, r#"{"local":"staged"}"#).expect("seed abandoned staging file");

        let preserved = preserve_state_conflict(
            root.path(),
            "reading-state",
            r#"{"local":"recoverable"}"#,
            "renderer-a",
            "recovery-a",
        )
        .expect("a staging file outside conflicts must not block preservation");

        let preserved_path = PathBuf::from(&preserved);
        assert_eq!(
            preserved_path.parent().and_then(Path::file_name),
            Some(std::ffi::OsStr::new("conflicts"))
        );
        assert_eq!(
            preserved_path
                .parent()
                .and_then(Path::parent)
                .and_then(Path::file_name),
            Some(std::ffi::OsStr::new(".verto"))
        );
        assert!(abandoned.is_file());
        assert_eq!(
            fs::read_to_string(preserved).expect("read preserved conflict"),
            r#"{"local":"recoverable"}"#
        );
    }

    #[test]
    fn sidecar_publication_never_clobbers_an_existing_destination() {
        let root = temp_test_dir();
        let state = state_directory(root.path(), true)
            .expect("create portable state directory")
            .expect("portable state directory");
        let conflicts = conflict_directory(root.path()).expect("create conflict directory");
        let state_key = content_revision(b"reading-state");
        let writer_key = content_revision(b"renderer-a");
        let recovery_key = content_revision(b"recovery-a");
        let destination = conflicts.join(format!(
            "v1-{state_key}-{writer_key}-00000000000000000001-{recovery_key}-00.json"
        ));
        fs::write(&destination, r#"{"provider":true}"#).expect("write provider destination");
        let PreparedReplacement {
            path: replacement, ..
        } = prepared_temp_path_in(&state, br#"{"local":true}"#, None)
            .expect("prepare sidecar in state staging");
        let staged_path = replacement.to_path_buf();

        let error = publish_sidecar_noclobber(replacement, &destination)
            .expect_err("no-clobber publication must reject an existing destination");

        assert_eq!(error.error.kind(), std::io::ErrorKind::AlreadyExists);
        assert_eq!(
            fs::read_to_string(&destination).expect("read untouched provider destination"),
            r#"{"provider":true}"#
        );
        assert!(error.path.is_file());
        assert_eq!(error.path.parent(), Some(state.as_path()));
        assert_eq!(error.path.to_path_buf(), staged_path);
    }

    #[test]
    fn conflict_marker_validation_rejects_non_exact_content() {
        let root = temp_test_dir();
        let conflicts = conflict_directory(root.path()).expect("create conflict directory");
        fs::write(
            conflicts.join(CONFLICT_DIRECTORY_MARKER),
            [CONFLICT_DIRECTORY_MARKER_CONTENT, b"extra"].concat(),
        )
        .expect("write oversized conflict marker");

        let error = conflict_directory(root.path())
            .expect_err("an oversized marker must be rejected without an unbounded read");

        assert!(error.contains("ownership marker is not recognized"));
    }

    #[cfg(unix)]
    #[test]
    fn conflict_marker_validation_does_not_follow_symlinks() {
        use std::os::unix::fs::symlink;

        let root = temp_test_dir();
        let conflicts = conflict_directory(root.path()).expect("create conflict directory");
        let marker = conflicts.join(CONFLICT_DIRECTORY_MARKER);
        let outside = root.path().join("outside-conflict-marker");
        fs::write(&outside, CONFLICT_DIRECTORY_MARKER_CONTENT).expect("write lookalike marker");
        fs::remove_file(&marker).expect("remove real marker");
        symlink(&outside, &marker).expect("replace marker with symlink");

        let error = conflict_directory(root.path())
            .expect_err("conflict marker validation must not follow a symlink");

        assert!(error.contains("could not safely open portable conflict ownership marker"));
    }

    #[test]
    fn similarly_named_state_conflict_budgets_are_independent() {
        let root = temp_test_dir();
        for index in 0..MAX_STATE_CONFLICTS_PER_WRITER {
            preserve_state_conflict(
                root.path(),
                "foo",
                &format!(r#"{{"foo":{index}}}"#),
                "renderer-a",
                &format!("foo-recovery-{index}"),
            )
            .expect("preserve foo conflict");
            preserve_state_conflict(
                root.path(),
                "foo.conflict.bar",
                &format!(r#"{{"bar":{index}}}"#),
                "renderer-a",
                &format!("bar-recovery-{index}"),
            )
            .expect("preserve similarly named conflict");
        }

        let error = preserve_state_conflict(
            root.path(),
            "foo",
            r#"{"foo":"next"}"#,
            "renderer-a",
            "foo-recovery-next",
        )
        .expect_err("a full exact state/writer bucket must fail without rotation");
        assert!(error.contains("state and writer is full"));

        let conflicts = root.path().join(".verto").join("conflicts");
        let artifacts = state_conflict_artifacts(&conflicts).expect("list conflicts");
        let writer_key = content_revision(b"renderer-a");
        for state in ["foo", "foo.conflict.bar"] {
            let state_key = content_revision(state.as_bytes());
            assert_eq!(
                artifacts
                    .iter()
                    .filter(|artifact| {
                        artifact.state_key == state_key && artifact.writer_key == writer_key
                    })
                    .count(),
                MAX_STATE_CONFLICTS_PER_WRITER
            );
        }
    }

    #[cfg(windows)]
    #[test]
    fn full_writer_budget_does_not_try_to_delete_a_locked_copy() {
        use std::os::windows::fs::OpenOptionsExt;
        use windows_sys::Win32::Storage::FileSystem::{FILE_SHARE_READ, FILE_SHARE_WRITE};

        let root = temp_test_dir();
        for index in 0..MAX_STATE_CONFLICTS_PER_WRITER {
            preserve_state_conflict(
                root.path(),
                "locked-state",
                &format!(r#"{{"local":{index}}}"#),
                "renderer-a",
                &format!("recovery-{index}"),
            )
            .expect("fill writer conflict budget");
        }
        let conflicts = root.path().join(".verto").join("conflicts");
        let state_key = content_revision(b"locked-state");
        let writer_key = content_revision(b"renderer-a");
        let artifacts = state_conflict_artifacts(&conflicts)
            .expect("list conflicts")
            .into_iter()
            .filter(|artifact| artifact.state_key == state_key && artifact.writer_key == writer_key)
            .collect::<Vec<_>>();
        let locked_path = artifacts.first().expect("existing conflict").path.clone();
        let _lock = OpenOptions::new()
            .read(true)
            .share_mode(FILE_SHARE_READ | FILE_SHARE_WRITE)
            .open(&locked_path)
            .expect("open conflict without delete sharing");

        let error = preserve_state_conflict(
            root.path(),
            "locked-state",
            r#"{"local":"overflow"}"#,
            "renderer-a",
            "recovery-overflow",
        )
        .expect_err("the full writer budget must fail before touching any copy");

        assert!(error.contains("state and writer is full"));
        assert!(locked_path.is_file());
        assert_eq!(
            state_conflict_artifacts(&conflicts)
                .expect("list bounded conflicts")
                .into_iter()
                .filter(|artifact| {
                    artifact.state_key == state_key && artifact.writer_key == writer_key
                })
                .count(),
            MAX_STATE_CONFLICTS_PER_WRITER
        );
    }

    #[test]
    fn portable_state_cas_serializes_two_concurrent_verto_writers() {
        let root = temp_test_dir();
        write_vault_state_at(root.path(), "bookmarks", r#"{"base":true}"#).expect("write baseline");
        let baseline = read_vault_state_versioned_at(root.path(), "bookmarks")
            .expect("read baseline")
            .revision
            .expect("baseline revision");
        let root_path = root.path().to_path_buf();
        let start = std::sync::Arc::new(std::sync::Barrier::new(3));

        let first_root = root_path.clone();
        let first_revision = baseline.clone();
        let first_start = std::sync::Arc::clone(&start);
        let first = std::thread::spawn(move || {
            first_start.wait();
            write_vault_state_if_revision_at(
                &first_root,
                "bookmarks",
                r#"{"writer":"a"}"#,
                Some(&first_revision),
                "renderer-device-a",
                "recovery-a",
            )
            .expect("first writer outcome")
        });
        let second_start = std::sync::Arc::clone(&start);
        let second = std::thread::spawn(move || {
            second_start.wait();
            write_vault_state_if_revision_at(
                &root_path,
                "bookmarks",
                r#"{"writer":"b"}"#,
                Some(&baseline),
                "renderer-device-b",
                "recovery-b",
            )
            .expect("second writer outcome")
        });
        start.wait();

        let outcomes = [
            first.join().expect("join first"),
            second.join().expect("join second"),
        ];
        assert_eq!(
            outcomes
                .iter()
                .filter(|outcome| matches!(outcome, VaultStateWriteOutcome::Saved { .. }))
                .count(),
            1
        );
        assert_eq!(
            outcomes
                .iter()
                .filter(|outcome| matches!(outcome, VaultStateWriteOutcome::Conflict { .. }))
                .count(),
            1
        );
    }

    #[cfg(unix)]
    #[test]
    fn portable_state_rejects_directory_and_file_symlinks() {
        use std::os::unix::fs::symlink;

        let fixture = temp_test_dir();
        let library = fixture.path().join("library");
        let outside = fixture.path().join("outside");
        fs::create_dir(&library).expect("create library");
        fs::create_dir(&outside).expect("create outside dir");
        symlink(&outside, library.join(".verto")).expect("link state dir");
        assert!(write_vault_state_at(&library, "bookmarks", "[]").is_err());

        fs::remove_file(library.join(".verto")).expect("remove state dir link");
        fs::create_dir(library.join(".verto")).expect("create real state dir");
        let victim = library.join("package.json");
        fs::write(&victim, r#"{"private":true}"#).expect("write victim");
        symlink(&victim, library.join(".verto").join("bookmarks.json")).expect("link state file");

        assert!(write_vault_state_at(&library, "bookmarks", "[]").is_err());
        assert!(read_vault_state_at(&library, "bookmarks").is_err());
        assert_eq!(
            fs::read_to_string(victim).expect("read unchanged victim"),
            r#"{"private":true}"#
        );
    }

    #[test]
    fn authorized_roots_require_picker_registration_then_exact_activation() {
        let fixture = temp_test_dir();
        let library = fixture.path().join("library");
        let sibling = fixture.path().join("library-copy");
        fs::create_dir(&library).expect("create library");
        fs::create_dir(&sibling).expect("create sibling");
        let library = fs::canonicalize(library).expect("canonical library");
        let sibling = fs::canonicalize(sibling).expect("canonical sibling");
        let roots = AuthorizedRoots {
            file: fixture.path().join("authorized.json"),
            inner: Mutex::new(AuthorizedRootsFile::default()),
        };

        register_authorized_root(&roots, library.clone()).expect("register picker result");
        assert!(authorized_active_root(&roots, &path_as_utf8(&library).unwrap()).is_err());
        activate_authorized_root(&roots, &path_as_utf8(&library).unwrap())
            .expect("activate registered root");
        assert_eq!(
            authorized_active_root(&roots, &path_as_utf8(&library).unwrap())
                .expect("authorize active root"),
            library
        );
        assert!(authorized_active_root(&roots, &path_as_utf8(&sibling).unwrap()).is_err());

        let persisted = load_authorized_roots(&roots.file);
        assert_eq!(persisted.active, Some(library));
        assert_eq!(persisted.recent.len(), 1);
    }

    #[test]
    fn renderer_paths_hide_windows_verbatim_prefixes() {
        assert_eq!(renderer_path_text(r"\\?\C:\Notes\Verto"), r"C:\Notes\Verto");
        assert_eq!(
            renderer_path_text(r"\\?\UNC\server\share\Verto"),
            r"\\server\share\Verto"
        );
        assert_eq!(renderer_path_text("/Users/me/Verto"), "/Users/me/Verto");
    }
}

fn inspect_local_dir_at(path: &Path) -> FolderInspection {
    let meta = fs::metadata(path);
    let (exists, is_dir) = match &meta {
        Ok(m) => (true, m.is_dir()),
        Err(_) => (false, false),
    };
    let mut file_count = 0usize;
    let mut samples = Vec::new();
    if is_dir {
        if let Ok(root) = fs::canonicalize(path) {
            scan_readable(
                &root,
                &root,
                "",
                &mut file_count,
                &mut samples,
                &mut HashSet::new(),
            );
        }
    }
    FolderInspection {
        exists,
        is_dir,
        file_count,
        samples,
    }
}

fn list_local_dir_at(path: &Path) -> Vec<LocalFileEntry> {
    let mut files = Vec::new();
    if let Ok(root) = fs::canonicalize(path) {
        collect_readable_files(&root, &root, &[], &mut files, &mut HashSet::new());
    }
    files
}

fn read_local_file_at(root: &Path, id: &str) -> Result<String, String> {
    let candidate = candidate_path(root, id)?;
    ensure_visible_content_path(root, &candidate)?;
    readable_file_name(&candidate, "opened")?;
    ensure_no_symlink_components(root, &candidate, "symbolic links are not readable content")?;
    ensure_within_library(root, &candidate)?;
    read_confined_content_file_bounded(root, &candidate).map_err(|error| error.to_string())
}

fn content_revision(content: &[u8]) -> String {
    format!("{:x}", Sha256::digest(content))
}

fn read_local_file_versioned_at(root: &Path, id: &str) -> Result<VersionedLocalFile, String> {
    let source = read_local_file_at(root, id)?;
    let revision = content_revision(source.as_bytes());
    Ok(VersionedLocalFile { source, revision })
}

#[cfg(test)]
fn write_local_file_at(root: &Path, id: &str, content: &str) -> Result<(), String> {
    let candidate = candidate_path(root, id)?;
    ensure_visible_content_path(root, &candidate)?;
    readable_file_name(&candidate, "written")?;
    let path = confined_write_target(root, &candidate)?;
    atomic_write_markdown(&path, content.as_bytes())
        .map_err(|e| format!("could not write file: {e}"))
}

fn write_local_file_if_revision_at(
    root: &Path,
    id: &str,
    content: &str,
    expected_revision: Option<&str>,
    force: bool,
) -> Result<LocalFileWriteOutcome, String> {
    let candidate = candidate_path(root, id)?;
    ensure_visible_content_path(root, &candidate)?;
    readable_file_name(&candidate, "written")?;
    let path = confined_write_target(root, &candidate)?;
    let _write_lock = lock_library_writes(root)?;
    match conditional_atomic_write(
        &path,
        content.as_bytes(),
        expected_revision,
        force,
        true,
        RecoveryClass::UserDocument,
    )? {
        RevisionWriteOutcome::Saved { revision } => Ok(LocalFileWriteOutcome::Saved { revision }),
        RevisionWriteOutcome::Conflict { actual_revision } => Ok(LocalFileWriteOutcome::Conflict {
            expected_revision: expected_revision.map(ToOwned::to_owned),
            actual_revision,
        }),
    }
}

fn state_file_path(root: &Path, name: &str) -> Result<PathBuf, String> {
    if !valid_state_name(name) {
        return Err("state name must match [A-Za-z0-9][A-Za-z0-9._-]{0,63}".to_string());
    }
    Ok(root.join(".verto").join(format!("{name}.json")))
}

fn state_directory(root: &Path, create: bool) -> Result<Option<PathBuf>, String> {
    let candidate = root.join(".verto");
    match fs::symlink_metadata(&candidate) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err("portable state directory must not be a symbolic link".to_string());
            }
            if !metadata.is_dir() {
                return Err("portable state path is not a directory".to_string());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound && !create => return Ok(None),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(&candidate)
                .map_err(|e| format!("could not create portable state directory: {e}"))?;
        }
        Err(error) => {
            return Err(format!(
                "could not inspect portable state directory: {error}"
            ))
        }
    }

    let canonical = fs::canonicalize(&candidate)
        .map_err(|e| format!("could not resolve portable state directory: {e}"))?;
    ensure_within_library(root, &canonical)?;
    if canonical != candidate {
        return Err(
            "portable state directory must resolve directly inside the library".to_string(),
        );
    }
    Ok(Some(canonical))
}

/// Serialize Verto writers across renderer windows and application processes.
///
/// Filesystem sync providers do not participate in advisory locks, so the
/// revision comparison and post-write verification remain authoritative for
/// external changes. The lock closes the much larger two-Verto-windows race
/// and keeps the compare/replace window as small as the underlying filesystem
/// permits.
fn lock_library_writes(root: &Path) -> Result<fs::File, String> {
    let directory = state_directory(root, true)?
        .ok_or_else(|| "portable state directory is unavailable".to_string())?;
    let candidate = directory.join(".write.lock");
    match fs::symlink_metadata(&candidate) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err("library write lock must not be a symbolic link".to_string())
        }
        Ok(metadata) if !metadata.is_file() => {
            return Err("library write lock path is not a file".to_string())
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("could not inspect library write lock: {error}")),
    }

    let file = OpenOptions::new()
        .create(true)
        .truncate(false)
        .read(true)
        .write(true)
        .open(&candidate)
        .map_err(|e| format!("could not open library write lock: {e}"))?;
    let canonical = fs::canonicalize(&candidate)
        .map_err(|e| format!("could not resolve library write lock: {e}"))?;
    ensure_within_library(&directory, &canonical)?;
    if canonical != candidate {
        return Err("library write lock must resolve directly inside .verto".to_string());
    }
    FileExt::lock_exclusive(&file).map_err(|e| format!("could not lock library writes: {e}"))?;
    Ok(file)
}

fn map_portable_state_read_error(error: ContentFileReadError) -> String {
    match error {
        ContentFileReadError::TooLarge => "portable state file is too large".to_string(),
        ContentFileReadError::ChangedDuringRead => {
            "portable state changed while it was being read; try again".to_string()
        }
        ContentFileReadError::Unsafe(message) | ContentFileReadError::Io(message) => {
            format!("could not read portable state safely: {message}")
        }
    }
}

fn read_stable_vault_state_file_with_hook(
    mut file: fs::File,
    between_passes: impl FnOnce(),
) -> Result<Vec<u8>, String> {
    let before = file
        .metadata()
        .map_err(|e| format!("could not inspect portable state: {e}"))?;
    if metadata_is_reparse_point(&before) || !before.is_file() {
        return Err("portable state path is not a real file".to_string());
    }
    if before.len() > MAX_STATE_BYTES as u64 {
        return Err("portable state file is too large".to_string());
    }

    let before_modified = before.modified().ok();
    let mut bytes = Vec::with_capacity(
        usize::try_from(before.len())
            .unwrap_or(MAX_STATE_BYTES)
            .min(MAX_STATE_BYTES),
    );
    #[cfg(not(windows))]
    let mut first_digest = Sha256::new();
    consume_reader_at_limit(&mut file, before.len(), MAX_STATE_BYTES as u64, |chunk| {
        #[cfg(not(windows))]
        Digest::update(&mut first_digest, chunk);
        bytes.extend_from_slice(chunk);
    })
    .map_err(map_portable_state_read_error)?;
    let after = file
        .metadata()
        .map_err(|e| format!("could not re-inspect portable state after reading: {e}"))?;
    if metadata_is_reparse_point(&after)
        || !after.is_file()
        || after.len() != before.len()
        || after.modified().ok() != before_modified
    {
        return Err("portable state changed while it was being read; try again".to_string());
    }

    #[cfg(not(windows))]
    let first_sha = first_digest.finalize();
    between_passes();

    // Windows excludes in-place writers through the bound read handle. POSIX
    // cannot impose that sharing rule on unrelated processes, so verify a
    // second streamed fingerprint from the same open inode. Retaining the
    // first bytes while only hashing the second pass avoids a second state
    // buffer and catches same-length writes even when mtime is restored or too
    // coarse to advance.
    #[cfg(not(windows))]
    {
        file.seek(SeekFrom::Start(0))
            .map_err(|e| format!("could not rewind portable state for verification: {e}"))?;
        let mut verification_digest = Sha256::new();
        consume_reader_at_limit(&mut file, before.len(), MAX_STATE_BYTES as u64, |chunk| {
            Digest::update(&mut verification_digest, chunk)
        })
        .map_err(map_portable_state_read_error)?;
        let verified = file
            .metadata()
            .map_err(|e| format!("could not re-inspect verified portable state: {e}"))?;
        if metadata_is_reparse_point(&verified)
            || !verified.is_file()
            || verified.len() != before.len()
            || verified.modified().ok() != before_modified
            || verification_digest.finalize() != first_sha
        {
            return Err("portable state changed while it was being read; try again".to_string());
        }
    }
    Ok(bytes)
}

fn read_vault_state_at(root: &Path, name: &str) -> Result<Option<String>, String> {
    read_vault_state_at_with_hook(root, name, || {})
}

fn read_vault_state_at_with_hook(
    root: &Path,
    name: &str,
    between_passes: impl FnOnce(),
) -> Result<Option<String>, String> {
    let candidate = state_file_path(root, name)?;
    let Some(directory) = state_directory(root, false)? else {
        return Ok(None);
    };
    match fs::symlink_metadata(&candidate) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err("portable state file must not be a symbolic link".to_string());
            }
            if !metadata.is_file() {
                return Err("portable state path is not a file".to_string());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(error) => return Err(format!("could not inspect portable state: {error}")),
    }
    let path = fs::canonicalize(&candidate)
        .map_err(|e| format!("could not resolve portable state file: {e}"))?;
    ensure_within_library(&directory, &path)?;
    if path != candidate {
        return Err("portable state file must resolve directly inside .verto".to_string());
    }
    let lineage = DirectoryLineageGuard::for_parent(&directory)?;
    let file = open_bound_child(&lineage, &path, false)
        .map_err(|e| format!("could not read bound portable state: {e}"))?;
    let bytes = read_stable_vault_state_file_with_hook(file, between_passes)?;
    lineage.validate()?;
    let raw =
        String::from_utf8(bytes).map_err(|_| "portable state is not valid UTF-8".to_string())?;
    serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|e| format!("portable state is not valid JSON: {e}"))?;
    Ok(Some(raw))
}

fn read_vault_state_versioned_at(root: &Path, name: &str) -> Result<VersionedVaultState, String> {
    let json = read_vault_state_at(root, name)?;
    let revision = json
        .as_ref()
        .map(|content| content_revision(content.as_bytes()));
    Ok(VersionedVaultState { json, revision })
}

fn validated_conflict_component(value: &str, label: &str) -> Result<String, String> {
    let bytes = value.as_bytes();
    if bytes.is_empty()
        || bytes.len() > 64
        || !bytes[0].is_ascii_alphanumeric()
        || !bytes
            .iter()
            .all(|byte| byte.is_ascii_alphanumeric() || matches!(*byte, b'_' | b'-'))
    {
        return Err(format!(
            "{label} must match [A-Za-z0-9][A-Za-z0-9_-]{{0,63}}"
        ));
    }
    Ok(value.to_string())
}

fn conflict_directory(root: &Path) -> Result<PathBuf, String> {
    let state = state_directory(root, true)?
        .ok_or_else(|| "portable state directory is unavailable".to_string())?;
    let candidate = state.join("conflicts");
    let mut created_by_this_call = false;
    match fs::symlink_metadata(&candidate) {
        Ok(metadata) => {
            if metadata.file_type().is_symlink() {
                return Err("portable conflict directory must not be a symbolic link".to_string());
            }
            if !metadata.is_dir() {
                return Err("portable conflict path is not a directory".to_string());
            }
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            fs::create_dir(&candidate)
                .map_err(|e| format!("could not create portable conflict directory: {e}"))?;
            created_by_this_call = true;
        }
        Err(error) => {
            return Err(format!(
                "could not inspect portable conflict directory: {error}"
            ))
        }
    }

    let canonical = fs::canonicalize(&candidate)
        .map_err(|e| format!("could not resolve portable conflict directory: {e}"))?;
    ensure_within_library(&state, &canonical)?;
    if canonical != candidate {
        return Err("portable conflict directory must resolve directly inside .verto".to_string());
    }

    let marker = canonical.join(CONFLICT_DIRECTORY_MARKER);
    match fs::symlink_metadata(&marker) {
        Ok(_) => validate_owner_marker(
            &marker,
            CONFLICT_DIRECTORY_MARKER_CONTENT,
            "portable conflict ownership marker",
        )?,
        Err(error) if error.kind() == std::io::ErrorKind::NotFound && created_by_this_call => {
            let mut file = OpenOptions::new()
                .create_new(true)
                .write(true)
                .open(&marker)
                .map_err(|e| format!("could not create portable conflict ownership marker: {e}"))?;
            file.write_all(CONFLICT_DIRECTORY_MARKER_CONTENT)
                .map_err(|e| format!("could not write portable conflict ownership marker: {e}"))?;
            file.sync_all()
                .map_err(|e| format!("could not flush portable conflict ownership marker: {e}"))?;
            sync_directory(&canonical)?;
            sync_directory(&state)?;
        }
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {
            return Err("portable conflict directory is missing its ownership marker".to_string())
        }
        Err(error) => {
            return Err(format!(
                "could not inspect portable conflict ownership marker: {error}"
            ))
        }
    }
    Ok(canonical)
}

#[derive(Debug)]
struct StateConflictArtifact {
    #[cfg(all(test, windows))]
    path: PathBuf,
    state_key: String,
    writer_key: String,
    bytes: u64,
}

fn is_lower_hex(value: &str, length: usize) -> bool {
    value.len() == length
        && value
            .as_bytes()
            .iter()
            .all(|byte| byte.is_ascii_digit() || matches!(*byte, b'a'..=b'f'))
}

fn parse_state_conflict_name(file_name: &str) -> Option<(String, String)> {
    let stem = file_name.strip_suffix(".json")?;
    let parts = stem.split('-').collect::<Vec<_>>();
    if parts.len() != 6
        || parts[0] != "v1"
        || !is_lower_hex(parts[1], 64)
        || !is_lower_hex(parts[2], 64)
        || parts[3].len() != 20
        || !parts[3].as_bytes().iter().all(u8::is_ascii_digit)
        || !is_lower_hex(parts[4], 64)
        || parts[5].len() != 2
        || !parts[5].as_bytes().iter().all(u8::is_ascii_digit)
    {
        return None;
    }
    Some((parts[1].to_string(), parts[2].to_string()))
}

fn state_conflict_artifacts(directory: &Path) -> Result<Vec<StateConflictArtifact>, String> {
    let mut artifacts = Vec::new();
    for entry in fs::read_dir(directory)
        .map_err(|e| format!("could not inspect portable state conflicts: {e}"))?
    {
        let entry = entry.map_err(|e| format!("could not inspect portable state conflict: {e}"))?;
        if entry.file_name() == CONFLICT_DIRECTORY_MARKER {
            continue;
        }
        let file_name = entry
            .file_name()
            .into_string()
            .map_err(|_| "portable conflict directory contains a non-UTF-8 entry".to_string())?;
        let Some((state_key, writer_key)) = parse_state_conflict_name(&file_name) else {
            return Err(format!(
                "portable conflict directory contains an unrecognized entry at {}",
                entry.path().to_string_lossy()
            ));
        };
        let metadata = fs::symlink_metadata(entry.path())
            .map_err(|e| format!("could not inspect portable state conflict: {e}"))?;
        if metadata.file_type().is_symlink() || !metadata.is_file() {
            return Err(format!(
                "portable conflict entry must be a real file at {}",
                entry.path().to_string_lossy()
            ));
        }
        artifacts.push(StateConflictArtifact {
            #[cfg(all(test, windows))]
            path: entry.path(),
            state_key,
            writer_key,
            bytes: metadata.len(),
        });
    }
    Ok(artifacts)
}

fn ensure_state_writer_conflict_capacity(
    directory: &Path,
    state_key: &str,
    writer_key: &str,
) -> Result<(), String> {
    let own_conflicts = state_conflict_artifacts(directory)?
        .into_iter()
        .filter(|artifact| artifact.state_key == state_key && artifact.writer_key == writer_key)
        .count();
    if own_conflicts >= MAX_STATE_CONFLICTS_PER_WRITER {
        return Err(format!(
            "portable state conflict recovery for this state and writer is full \
             ({MAX_STATE_CONFLICTS_PER_WRITER} files); review {} before retrying",
            directory.to_string_lossy()
        ));
    }
    Ok(())
}

fn ensure_state_conflict_capacity(directory: &Path, incoming_bytes: u64) -> Result<(), String> {
    if incoming_bytes > MAX_STATE_CONFLICT_BYTES_PER_VAULT {
        return Err("portable state conflict is larger than the Vault recovery budget".to_string());
    }
    let artifacts = state_conflict_artifacts(directory)?;
    let total_bytes = artifacts
        .iter()
        .try_fold(0u64, |total, artifact| total.checked_add(artifact.bytes))
        .ok_or_else(|| "portable state conflict byte accounting overflowed".to_string())?;
    let exceeds_count = artifacts.len() >= MAX_STATE_CONFLICTS_PER_VAULT;
    let exceeds_bytes = total_bytes
        .checked_add(incoming_bytes)
        .is_none_or(|total| total > MAX_STATE_CONFLICT_BYTES_PER_VAULT);
    if exceeds_count || exceeds_bytes {
        return Err(format!(
            "portable state conflict recovery is full ({} files or {} bytes); \
             review {} before retrying",
            MAX_STATE_CONFLICTS_PER_VAULT,
            MAX_STATE_CONFLICT_BYTES_PER_VAULT,
            directory.to_string_lossy()
        ));
    }
    Ok(())
}

fn preserve_state_conflict(
    root: &Path,
    name: &str,
    json: &str,
    writer_id: &str,
    recovery_token: &str,
) -> Result<String, String> {
    let writer_id = validated_conflict_component(writer_id, "writer id")?;
    let recovery_token = validated_conflict_component(recovery_token, "recovery token")?;
    let directory = conflict_directory(root)?;
    let state_key = content_revision(name.as_bytes());
    let writer_key = content_revision(writer_id.as_bytes());
    let recovery_key = content_revision(recovery_token.as_bytes());
    ensure_state_writer_conflict_capacity(&directory, &state_key, &writer_key)?;
    ensure_state_conflict_capacity(&directory, json.len() as u64)?;
    let staging_directory = directory
        .parent()
        .ok_or_else(|| "portable conflict directory has no state parent".to_string())?;
    let timestamp = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .map_err(|_| "system clock is before the Unix epoch".to_string())?
        .as_nanos();

    for attempt in 0..32u8 {
        let file_name =
            format!("v1-{state_key}-{writer_key}-{timestamp:020}-{recovery_key}-{attempt:02}.json");
        let path = directory.join(file_name);
        let PreparedReplacement {
            path: replacement, ..
        } = prepared_temp_path_in(staging_directory, json.as_bytes(), None)?;
        match publish_sidecar_noclobber(replacement, &path) {
            Ok(()) => {
                sync_directory(&directory)?;
                return path_as_renderer_utf8(&path);
            }
            Err(error) if error.error.kind() == std::io::ErrorKind::AlreadyExists => {
                drop(error.path);
            }
            Err(error) => {
                let message = format!(
                    "could not preserve portable state conflict: {}",
                    error.error
                );
                drop(error.path);
                return Err(message);
            }
        }
    }
    Err("could not reserve a unique portable state conflict path".to_string())
}

fn write_vault_state_if_revision_at(
    root: &Path,
    name: &str,
    json: &str,
    expected_revision: Option<&str>,
    writer_id: &str,
    recovery_token: &str,
) -> Result<VaultStateWriteOutcome, String> {
    if json.len() > MAX_STATE_BYTES {
        return Err("portable state payload is too large".to_string());
    }
    serde_json::from_str::<serde_json::Value>(json)
        .map_err(|e| format!("portable state is not valid JSON: {e}"))?;
    validated_conflict_component(writer_id, "writer id")?;
    validated_conflict_component(recovery_token, "recovery token")?;
    let _write_lock = lock_library_writes(root)?;

    let current = read_vault_state_versioned_at(root, name)?;
    let next_revision = content_revision(json.as_bytes());

    // A crash can happen after the atomic replacement but before the renderer
    // clears its recovery journal. Identical bytes are already durable even
    // when the journal still carries an older expectation.
    if current.revision.as_deref() == Some(next_revision.as_str()) {
        let verified = sync_and_verify_committed_revision(
            &state_file_path(root, name)?,
            MAX_STATE_BYTES as u64,
        )?;
        if verified.as_deref() == Some(next_revision.as_str()) {
            return Ok(VaultStateWriteOutcome::Saved {
                revision: next_revision,
            });
        }
        let (conflict_path, preservation_error) =
            match preserve_state_conflict(root, name, json, writer_id, recovery_token) {
                Ok(path) => (Some(path), None),
                Err(error) => (None, Some(error)),
            };
        return Ok(VaultStateWriteOutcome::Conflict {
            expected_revision: expected_revision.map(ToOwned::to_owned),
            actual_revision: verified,
            conflict_path,
            preservation_error,
        });
    }

    if current.revision.as_deref() != expected_revision {
        let (conflict_path, preservation_error) =
            match preserve_state_conflict(root, name, json, writer_id, recovery_token) {
                Ok(path) => (Some(path), None),
                Err(error) => (None, Some(error)),
            };
        return Ok(VaultStateWriteOutcome::Conflict {
            expected_revision: expected_revision.map(ToOwned::to_owned),
            actual_revision: current.revision,
            conflict_path,
            preservation_error,
        });
    }

    let path = state_file_path(root, name)?;
    match conditional_atomic_write(
        &path,
        json.as_bytes(),
        expected_revision,
        false,
        false,
        RecoveryClass::PortableState,
    )? {
        RevisionWriteOutcome::Saved { revision } => Ok(VaultStateWriteOutcome::Saved { revision }),
        RevisionWriteOutcome::Conflict { actual_revision } => {
            // A provider does not honor Verto's advisory lock. The conditional
            // writer restores any file displaced after the revision check,
            // while this sidecar keeps the unsaved local state recoverable.
            let (conflict_path, preservation_error) =
                match preserve_state_conflict(root, name, json, writer_id, recovery_token) {
                    Ok(path) => (Some(path), None),
                    Err(error) => (None, Some(error)),
                };
            Ok(VaultStateWriteOutcome::Conflict {
                expected_revision: expected_revision.map(ToOwned::to_owned),
                actual_revision,
                conflict_path,
                preservation_error,
            })
        }
    }
}

#[cfg(test)]
fn write_vault_state_unlocked_at(root: &Path, name: &str, json: &str) -> Result<(), String> {
    if json.len() > MAX_STATE_BYTES {
        return Err("portable state payload is too large".to_string());
    }
    serde_json::from_str::<serde_json::Value>(json)
        .map_err(|e| format!("portable state is not valid JSON: {e}"))?;
    let directory = state_directory(root, true)?
        .ok_or_else(|| "portable state directory is unavailable".to_string())?;
    let candidate = state_file_path(root, name)?;
    match fs::symlink_metadata(&candidate) {
        Ok(metadata) if metadata.file_type().is_symlink() => {
            return Err("portable state file must not be a symbolic link".to_string())
        }
        Ok(metadata) if !metadata.is_file() => {
            return Err("portable state path is not a file".to_string())
        }
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => {}
        Err(error) => return Err(format!("could not inspect portable state: {error}")),
    }
    let path = directory.join(
        candidate
            .file_name()
            .ok_or_else(|| "portable state path has no file name".to_string())?,
    );
    atomic_write(&path, json.as_bytes())
}

#[cfg(test)]
fn write_vault_state_at(root: &Path, name: &str, json: &str) -> Result<(), String> {
    let _write_lock = lock_library_writes(root)?;
    write_vault_state_unlocked_at(root, name, json)
}

#[tauri::command]
async fn pick_local_library(
    app: tauri::AppHandle,
    roots: State<'_, AuthorizedRoots>,
) -> Result<Option<String>, String> {
    let selected = app
        .dialog()
        .file()
        .set_title("Choose a Verto library")
        .blocking_pick_folder();
    let Some(selected) = selected else {
        return Ok(None);
    };
    let path = selected
        .into_path()
        .map_err(|e| format!("could not read selected library path: {e}"))?;
    let canonical = canonical_library_root(&path_as_utf8(&path)?)?;
    register_authorized_root(&roots, canonical.clone())?;
    Ok(Some(path_as_renderer_utf8(&canonical)?))
}

#[tauri::command]
fn get_active_local_library(
    renderer_folder: Option<String>,
    roots: State<'_, AuthorizedRoots>,
) -> Result<ActiveLocalLibraryStatus, String> {
    let registry = roots
        .inner
        .lock()
        .map_err(|_| "authorized library registry is unavailable".to_string())?
        .clone();
    let Some(active) = registry.active.as_ref() else {
        return Ok(ActiveLocalLibraryStatus {
            folder: None,
            available: false,
            renderer_matches_active: false,
        });
    };
    let folder = path_as_renderer_utf8(active)?;
    let available = registry.recent.iter().any(|candidate| candidate == active)
        && canonical_library_root(&path_as_utf8(active)?)
            .map(|canonical| canonical == *active)
            .unwrap_or(false);
    let renderer_matches_active = renderer_folder
        .as_deref()
        .and_then(|selector| canonical_library_root(selector).ok())
        .map(|canonical| canonical == *active)
        .unwrap_or(false);
    Ok(ActiveLocalLibraryStatus {
        folder: Some(folder),
        available,
        renderer_matches_active,
    })
}

#[tauri::command]
fn activate_local_library(
    folder: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<ActivatedLocalLibrary, String> {
    let root = activate_authorized_root(&roots, &folder)?;
    Ok(ActivatedLocalLibrary {
        folder: path_as_renderer_utf8(&root)?,
        inspection: inspect_local_dir_at(&root),
    })
}

#[tauri::command]
fn inspect_local_dir(
    folder: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<FolderInspection, String> {
    let root = authorized_active_root(&roots, &folder)?;
    Ok(inspect_local_dir_at(&root))
}

#[tauri::command]
fn list_local_dir(
    folder: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<Vec<LocalFileEntry>, String> {
    let root = authorized_active_root(&roots, &folder)?;
    Ok(list_local_dir_at(&root))
}

#[tauri::command]
fn read_local_file(
    root: String,
    id: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<String, String> {
    let root = authorized_active_root(&roots, &root)?;
    read_local_file_at(&root, &id)
}

#[tauri::command]
fn read_local_file_versioned(
    root: String,
    id: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<VersionedLocalFile, String> {
    let root = authorized_active_root(&roots, &root)?;
    read_local_file_versioned_at(&root, &id)
}

#[tauri::command]
fn write_local_file(
    root: String,
    id: String,
    content: String,
    expected_revision: Option<String>,
    force: Option<bool>,
    roots: State<'_, AuthorizedRoots>,
) -> Result<LocalFileWriteOutcome, String> {
    let root = authorized_active_root(&roots, &root)?;
    write_local_file_if_revision_at(
        &root,
        &id,
        &content,
        expected_revision.as_deref(),
        force.unwrap_or(false),
    )
}

#[tauri::command]
fn start_vault_watch(
    app: tauri::AppHandle,
    root: String,
    roots: State<'_, AuthorizedRoots>,
    watcher: State<'_, VaultWatchState>,
) -> Result<VaultWatchSession, String> {
    let root = authorized_active_root(&roots, &root)?;
    let renderer_root = path_as_renderer_utf8(&root)?;
    watcher.start(app, root, renderer_root)
}

#[tauri::command]
fn stop_vault_watch(generation: u64, watcher: State<'_, VaultWatchState>) -> Result<(), String> {
    watcher.stop(generation)
}

#[tauri::command]
fn read_vault_state_versioned(
    root: String,
    name: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<VersionedVaultState, String> {
    let root = authorized_active_root(&roots, &root)?;
    read_vault_state_versioned_at(&root, &name)
}

#[tauri::command]
fn write_vault_state_if_revision(
    root: String,
    name: String,
    json: String,
    expected_revision: Option<String>,
    writer_id: String,
    recovery_token: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<VaultStateWriteOutcome, String> {
    let root = authorized_active_root(&roots, &root)?;
    write_vault_state_if_revision_at(
        &root,
        &name,
        &json,
        expected_revision.as_deref(),
        &writer_id,
        &recovery_token,
    )
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .setup(|app| {
            let file = app
                .path()
                .app_data_dir()?
                .join("authorized-libraries-v1.json");
            let registry = load_authorized_roots(&file);
            app.manage(AuthorizedRoots {
                file,
                inner: Mutex::new(registry),
            });
            app.manage(VaultWatchState::default());
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_local_library,
            get_active_local_library,
            activate_local_library,
            inspect_local_dir,
            list_local_dir,
            read_local_file,
            read_local_file_versioned,
            write_local_file,
            start_vault_watch,
            stop_vault_watch,
            read_vault_state_versioned,
            write_vault_state_if_revision
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
