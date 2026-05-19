// Library entry point for the Verto desktop shell.
//
// Tauri's recommended layout puts most of the runtime here so that the
// crate can also be linked into mobile targets later if needed. The
// binary in `main.rs` simply forwards to `run()`.

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_process::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
