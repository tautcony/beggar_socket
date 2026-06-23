use serde::Serialize;
use serialport::{ClearBuffer, DataBits, FlowControl, Parity, SerialPort, SerialPortType, StopBits};
use std::{
  collections::HashMap,
  io::{ErrorKind, Read, Write},
  path::PathBuf,
  sync::{
    atomic::{AtomicU64, Ordering},
    Mutex,
  },
  time::{Duration, Instant},
};

const DEFAULT_BAUD_RATE: u32 = 9_600;
const DEFAULT_IO_TIMEOUT_MS: u64 = 1_000;

pub struct NativePlatformState {
  next_session_id: AtomicU64,
  serial_sessions: Mutex<HashMap<u64, SerialSession>>,
}

impl Default for NativePlatformState {
  fn default() -> Self {
    Self {
      next_session_id: AtomicU64::new(1),
      serial_sessions: Mutex::new(HashMap::new()),
    }
  }
}

struct SerialSession {
  path: String,
  port: Box<dyn SerialPort>,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSerialPortInfo {
  path: String,
  manufacturer: Option<String>,
  product: Option<String>,
  serial_number: Option<String>,
  vendor_id: Option<String>,
  product_id: Option<String>,
  port_type: String,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct NativeSerialSessionInfo {
  session_id: u64,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RuntimeMetadata {
  app_name: String,
  app_version: String,
  identifier: String,
  tauri_version: String,
  os: String,
  arch: String,
}

#[tauri::command]
pub fn native_list_serial_ports() -> Result<Vec<NativeSerialPortInfo>, String> {
  let ports = serialport::available_ports().map_err(|error| error.to_string())?;
  Ok(ports.into_iter().map(NativeSerialPortInfo::from).collect())
}

#[tauri::command]
pub fn native_open_serial_port(
  state: tauri::State<'_, NativePlatformState>,
  path: String,
) -> Result<NativeSerialSessionInfo, String> {
  let port = serialport::new(&path, DEFAULT_BAUD_RATE)
    .data_bits(DataBits::Eight)
    .flow_control(FlowControl::None)
    .parity(Parity::None)
    .stop_bits(StopBits::One)
    .timeout(Duration::from_millis(DEFAULT_IO_TIMEOUT_MS))
    .open()
    .map_err(|error| format!("Failed to open serial port {path}: {error}"))?;

  let session_id = state.next_session_id.fetch_add(1, Ordering::Relaxed);
  let mut sessions = lock_sessions(&state)?;
  sessions.insert(session_id, SerialSession { path, port });

  Ok(NativeSerialSessionInfo { session_id })
}

#[tauri::command]
pub fn native_serial_write(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
  bytes: Vec<u8>,
  timeout_ms: Option<u64>,
) -> Result<(), String> {
  with_session(&state, session_id, |session| {
    session
      .port
      .set_timeout(Duration::from_millis(timeout_ms.unwrap_or(DEFAULT_IO_TIMEOUT_MS)))
      .map_err(|error| format!("Failed to set serial timeout for {}: {error}", session.path))?;
    session
      .port
      .write_all(&bytes)
      .map_err(|error| format!("Failed to write serial data to {}: {error}", session.path))?;
    session
      .port
      .flush()
      .map_err(|error| format!("Failed to flush serial data to {}: {error}", session.path))
  })
}

#[tauri::command]
pub fn native_serial_read(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
  length: usize,
  timeout_ms: Option<u64>,
) -> Result<Vec<u8>, String> {
  with_session(&state, session_id, |session| {
    let timeout_ms = timeout_ms.unwrap_or(DEFAULT_IO_TIMEOUT_MS);
    let started_at = Instant::now();
    let mut buffer = vec![0_u8; length];
    let mut offset = 0;

    while offset < length {
      let elapsed_ms = started_at.elapsed().as_millis() as u64;
      if elapsed_ms >= timeout_ms {
        return Err(format!(
          "Read package timeout in {timeout_ms}ms for {}",
          session.path
        ));
      }

      let remaining_timeout = timeout_ms.saturating_sub(elapsed_ms).max(1);
      session
        .port
        .set_timeout(Duration::from_millis(remaining_timeout))
        .map_err(|error| format!("Failed to set serial timeout for {}: {error}", session.path))?;

      match session.port.read(&mut buffer[offset..]) {
        Ok(0) => {
          return Err(format!(
            "Read package returned no data for {}",
            session.path
          ));
        }
        Ok(bytes_read) => {
          offset += bytes_read;
        }
        Err(error) if error.kind() == ErrorKind::TimedOut => {
          return Err(format!(
            "Read package timeout in {timeout_ms}ms for {}",
            session.path
          ));
        }
        Err(error) => {
          return Err(format!(
            "Failed to read serial data from {}: {error}",
            session.path
          ));
        }
      }
    }

    Ok(buffer)
  })
}

#[tauri::command]
pub fn native_serial_set_signals(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
  data_terminal_ready: Option<bool>,
  request_to_send: Option<bool>,
) -> Result<(), String> {
  with_session(&state, session_id, |session| {
    if let Some(value) = data_terminal_ready {
      session
        .port
        .write_data_terminal_ready(value)
        .map_err(|error| format!("Failed to set DTR for {}: {error}", session.path))?;
    }
    if let Some(value) = request_to_send {
      session
        .port
        .write_request_to_send(value)
        .map_err(|error| format!("Failed to set RTS for {}: {error}", session.path))?;
    }
    Ok(())
  })
}

#[tauri::command]
pub fn native_serial_flush_input(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
) -> Result<(), String> {
  with_session(&state, session_id, |session| {
    session
      .port
      .clear(ClearBuffer::Input)
      .map_err(|error| format!("Failed to clear input buffer for {}: {error}", session.path))
  })
}

#[tauri::command]
pub fn native_serial_close(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
) -> Result<(), String> {
  let mut sessions = lock_sessions(&state)?;
  sessions
    .remove(&session_id)
    .map(|_| ())
    .ok_or_else(|| format!("Serial session {session_id} is not open"))
}

#[tauri::command]
pub fn save_binary_file(suggested_filename: String, bytes: Vec<u8>) -> Result<Option<String>, String> {
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

#[tauri::command]
pub fn native_runtime_metadata(app: tauri::AppHandle) -> RuntimeMetadata {
  let package_info = app.package_info();
  RuntimeMetadata {
    app_name: package_info.name.clone(),
    app_version: package_info.version.to_string(),
    identifier: app.config().identifier.clone(),
    tauri_version: tauri::VERSION.to_string(),
    os: std::env::consts::OS.to_string(),
    arch: std::env::consts::ARCH.to_string(),
  }
}

fn lock_sessions<'a>(
  state: &'a tauri::State<'_, NativePlatformState>,
) -> Result<std::sync::MutexGuard<'a, HashMap<u64, SerialSession>>, String> {
  state
    .serial_sessions
    .lock()
    .map_err(|_| "Native serial session state is poisoned".to_string())
}

fn with_session<T>(
  state: &tauri::State<'_, NativePlatformState>,
  session_id: u64,
  operation: impl FnOnce(&mut SerialSession) -> Result<T, String>,
) -> Result<T, String> {
  let mut sessions = lock_sessions(state)?;
  let session = sessions
    .get_mut(&session_id)
    .ok_or_else(|| format!("Serial session {session_id} is not open"))?;
  operation(session)
}

fn display_path(path: &PathBuf) -> String {
  path.to_string_lossy().into_owned()
}

fn hex_u16(value: u16) -> String {
  format!("{value:04x}")
}

impl From<serialport::SerialPortInfo> for NativeSerialPortInfo {
  fn from(info: serialport::SerialPortInfo) -> Self {
    match info.port_type {
      SerialPortType::UsbPort(usb) => Self {
        path: info.port_name,
        manufacturer: usb.manufacturer,
        product: usb.product,
        serial_number: usb.serial_number,
        vendor_id: Some(hex_u16(usb.vid)),
        product_id: Some(hex_u16(usb.pid)),
        port_type: "UsbPort".to_string(),
      },
      SerialPortType::PciPort => Self::simple(info.port_name, "PciPort"),
      SerialPortType::BluetoothPort => Self::simple(info.port_name, "BluetoothPort"),
      SerialPortType::Unknown => Self::simple(info.port_name, "Unknown"),
    }
  }
}

impl NativeSerialPortInfo {
  fn simple(path: String, port_type: &str) -> Self {
    Self {
      path,
      manufacturer: None,
      product: None,
      serial_number: None,
      vendor_id: None,
      product_id: None,
      port_type: port_type.to_string(),
    }
  }
}
