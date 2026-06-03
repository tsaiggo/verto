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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![
            auth_save,
            auth_load,
            auth_clear,
            inspect_local_dir
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
