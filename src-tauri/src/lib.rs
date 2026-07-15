// Library entry point for the Verto desktop shell.
//
// Tauri's recommended layout puts most of the runtime here so that the
// crate can also be linked into mobile targets later if needed. The
// binary in `main.rs` simply forwards to `run()`.

use std::collections::HashSet;
use std::fs;
use std::io::{Read, Write};
use std::path::{Component, Path, PathBuf};
use std::sync::Mutex;

use serde::{Deserialize, Serialize};
use tauri::{Manager, State};
use tauri_plugin_dialog::DialogExt;

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
}

/// Number of sample paths surfaced for a friendly preview.
const INSPECT_SAMPLE_LIMIT: usize = 5;
const AUTHORIZED_ROOTS_VERSION: u8 = 1;
const MAX_AUTHORIZED_ROOTS: usize = 8;
const MAX_STATE_BYTES: usize = 8 * 1024 * 1024;

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
    Ok(())
}

/// Atomically replace user-authored Markdown without silently changing its
/// existing mode or bypassing an explicit read-only flag. State and registry
/// files intentionally keep `atomic_write`'s private temporary-file defaults.
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
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".mdx")
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
        return Err("local library is not authorized; choose it with the native picker".to_string());
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
        || !registry.recent.iter().any(|candidate| candidate == &canonical)
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
    let link_metadata = fs::symlink_metadata(candidate)
        .map_err(|e| format!("could not inspect file: {e}"))?;
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

fn ensure_no_symlink_components(root: &Path, path: &Path) -> Result<(), String> {
    let relative = path
        .strip_prefix(root)
        .map_err(|_| "requested file is outside the active local library".to_string())?;
    let mut current = root.to_path_buf();
    for component in relative.components() {
        if let Component::Normal(part) = component {
            current.push(part);
            match fs::symlink_metadata(&current) {
                Ok(metadata) if metadata.file_type().is_symlink() => {
                    return Err("symbolic-link paths cannot be written".to_string())
                }
                Ok(_) => {}
                Err(error) if error.kind() == std::io::ErrorKind::NotFound => break,
                Err(error) => return Err(format!("could not inspect target path: {error}")),
            }
        }
    }
    Ok(())
}

fn canonical_markdown_file(
    root: &Path,
    candidate: &Path,
    action: &str,
) -> Result<PathBuf, String> {
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
        requested
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
            if part.starts_with('.') {
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
    ensure_no_symlink_components(root, candidate)?;
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
    let canonical_parent = fs::canonicalize(parent)
        .map_err(|e| format!("could not resolve target directory: {e}"))?;
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
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
            continue;
        }
        let child_rel = if rel.is_empty() {
            name.clone()
        } else {
            format!("{rel}/{name}")
        };
        match entry.file_type() {
            Ok(ft) if ft.is_dir() => scan_readable(
                root,
                &entry.path(),
                &child_rel,
                count,
                samples,
                visited,
            ),
            Ok(ft) if ft.is_file() && is_readable_name(&name) => {
                let Some(path) = confined_scan_path(root, &entry.path()) else {
                    continue;
                };
                if !fs::metadata(path)
                    .map(|metadata| metadata.is_file())
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
        let name = entry.file_name().to_string_lossy().to_string();
        if name.starts_with('.') {
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
                let metadata = fs::metadata(&path).ok().filter(|metadata| metadata.is_file());
                if metadata.is_none() {
                    continue;
                }
                let mtime = metadata
                    .as_ref()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .and_then(|d| u64::try_from(d.as_millis()).ok());
                files.push(LocalFileEntry {
                    path: child_rel,
                    id: path.to_string_lossy().to_string(),
                    size: metadata.as_ref().map(|m| m.len()),
                    mtime,
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
        TempTestDir(path)
    }

    #[test]
    fn list_local_dir_returns_readable_markdown_entries() {
        let root = temp_test_dir();
        let docs = root.path().join("docs");
        let hidden = root.path().join(".hidden");
        fs::create_dir_all(&docs).expect("create docs dir");
        fs::create_dir_all(&hidden).expect("create hidden dir");
        fs::write(root.path().join("intro.md"), "# Intro").expect("write intro");
        fs::write(docs.join("guide.mdx"), "# Guide").expect("write guide");
        fs::write(root.path().join("cover.png"), "binary").expect("write image");
        fs::write(hidden.join("secret.md"), "# Secret").expect("write hidden");

        let mut paths: Vec<String> = list_local_dir_at(root.path())
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

        let text = read_local_file_at(root.path(), &file.to_string_lossy())
            .expect("read markdown");

        assert_eq!(text, "# Runtime README");
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
        let traversal = library
            .join("new")
            .join("..")
            .join("..")
            .join("escaped.md");

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
            fs::metadata(&note).expect("note metadata").permissions().mode() & 0o777,
            0o640
        );

        fs::set_permissions(&note, fs::Permissions::from_mode(0o440)).expect("set read-only mode");
        assert!(write_local_file_at(root.path(), &note.to_string_lossy(), "blocked").is_err());
        assert_eq!(fs::read_to_string(&note).expect("read unchanged note"), "after");
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
        symlink(&victim, library.join(".verto").join("bookmarks.json"))
            .expect("link state file");

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
    let meta = fs::metadata(&path);
    let (exists, is_dir) = match &meta {
        Ok(m) => (true, m.is_dir()),
        Err(_) => (false, false),
    };
    let mut file_count = 0usize;
    let mut samples = Vec::new();
    if is_dir {
        if let Ok(root) = fs::canonicalize(&path) {
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
    let path = canonical_markdown_file(root, &candidate, "opened")?;
    fs::read_to_string(&path).map_err(|e| format!("could not read file: {e}"))
}

fn write_local_file_at(root: &Path, id: &str, content: &str) -> Result<(), String> {
    let candidate = candidate_path(root, id)?;
    ensure_visible_content_path(root, &candidate)?;
    readable_file_name(&candidate, "written")?;
    let path = confined_write_target(root, &candidate)?;
    atomic_write_markdown(&path, content.as_bytes())
        .map_err(|e| format!("could not write file: {e}"))
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
        Err(error) => return Err(format!("could not inspect portable state directory: {error}")),
    }

    let canonical = fs::canonicalize(&candidate)
        .map_err(|e| format!("could not resolve portable state directory: {e}"))?;
    ensure_within_library(root, &canonical)?;
    if canonical != candidate {
        return Err("portable state directory must resolve directly inside the library".to_string());
    }
    Ok(Some(canonical))
}

fn read_vault_state_at(root: &Path, name: &str) -> Result<Option<String>, String> {
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
    let file = fs::File::open(&path).map_err(|e| format!("could not read portable state: {e}"))?;
    if file
        .metadata()
        .map_err(|e| format!("could not inspect portable state: {e}"))?
        .len()
        > MAX_STATE_BYTES as u64
    {
        return Err("portable state file is too large".to_string());
    }
    let mut bytes = Vec::new();
    file.take(MAX_STATE_BYTES as u64 + 1)
        .read_to_end(&mut bytes)
        .map_err(|e| format!("could not read portable state: {e}"))?;
    if bytes.len() > MAX_STATE_BYTES {
        return Err("portable state file is too large".to_string());
    }
    let raw = String::from_utf8(bytes)
        .map_err(|_| "portable state is not valid UTF-8".to_string())?;
    serde_json::from_str::<serde_json::Value>(&raw)
        .map_err(|e| format!("portable state is not valid JSON: {e}"))?;
    Ok(Some(raw))
}

fn write_vault_state_at(root: &Path, name: &str, json: &str) -> Result<(), String> {
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
fn write_local_file(
    root: String,
    id: String,
    content: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<(), String> {
    let root = authorized_active_root(&roots, &root)?;
    write_local_file_at(&root, &id, &content)
}

#[tauri::command]
fn read_vault_state(
    root: String,
    name: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<Option<String>, String> {
    let root = authorized_active_root(&roots, &root)?;
    read_vault_state_at(&root, &name)
}

#[tauri::command]
fn write_vault_state(
    root: String,
    name: String,
    json: String,
    roots: State<'_, AuthorizedRoots>,
) -> Result<(), String> {
    let root = authorized_active_root(&roots, &root)?;
    write_vault_state_at(&root, &name, &json)
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
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            pick_local_library,
            get_active_local_library,
            activate_local_library,
            inspect_local_dir,
            list_local_dir,
            read_local_file,
            write_local_file,
            read_vault_state,
            write_vault_state
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
