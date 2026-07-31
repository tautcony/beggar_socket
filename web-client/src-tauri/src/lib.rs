mod native_platform;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
  tauri::Builder::default()
    .manage(native_platform::NativePlatformState::default())
    .invoke_handler(tauri::generate_handler![
      native_platform::native_list_serial_ports,
      native_platform::native_open_serial_port,
      native_platform::native_serial_write,
      native_platform::native_serial_read,
      native_platform::native_serial_set_signals,
      native_platform::native_serial_flush_input,
      native_platform::native_serial_close,
      native_platform::save_binary_file,
      native_platform::native_runtime_metadata,
    ])
    .run(tauri::generate_context!())
    .expect("error while running tauri application");
}
