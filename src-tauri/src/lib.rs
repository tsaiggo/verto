// Library entry point for the Verto desktop shell.
//
// Tauri's recommended layout puts most of the runtime here so that the
// crate can also be linked into mobile targets later if needed. The
// binary in `main.rs` simply forwards to `run()`.

use std::fs;
use std::path::PathBuf;

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

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_dialog::init())
        .invoke_handler(tauri::generate_handler![auth_save, auth_load, auth_clear])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
