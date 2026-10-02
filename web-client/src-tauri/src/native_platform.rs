use serde::Serialize;
use serialport::{ClearBuffer, DataBits, FlowControl, Parity, SerialPort, SerialPortType, StopBits};
use std::{
  collections::HashMap,
  io::{ErrorKind, Read, Write},
  path::PathBuf,
  sync::{
    atomic::{AtomicBool, AtomicU64, Ordering},
    Arc, Mutex,
  },
  time::{Duration, Instant},
};

const DEFAULT_BAUD_RATE: u32 = 9_600;
const DEFAULT_IO_TIMEOUT_MS: u64 = 1_000;
const IO_SLICE: Duration = Duration::from_millis(50);

pub struct NativePlatformState {
  next_session_id: AtomicU64,
  serial_sessions: Mutex<HashMap<u64, Arc<SessionOwner>>>,
}

impl Default for NativePlatformState {
  fn default() -> Self {
    Self {
      next_session_id: AtomicU64::new(1),
      serial_sessions: Mutex::new(HashMap::new()),
    }
  }
}

struct SessionOwner {
  closing: AtomicBool,
  session: Mutex<Option<SerialSession>>,
}

impl SessionOwner {
  fn new(path: String, port: Box<dyn SerialPort>) -> Self {
    Self {
      closing: AtomicBool::new(false),
      session: Mutex::new(Some(SerialSession { path, port })),
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
pub async fn native_list_serial_ports() -> Result<Vec<NativeSerialPortInfo>, String> {
  run_blocking(|| {
    let ports = serialport::available_ports().map_err(|error| error.to_string())?;
    Ok(ports.into_iter().map(NativeSerialPortInfo::from).collect())
  })
  .await
}

#[tauri::command]
pub async fn native_open_serial_port(
  state: tauri::State<'_, NativePlatformState>,
  path: String,
) -> Result<NativeSerialSessionInfo, String> {
  let (path, port) = run_blocking(move || {
    let port = serialport::new(&path, DEFAULT_BAUD_RATE)
      .data_bits(DataBits::Eight)
      .flow_control(FlowControl::None)
      .parity(Parity::None)
      .stop_bits(StopBits::One)
      .timeout(Duration::from_millis(DEFAULT_IO_TIMEOUT_MS))
      .open()
      .map_err(|error| format!("Failed to open serial port {path}: {error}"))?;
    Ok((path, port))
  })
  .await?;

  let session_id = state.next_session_id.fetch_add(1, Ordering::Relaxed);
  let mut sessions = lock_sessions(&state)?;
  sessions.insert(session_id, Arc::new(SessionOwner::new(path, port)));

  Ok(NativeSerialSessionInfo { session_id })
}

#[tauri::command]
pub async fn native_serial_write(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
  bytes: Vec<u8>,
  timeout_ms: Option<u64>,
) -> Result<(), String> {
  invoke_session(&state, session_id, move |session, closing| {
    write_session(
      session,
      closing,
      &bytes,
      timeout_ms.unwrap_or(DEFAULT_IO_TIMEOUT_MS),
    )
  })
  .await
}

#[tauri::command]
pub async fn native_serial_read(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
  length: usize,
  timeout_ms: Option<u64>,
) -> Result<Vec<u8>, String> {
  invoke_session(&state, session_id, move |session, closing| {
    read_session(
      session,
      closing,
      length,
      timeout_ms.unwrap_or(DEFAULT_IO_TIMEOUT_MS),
    )
  })
  .await
}

#[tauri::command]
pub async fn native_serial_set_signals(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
  data_terminal_ready: Option<bool>,
  request_to_send: Option<bool>,
) -> Result<(), String> {
  invoke_session(&state, session_id, move |session, _closing| {
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
  .await
}

#[tauri::command]
pub async fn native_serial_flush_input(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
) -> Result<(), String> {
  invoke_session(&state, session_id, move |session, _closing| {
    session
      .port
      .clear(ClearBuffer::Input)
      .map_err(|error| format!("Failed to clear input buffer for {}: {error}", session.path))
  })
  .await
}

#[tauri::command]
pub async fn native_serial_close(
  state: tauri::State<'_, NativePlatformState>,
  session_id: u64,
) -> Result<(), String> {
  close_session(&state, session_id).await
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

fn lock_sessions(
  state: &NativePlatformState,
) -> Result<std::sync::MutexGuard<'_, HashMap<u64, Arc<SessionOwner>>>, String> {
  state
    .serial_sessions
    .lock()
    .map_err(|_| "Native serial session state is poisoned".to_string())
}

fn lookup_session(
  state: &NativePlatformState,
  session_id: u64,
) -> Result<Arc<SessionOwner>, String> {
  lock_sessions(state)?
    .get(&session_id)
    .cloned()
    .ok_or_else(|| format!("Serial session {session_id} is not open"))
}

fn check_open(closing: &AtomicBool, session_id: u64) -> Result<(), String> {
  if closing.load(Ordering::Acquire) {
    Err(format!("Serial session {session_id} is closing"))
  } else {
    Ok(())
  }
}

fn with_owner<T>(
  owner: &SessionOwner,
  session_id: u64,
  operation: impl FnOnce(&mut SerialSession, &AtomicBool) -> Result<T, String>,
) -> Result<T, String> {
  check_open(&owner.closing, session_id)?;
  let mut session = owner
    .session
    .lock()
    .map_err(|_| format!("Serial session {session_id} state is poisoned"))?;
  check_open(&owner.closing, session_id)?;
  let session = session
    .as_mut()
    .ok_or_else(|| format!("Serial session {session_id} is not open"))?;
  operation(session, &owner.closing)
}

async fn run_blocking<T: Send + 'static>(
  operation: impl FnOnce() -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
  tauri::async_runtime::spawn_blocking(operation)
    .await
    .map_err(|error| format!("Native serial worker failed: {error}"))?
}

async fn invoke_session<T: Send + 'static>(
  state: &NativePlatformState,
  session_id: u64,
  operation: impl FnOnce(&mut SerialSession, &AtomicBool) -> Result<T, String> + Send + 'static,
) -> Result<T, String> {
  let owner = lookup_session(state, session_id)?;
  check_open(&owner.closing, session_id)?;
  // Async commands must not block the Tauri command/UI thread on I/O or a lock.
  run_blocking(move || with_owner(&owner, session_id, operation)).await
}

fn begin_close(state: &NativePlatformState, session_id: u64) -> Result<Arc<SessionOwner>, String> {
  let sessions = lock_sessions(state)?;
  let owner = sessions
    .get(&session_id)
    .cloned()
    .ok_or_else(|| format!("Serial session {session_id} is not open"))?;
  owner.closing.store(true, Ordering::Release);
  Ok(owner)
}

fn dispose_session(owner: &SessionOwner) {
  // Keep the closing owner registered so simultaneous close requests join it.
  // Recover a poisoned operation lock so a prior panic cannot leak the port.
  let mut session = owner
    .session
    .lock()
    .unwrap_or_else(|error| error.into_inner());
  // Disposal happens under the operation lock, before any close can succeed.
  drop(session.take());
}

#[cfg(test)]
fn with_session<T>(
  state: &NativePlatformState,
  session_id: u64,
  operation: impl FnOnce(&mut SerialSession, &AtomicBool) -> Result<T, String>,
) -> Result<T, String> {
  let owner = lookup_session(state, session_id)?;
  with_owner(&owner, session_id, operation)
}

async fn close_session(state: &NativePlatformState, session_id: u64) -> Result<(), String> {
  let owner = begin_close(state, session_id)?;
  run_blocking(move || {
    dispose_session(&owner);
    Ok(())
  })
  .await?;
  lock_sessions(state)?.remove(&session_id);
  Ok(())
}

fn check_cancelled(session: &SerialSession, closing: &AtomicBool) -> Result<(), String> {
  if closing.load(Ordering::Acquire) {
    Err(format!(
      "Serial operation cancelled for {}: session is closing",
      session.path
    ))
  } else {
    Ok(())
  }
}

fn set_io_slice(session: &mut SerialSession, remaining: Duration) -> Result<(), String> {
  session
    .port
    .set_timeout(remaining.min(IO_SLICE))
    .map_err(|error| format!("Failed to set serial timeout for {}: {error}", session.path))
}

fn read_session(
  session: &mut SerialSession,
  closing: &AtomicBool,
  length: usize,
  timeout_ms: u64,
) -> Result<Vec<u8>, String> {
  let started_at = Instant::now();
  let timeout = Duration::from_millis(timeout_ms);
  let mut buffer = vec![0_u8; length];
  let mut offset = 0;
  while offset < length {
    check_cancelled(session, closing)?;
    let remaining = timeout.saturating_sub(started_at.elapsed());
    if remaining.is_zero() {
      return Err(format!(
        "Read package timeout in {timeout_ms}ms for {}",
        session.path
      ));
    }
    set_io_slice(session, remaining)?;
    match session.port.read(&mut buffer[offset..]) {
      Ok(0) => {
        return Err(format!(
          "Read package returned no data for {}",
          session.path
        ))
      }
      Ok(count) => offset += count,
      Err(error) if matches!(error.kind(), ErrorKind::TimedOut | ErrorKind::Interrupted) => {}
      Err(error) => {
        return Err(format!(
          "Failed to read serial data from {}: {error}",
          session.path
        ))
      }
    }
  }
  check_cancelled(session, closing)?;
  if length > 0 && started_at.elapsed() >= timeout {
    return Err(format!(
      "Read package timeout in {timeout_ms}ms for {}",
      session.path
    ));
  }
  Ok(buffer)
}

fn write_session(
  session: &mut SerialSession,
  closing: &AtomicBool,
  bytes: &[u8],
  timeout_ms: u64,
) -> Result<(), String> {
  let started_at = Instant::now();
  let timeout = Duration::from_millis(timeout_ms);
  let mut offset = 0;
  while offset < bytes.len() {
    check_cancelled(session, closing)?;
    let remaining = timeout.saturating_sub(started_at.elapsed());
    if remaining.is_zero() {
      return Err(format!(
        "Failed to write serial data to {}: timeout in {timeout_ms}ms",
        session.path
      ));
    }
    set_io_slice(session, remaining)?;
    match session.port.write(&bytes[offset..]) {
      // Windows serialport 4.9 WriteFile timeout can succeed with zero bytes.
      // Retry this serial-specific no-progress result until the total deadline.
      Ok(0) => std::thread::sleep(remaining.min(Duration::from_millis(1))),
      Ok(count) => offset += count,
      Err(error) if matches!(error.kind(), ErrorKind::TimedOut | ErrorKind::Interrupted) => {}
      Err(error) => {
        return Err(format!(
          "Failed to write serial data to {}: {error}",
          session.path
        ))
      }
    }
  }
  check_cancelled(session, closing)?;
  let remaining = timeout.saturating_sub(started_at.elapsed());
  if !bytes.is_empty() && remaining.is_zero() {
    return Err(format!(
      "Failed to write serial data to {}: timeout in {timeout_ms}ms",
      session.path
    ));
  }
  set_io_slice(session, remaining)?;
  // serialport 4.9 uses FlushFileBuffers / tcdrain: timeout cannot portably
  // bound this call. Retain ownership until the real driver call returns.
  session
    .port
    .flush()
    .map_err(|error| format!("Failed to flush serial data to {}: {error}", session.path))?;
  check_cancelled(session, closing)?;
  if !bytes.is_empty() && started_at.elapsed() >= timeout {
    return Err(format!(
      "Failed to flush serial data to {}: timeout in {timeout_ms}ms",
      session.path
    ));
  }
  Ok(())
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

#[cfg(test)]
#[path = "native_platform_tests.rs"]
mod tests;
