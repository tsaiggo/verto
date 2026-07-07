// Library entry point for the Verto desktop shell.
//
// Tauri's recommended layout puts most of the runtime here so that the
// crate can also be linked into mobile targets later if needed. The
// binary in `main.rs` simply forwards to `run()`.

use std::fs;
use std::path::PathBuf;

use serde::Serialize;
use tauri::Manager;

/// Name of the file the GitHub auth blob is persisted to, inside the app's
/// per-user data directory (e.g. `~/Library/Application Support/
/// com.tsaiggo.verto/` on macOS, `$APPDATA/com.tsaiggo.verto/` on Windows).
const AUTH_FILE: &str = "auth.json";

/// Resolve the absolute path of the auth file, creating the parent app-data
/// directory if it does not yet exist.
fn auth_path(app: &tauri::AppHandle) -> Result<PathBuf, String> {
    let dir = app
        .path()
        .app_data_dir()
        .map_err(|e| format!("could not resolve app data dir: {e}"))?;
    if !dir.exists() {
        fs::create_dir_all(&dir)
            .map_err(|e| format!("could not create app data dir: {e}"))?;
    }
    Ok(dir.join(AUTH_FILE))
}

/// Restrict the auth file to the owner on Unix (mode 0600). No-op elsewhere.
#[cfg(unix)]
fn restrict_permissions(path: &std::path::Path) -> Result<(), String> {
    use std::os::unix::fs::PermissionsExt;
    let perms = fs::Permissions::from_mode(0o600);
    fs::set_permissions(path, perms)
        .map_err(|e| format!("could not set auth file permissions: {e}"))
}

#[cfg(not(unix))]
fn restrict_permissions(_path: &std::path::Path) -> Result<(), String> {
    Ok(())
}

/// Persist the GitHub auth blob (a JSON string) to the host auth file.
#[tauri::command]
fn auth_save(app: tauri::AppHandle, data: String) -> Result<(), String> {
    let path = auth_path(&app)?;
    fs::write(&path, data).map_err(|e| format!("could not write auth file: {e}"))?;
    restrict_permissions(&path)?;
    Ok(())
}

/// Read the persisted auth blob, returning `None` when the file is absent.
#[tauri::command]
fn auth_load(app: tauri::AppHandle) -> Result<Option<String>, String> {
    let path = auth_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let contents =
        fs::read_to_string(&path).map_err(|e| format!("could not read auth file: {e}"))?;
    Ok(Some(contents))
}

/// Delete the persisted auth blob (sign out). Succeeds even if it is absent.
#[tauri::command]
fn auth_clear(app: tauri::AppHandle) -> Result<(), String> {
    let path = auth_path(&app)?;
    if path.exists() {
        fs::remove_file(&path).map_err(|e| format!("could not delete auth file: {e}"))?;
    }
    Ok(())
}

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

/// True when `name` is a readable content file (`.md` / `.mdx`), matching the
/// build-time local source's rules.
fn is_readable_name(name: &str) -> bool {
    let lower = name.to_ascii_lowercase();
    lower.ends_with(".md") || lower.ends_with(".mdx")
}

/// Recursively count readable files beneath `dir`, collecting up to
/// `INSPECT_SAMPLE_LIMIT` relative sample paths. Dotfiles / dot-directories are
/// skipped, mirroring the build-time walker. Unreadable subdirectories are
/// silently ignored so a single permission error never aborts the scan.
fn scan_readable(dir: &std::path::Path, rel: &str, count: &mut usize, samples: &mut Vec<String>) {
    let entries = match fs::read_dir(dir) {
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
            Ok(ft) if ft.is_dir() => scan_readable(&entry.path(), &child_rel, count, samples),
            Ok(ft) if ft.is_file() && is_readable_name(&name) => {
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
    dir: &std::path::Path,
    rel: &[String],
    files: &mut Vec<LocalFileEntry>,
) {
    let entries = match fs::read_dir(dir) {
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
            Ok(ft) if ft.is_dir() => collect_readable_files(&entry.path(), &child_rel, files),
            Ok(ft) if ft.is_file() && is_readable_name(&name) => {
                let metadata = entry.metadata().ok();
                let mtime = metadata
                    .as_ref()
                    .and_then(|m| m.modified().ok())
                    .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                    .and_then(|d| u64::try_from(d.as_millis()).ok());
                files.push(LocalFileEntry {
                    path: child_rel,
                    id: entry.path().to_string_lossy().to_string(),
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
    use std::time::{SystemTime, UNIX_EPOCH};

    fn temp_test_dir() -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .expect("system clock should be after unix epoch")
            .as_nanos();
        std::env::temp_dir().join(format!("verto-local-list-{unique}"))
    }

    #[test]
    fn list_local_dir_returns_readable_markdown_entries() {
        let root = temp_test_dir();
        let docs = root.join("docs");
        let hidden = root.join(".hidden");
        fs::create_dir_all(&docs).expect("create docs dir");
        fs::create_dir_all(&hidden).expect("create hidden dir");
        fs::write(root.join("intro.md"), "# Intro").expect("write intro");
        fs::write(docs.join("guide.mdx"), "# Guide").expect("write guide");
        fs::write(root.join("cover.png"), "binary").expect("write image");
        fs::write(hidden.join("secret.md"), "# Secret").expect("write hidden");

        let mut paths: Vec<String> = list_local_dir(root.to_string_lossy().to_string())
            .into_iter()
            .map(|entry| entry.path.join("/"))
            .collect();
        paths.sort();

        fs::remove_dir_all(&root).expect("remove temp dir");
        assert_eq!(paths, vec!["docs/guide.mdx", "intro.md"]);
    }

    #[test]
    fn read_local_file_returns_markdown_text() {
        let root = temp_test_dir();
        fs::create_dir_all(&root).expect("create temp dir");
        let file = root.join("README.md");
        fs::write(&file, "# Runtime README").expect("write markdown");

        let text = read_local_file(file.to_string_lossy().to_string()).expect("read markdown");

        fs::remove_dir_all(&root).expect("remove temp dir");
        assert_eq!(text, "# Runtime README");
    }

    #[test]
    fn read_local_file_rejects_non_markdown_files() {
        let root = temp_test_dir();
        fs::create_dir_all(&root).expect("create temp dir");
        let file = root.join("secret.txt");
        fs::write(&file, "secret").expect("write text");

        let result = read_local_file(file.to_string_lossy().to_string());

        fs::remove_dir_all(&root).expect("remove temp dir");
        assert!(result.is_err());
    }
}

/// Inspect a host folder for readable `.md` / `.mdx` files so the "Local Files"
/// panel can give real feedback after a folder is chosen. Never errors for a
/// missing or non-directory path — it reports that via the returned struct.
#[tauri::command]
fn inspect_local_dir(folder: String) -> FolderInspection {
    let path = PathBuf::from(folder.trim());
    let meta = fs::metadata(&path);
    let (exists, is_dir) = match &meta {
        Ok(m) => (true, m.is_dir()),
        Err(_) => (false, false),
    };
    let mut file_count = 0usize;
    let mut samples = Vec::new();
    if is_dir {
        scan_readable(&path, "", &mut file_count, &mut samples);
    }
    FolderInspection {
        exists,
        is_dir,
        file_count,
        samples,
    }
}

/// List every readable `.md` / `.mdx` file below a selected host folder for the
/// runtime Library rail. Missing/non-directory paths report an empty list rather
/// than throwing, matching the forgiving inspection command.
#[tauri::command]
fn list_local_dir(folder: String) -> Vec<LocalFileEntry> {
    let path = PathBuf::from(folder.trim());
    let mut files = Vec::new();
    if fs::metadata(&path).map(|m| m.is_dir()).unwrap_or(false) {
        collect_readable_files(&path, &[], &mut files);
    }
    files
}

#[tauri::command]
fn read_local_file(id: String) -> Result<String, String> {
    let path = PathBuf::from(id.trim());
    let name = path
        .file_name()
        .and_then(|n| n.to_str())
        .ok_or_else(|| "file name is not valid UTF-8".to_string())?;
    if !is_readable_name(name) {
        return Err("only .md and .mdx files can be opened".to_string());
    }
    let meta = fs::metadata(&path).map_err(|e| format!("could not read file metadata: {e}"))?;
    if !meta.is_file() {
        return Err("selected path is not a file".to_string());
    }
    fs::read_to_string(&path).map_err(|e| format!("could not read file: {e}"))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .invoke_handler(tauri::generate_handler![
            auth_save,
            auth_load,
            auth_clear,
            inspect_local_dir,
            list_local_dir,
            read_local_file
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
