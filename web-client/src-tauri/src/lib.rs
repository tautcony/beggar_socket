use std::path::PathBuf;

#[tauri::command]
fn save_binary_file(suggested_filename: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
  let mut dialog = rfd::FileDialog::new();
  if !suggested_filename.trim().is_empty() {
    dialog = dialog.set_file_name(&suggested_filename);
  }

  let Some(target_path) = dialog.save_file() else {
    return Ok(None);
  };

  std::fs::write(&target_path, bytes)
    .map_err(|error| format!("Failed to save file to {}: {}", display_path(&target_path), error))?;

  Ok(Some(display_path(&target_path)))
}

fn display_path(path: &PathBuf) -> String {
  path.to_string_lossy().into_owned()
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .plugin(tauri_plugin_serialplugin::init())
    .invoke_handler(tauri::generate_handler![save_binary_file])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
