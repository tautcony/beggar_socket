use super::*;
use std::{
  collections::VecDeque,
  io,
  sync::{atomic::AtomicUsize, mpsc},
  thread,
};

const TEST_WAIT: Duration = Duration::from_secs(3);

struct Gate {
  entered: mpsc::Sender<()>,
  release: mpsc::Receiver<()>,
}

impl Gate {
  fn wait(self) {
    self.entered.send(()).unwrap();
    self
      .release
      .recv_timeout(TEST_WAIT)
      .expect("release blocked mock I/O");
  }
}

fn gate() -> (Gate, mpsc::Receiver<()>, mpsc::Sender<()>) {
  let (entered_tx, entered_rx) = mpsc::channel();
  let (release_tx, release_rx) = mpsc::channel();
  (
    Gate {
      entered: entered_tx,
      release: release_rx,
    },
    entered_rx,
    release_tx,
  )
}

enum Step {
  Bytes(Vec<u8>),
  Error(ErrorKind),
  Block(Gate),
  BlockZero(Gate),
  DelayedBytes(Duration, Vec<u8>),
}

#[derive(Default)]
struct Probe {
  drops: AtomicUsize,
  flushes: AtomicUsize,
  controls: AtomicUsize,
  written: Mutex<Vec<u8>>,
  timeouts: Mutex<Vec<Duration>>,
}

struct MockPort {
  probe: Arc<Probe>,
  reads: VecDeque<Step>,
  writes: VecDeque<Step>,
  flush_gate: Option<Gate>,
  flush_error: Option<ErrorKind>,
  timeout_error: bool,
  zero_writes: bool,
  timeout: Duration,
}

impl MockPort {
  fn new(probe: Arc<Probe>) -> Self {
    Self {
      probe,
      reads: VecDeque::new(),
      writes: VecDeque::new(),
      flush_gate: None,
      flush_error: None,
      timeout_error: false,
      zero_writes: false,
      timeout: IO_SLICE,
    }
  }
}

impl Drop for MockPort {
  fn drop(&mut self) {
    self.probe.drops.fetch_add(1, Ordering::SeqCst);
  }
}

impl Read for MockPort {
  fn read(&mut self, buffer: &mut [u8]) -> io::Result<usize> {
    let bytes = match self.reads.pop_front() {
      Some(Step::Bytes(bytes)) => bytes,
      Some(Step::DelayedBytes(delay, bytes)) => {
        thread::sleep(delay);
        bytes
      }
      Some(Step::Error(kind)) => return Err(io::Error::new(kind, "mock read")),
      Some(Step::Block(gate)) => {
        gate.wait();
        return Err(ErrorKind::TimedOut.into());
      }
      Some(Step::BlockZero(_)) => panic!("write-only mock step"),
      None => {
        thread::sleep(self.timeout);
        return Err(ErrorKind::TimedOut.into());
      }
    };
    assert!(bytes.len() <= buffer.len());
    buffer[..bytes.len()].copy_from_slice(&bytes);
    Ok(bytes.len())
  }
}

impl Write for MockPort {
  fn write(&mut self, bytes: &[u8]) -> io::Result<usize> {
    let count = match self.writes.pop_front() {
      Some(Step::Bytes(part)) => part.len(),
      Some(Step::Error(kind)) => return Err(io::Error::new(kind, "mock write")),
      Some(Step::Block(gate)) => {
        gate.wait();
        return Err(ErrorKind::TimedOut.into());
      }
      Some(Step::BlockZero(gate)) => {
        gate.wait();
        0
      }
      Some(Step::DelayedBytes(delay, part)) => {
        thread::sleep(delay);
        part.len()
      }
      None => {
        if self.zero_writes {
          0
        } else {
          bytes.len()
        }
      }
    };
    assert!(count <= bytes.len());
    self
      .probe
      .written
      .lock()
      .unwrap()
      .extend_from_slice(&bytes[..count]);
    Ok(count)
  }

  fn flush(&mut self) -> io::Result<()> {
    self.probe.flushes.fetch_add(1, Ordering::SeqCst);
    if let Some(gate) = self.flush_gate.take() {
      gate.wait();
    }
    match self.flush_error {
      Some(kind) => Err(io::Error::new(kind, "mock flush")),
      None => Ok(()),
    }
  }
}

impl SerialPort for MockPort {
  fn name(&self) -> Option<String> {
    Some("mock".into())
  }
  fn baud_rate(&self) -> serialport::Result<u32> {
    Ok(DEFAULT_BAUD_RATE)
  }
  fn data_bits(&self) -> serialport::Result<DataBits> {
    Ok(DataBits::Eight)
  }
  fn flow_control(&self) -> serialport::Result<FlowControl> {
    Ok(FlowControl::None)
  }
  fn parity(&self) -> serialport::Result<Parity> {
    Ok(Parity::None)
  }
  fn stop_bits(&self) -> serialport::Result<StopBits> {
    Ok(StopBits::One)
  }
  fn timeout(&self) -> Duration {
    self.timeout
  }
  fn set_baud_rate(&mut self, _: u32) -> serialport::Result<()> {
    Ok(())
  }
  fn set_data_bits(&mut self, _: DataBits) -> serialport::Result<()> {
    Ok(())
  }
  fn set_flow_control(&mut self, _: FlowControl) -> serialport::Result<()> {
    Ok(())
  }
  fn set_parity(&mut self, _: Parity) -> serialport::Result<()> {
    Ok(())
  }
  fn set_stop_bits(&mut self, _: StopBits) -> serialport::Result<()> {
    Ok(())
  }
  fn set_timeout(&mut self, timeout: Duration) -> serialport::Result<()> {
    if self.timeout_error {
      return Err(serialport::Error::new(
        serialport::ErrorKind::Unknown,
        "mock timeout",
      ));
    }
    self.timeout = timeout;
    self.probe.timeouts.lock().unwrap().push(timeout);
    Ok(())
  }
  fn write_request_to_send(&mut self, _: bool) -> serialport::Result<()> {
    self.probe.controls.fetch_add(1, Ordering::SeqCst);
    Ok(())
  }
  fn write_data_terminal_ready(&mut self, _: bool) -> serialport::Result<()> {
    self.probe.controls.fetch_add(1, Ordering::SeqCst);
    Ok(())
  }
  fn read_clear_to_send(&mut self) -> serialport::Result<bool> {
    Ok(false)
  }
  fn read_data_set_ready(&mut self) -> serialport::Result<bool> {
    Ok(false)
  }
  fn read_ring_indicator(&mut self) -> serialport::Result<bool> {
    Ok(false)
  }
  fn read_carrier_detect(&mut self) -> serialport::Result<bool> {
    Ok(false)
  }
  fn bytes_to_read(&self) -> serialport::Result<u32> {
    Ok(0)
  }
  fn bytes_to_write(&self) -> serialport::Result<u32> {
    Ok(0)
  }
  fn clear(&self, _: ClearBuffer) -> serialport::Result<()> {
    self.probe.controls.fetch_add(1, Ordering::SeqCst);
    Ok(())
  }
  fn try_clone(&self) -> serialport::Result<Box<dyn SerialPort>> {
    panic!("ports must not be cloned")
  }
  fn set_break(&self) -> serialport::Result<()> {
    Ok(())
  }
  fn clear_break(&self) -> serialport::Result<()> {
    Ok(())
  }
}

fn insert(state: &NativePlatformState, id: u64, port: MockPort) -> Arc<SessionOwner> {
  let owner = Arc::new(SessionOwner::new(format!("mock-{id}"), Box::new(port)));
  lock_sessions(state).unwrap().insert(id, owner.clone());
  owner
}

fn read(
  state: &NativePlatformState,
  id: u64,
  length: usize,
  timeout: u64,
) -> Result<Vec<u8>, String> {
  tauri::async_runtime::block_on(invoke_session(state, id, move |session, closing| {
    read_session(session, closing, length, timeout)
  }))
}

fn write(state: &NativePlatformState, id: u64, bytes: &[u8], timeout: u64) -> Result<(), String> {
  let bytes = bytes.to_vec();
  tauri::async_runtime::block_on(invoke_session(state, id, move |session, closing| {
    write_session(session, closing, &bytes, timeout)
  }))
}

fn close(state: &NativePlatformState, id: u64) -> Result<(), String> {
  tauri::async_runtime::block_on(close_session(state, id))
}

#[test]
fn blocked_session_does_not_block_other_session_or_registry() {
  let state = Arc::new(NativePlatformState::default());
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  let (blocked, entered, release) = gate();
  port.reads.push_back(Step::Block(blocked));
  insert(&state, 1, port);
  let other_probe = Arc::new(Probe::default());
  insert(&state, 2, MockPort::new(other_probe.clone()));
  let reader_state = state.clone();
  let reader = thread::spawn(move || read(&reader_state, 1, 1, 1000));
  entered.recv_timeout(TEST_WAIT).unwrap();

  let (done_tx, done_rx) = mpsc::channel();
  let other_state = state.clone();
  let other = thread::spawn(move || {
    lookup_session(&other_state, 1).unwrap();
    write(&other_state, 2, &[8, 9], 1000).unwrap();
    with_session(&other_state, 2, |s, _| {
      s.port.write_data_terminal_ready(true).unwrap();
      s.port.write_request_to_send(false).unwrap();
      s.port.clear(ClearBuffer::Input).unwrap();
      Ok(())
    })
    .unwrap();
    close(&other_state, 2).unwrap();
    done_tx.send(()).unwrap();
  });
  let result = done_rx.recv_timeout(TEST_WAIT);
  lookup_session(&state, 1)
    .unwrap()
    .closing
    .store(true, Ordering::Release);
  release.send(()).unwrap();
  assert!(reader.join().unwrap().unwrap_err().contains("cancelled"));
  other.join().unwrap();
  result.expect("other session should finish before blocked I/O is released");
  assert_eq!(*other_probe.written.lock().unwrap(), [8, 9]);
  assert_eq!(other_probe.controls.load(Ordering::SeqCst), 3);
  assert_eq!(other_probe.drops.load(Ordering::SeqCst), 1);
}

#[test]
fn close_waits_for_actual_io_and_denies_new_and_previously_looked_up_commands() {
  let state = Arc::new(NativePlatformState::default());
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  let (blocked, entered, release) = gate();
  port.reads.push_back(Step::Block(blocked));
  let owner = insert(&state, 1, port);
  let reader_state = state.clone();
  let reader = thread::spawn(move || read(&reader_state, 1, 1, 1000));
  entered.recv_timeout(TEST_WAIT).unwrap();
  let (done_tx, done_rx) = mpsc::channel();
  let closer_state = state.clone();
  let closer = thread::spawn(move || done_tx.send(close(&closer_state, 1)).unwrap());
  let deadline = Instant::now() + TEST_WAIT;
  while !owner.closing.load(Ordering::Acquire) {
    assert!(Instant::now() < deadline);
    thread::yield_now();
  }
  assert!(done_rx.try_recv().is_err());
  assert_eq!(probe.drops.load(Ordering::SeqCst), 0);
  assert!(write(&state, 1, &[4], 1000)
    .unwrap_err()
    .contains("closing"));
  assert!(
    with_owner::<()>(&owner, 1, |_, _| panic!("stale lookup admitted"))
      .unwrap_err()
      .contains("closing")
  );
  release.send(()).unwrap();
  assert!(reader.join().unwrap().unwrap_err().contains("cancelled"));
  done_rx.recv_timeout(TEST_WAIT).unwrap().unwrap();
  closer.join().unwrap();
  assert_eq!(probe.drops.load(Ordering::SeqCst), 1);
  assert!(lookup_session(&state, 1).is_err());
  assert!(close(&state, 1).unwrap_err().contains("not open"));
}

#[test]
fn operations_recheck_closing_after_waiting_for_same_session_lock() {
  let state = Arc::new(NativePlatformState::default());
  let probe = Arc::new(Probe::default());
  let owner = insert(&state, 1, MockPort::new(probe.clone()));
  let held = owner.session.lock().unwrap();
  let (started_tx, started_rx) = mpsc::channel();
  let (done_tx, done_rx) = mpsc::channel();
  let queued_owner = owner.clone();
  let queued = thread::spawn(move || {
    started_tx.send(()).unwrap();
    done_tx
      .send(with_owner(&queued_owner, 1, |s, _| {
        s.port
          .write_data_terminal_ready(true)
          .map_err(|e| e.to_string())
      }))
      .unwrap();
  });
  started_rx.recv_timeout(TEST_WAIT).unwrap();
  assert!(done_rx.try_recv().is_err());
  owner.closing.store(true, Ordering::Release);
  drop(held);
  assert!(done_rx
    .recv_timeout(TEST_WAIT)
    .unwrap()
    .unwrap_err()
    .contains("closing"));
  queued.join().unwrap();
  close(&state, 1).unwrap();
  assert_eq!(probe.controls.load(Ordering::SeqCst), 0);
}

#[test]
fn flush_is_not_falsely_cancelled_and_close_waits_for_driver_return() {
  let state = Arc::new(NativePlatformState::default());
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  let (blocked, entered, release) = gate();
  port.flush_gate = Some(blocked);
  let owner = insert(&state, 1, port);
  let writer_state = state.clone();
  let writer = thread::spawn(move || write(&writer_state, 1, &[1, 2, 3], 1000));
  entered.recv_timeout(TEST_WAIT).unwrap();
  let (done_tx, done_rx) = mpsc::channel();
  let closer_state = state.clone();
  let closer = thread::spawn(move || done_tx.send(close(&closer_state, 1)).unwrap());
  let deadline = Instant::now() + TEST_WAIT;
  while !owner.closing.load(Ordering::Acquire) {
    assert!(Instant::now() < deadline);
    thread::yield_now();
  }
  assert!(done_rx.try_recv().is_err());
  assert_eq!(probe.drops.load(Ordering::SeqCst), 0);
  release.send(()).unwrap();
  assert!(writer.join().unwrap().unwrap_err().contains("cancelled"));
  done_rx.recv_timeout(TEST_WAIT).unwrap().unwrap();
  closer.join().unwrap();
  assert_eq!(*probe.written.lock().unwrap(), [1, 2, 3]);
  assert_eq!(probe.drops.load(Ordering::SeqCst), 1);
}

#[test]
fn fragmented_reads_retry_interruptions_and_slice_timeouts() {
  let state = NativePlatformState::default();
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  port.reads = VecDeque::from([
    Step::Bytes(vec![1]),
    Step::Error(ErrorKind::Interrupted),
    Step::Error(ErrorKind::TimedOut),
    Step::Bytes(vec![2, 3]),
  ]);
  insert(&state, 1, port);
  assert_eq!(read(&state, 1, 3, 1000).unwrap(), [1, 2, 3]);
  assert!(probe
    .timeouts
    .lock()
    .unwrap()
    .iter()
    .all(|timeout| *timeout <= IO_SLICE));
}

#[test]
fn fragmented_read_deadline_is_not_reset_by_progress() {
  let state = NativePlatformState::default();
  let mut port = MockPort::new(Arc::new(Probe::default()));
  port.reads = VecDeque::from([
    Step::DelayedBytes(Duration::from_millis(30), vec![1]),
    Step::DelayedBytes(Duration::from_millis(30), vec![2]),
    Step::Bytes(vec![3]),
  ]);
  insert(&state, 1, port);
  assert_eq!(
    read(&state, 1, 3, 50).unwrap_err(),
    "Read package timeout in 50ms for mock-1"
  );
}

#[test]
fn partial_writes_preserve_bytes_and_retry_interruptions_and_timeouts() {
  let state = NativePlatformState::default();
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  port.writes = VecDeque::from([
    Step::Bytes(vec![0]),
    Step::Error(ErrorKind::Interrupted),
    Step::Error(ErrorKind::TimedOut),
    Step::Bytes(vec![0, 0]),
  ]);
  insert(&state, 1, port);
  write(&state, 1, &[9, 8, 7], 1000).unwrap();
  assert_eq!(*probe.written.lock().unwrap(), [9, 8, 7]);
  assert_eq!(probe.flushes.load(Ordering::SeqCst), 1);
}

#[test]
fn failures_and_zero_length_contracts_are_preserved() {
  let state = NativePlatformState::default();
  let mut port = MockPort::new(Arc::new(Probe::default()));
  port.reads = VecDeque::from([Step::Bytes(vec![]), Step::Error(ErrorKind::BrokenPipe)]);
  port.writes = VecDeque::from([Step::Bytes(vec![]), Step::Error(ErrorKind::BrokenPipe)]);
  insert(&state, 1, port);
  assert!(read(&state, 1, 0, 0).unwrap().is_empty());
  assert!(read(&state, 1, 1, 1000)
    .unwrap_err()
    .contains("returned no data"));
  assert!(read(&state, 1, 1, 1000)
    .unwrap_err()
    .contains("Failed to read serial data from mock-1"));
  assert!(write(&state, 1, &[1], 1000)
    .unwrap_err()
    .contains("Failed to write serial data to mock-1"));
  assert!(read(&state, 1, 1, 0)
    .unwrap_err()
    .contains("Read package timeout in 0ms"));
  assert!(write(&state, 1, &[1], 0)
    .unwrap_err()
    .contains("timeout in 0ms"));
  close(&state, 1).unwrap();
}

#[test]
fn timeout_setup_and_flush_failures_keep_port_owned_until_close() {
  let state = NativePlatformState::default();
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  port.timeout_error = true;
  let owner = insert(&state, 1, port);
  assert!(read(&state, 1, 1, 1000)
    .unwrap_err()
    .contains("Failed to set serial timeout"));
  assert!(write(&state, 1, &[1], 1000)
    .unwrap_err()
    .contains("Failed to set serial timeout"));
  with_owner(&owner, 1, |session, _| {
    session.port = Box::new({
      let mut port = MockPort::new(probe.clone());
      port.flush_error = Some(ErrorKind::BrokenPipe);
      port
    });
    Ok(())
  })
  .unwrap();
  assert!(write(&state, 1, &[1], 1000)
    .unwrap_err()
    .contains("Failed to flush serial data"));
  assert_eq!(probe.drops.load(Ordering::SeqCst), 1);
  close(&state, 1).unwrap();
  assert_eq!(probe.drops.load(Ordering::SeqCst), 2);
}

#[test]
fn zero_progress_writes_retry_until_success_or_total_deadline() {
  let state = NativePlatformState::default();
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  port.writes = VecDeque::from([
    Step::Bytes(vec![]),
    Step::Bytes(vec![]),
    Step::Bytes(vec![0]),
  ]);
  insert(&state, 1, port);
  write(&state, 1, &[7, 8], 1000).unwrap();
  assert_eq!(*probe.written.lock().unwrap(), [7, 8]);
  assert_eq!(probe.flushes.load(Ordering::SeqCst), 1);
  let mut stalled_port = MockPort::new(probe.clone());
  stalled_port.zero_writes = true;
  insert(&state, 2, stalled_port);
  assert!(write(&state, 2, &[9], 20)
    .unwrap_err()
    .contains("timeout in 20ms"));
  assert_eq!(probe.flushes.load(Ordering::SeqCst), 1);
  close(&state, 1).unwrap();
  close(&state, 2).unwrap();
  assert_eq!(probe.drops.load(Ordering::SeqCst), 2);
}

#[test]
fn close_cancels_zero_progress_write_before_any_flush() {
  let state = Arc::new(NativePlatformState::default());
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  let (blocked, entered, release) = gate();
  port.writes = VecDeque::from([Step::Bytes(vec![]), Step::BlockZero(blocked)]);
  let owner = insert(&state, 1, port);
  let writer_state = state.clone();
  let writer = thread::spawn(move || write(&writer_state, 1, &[1], 1000));
  entered.recv_timeout(TEST_WAIT).unwrap();
  begin_close(&state, 1).unwrap();
  assert!(with_owner::<()>(&owner, 1, |_, _| panic!("closing write admitted")).is_err());
  release.send(()).unwrap();
  assert!(writer.join().unwrap().unwrap_err().contains("cancelled"));
  close(&state, 1).unwrap();
  assert_eq!(probe.flushes.load(Ordering::SeqCst), 0);
  assert_eq!(probe.drops.load(Ordering::SeqCst), 1);
}

#[test]
fn simultaneous_close_owners_join_and_dispose_exactly_once() {
  let state = NativePlatformState::default();
  let probe = Arc::new(Probe::default());
  let owner = insert(&state, 1, MockPort::new(probe.clone()));
  let first = begin_close(&state, 1).unwrap();
  let second = begin_close(&state, 1).unwrap();
  assert!(Arc::ptr_eq(&first, &second));
  let held = owner.session.lock().unwrap();
  let (done_tx, done_rx) = mpsc::channel();
  let first_done = done_tx.clone();
  let first_close = thread::spawn(move || {
    dispose_session(&first);
    first_done.send(()).unwrap();
  });
  let second_close = thread::spawn(move || {
    dispose_session(&second);
    done_tx.send(()).unwrap();
  });
  assert!(done_rx.try_recv().is_err());
  assert_eq!(probe.drops.load(Ordering::SeqCst), 0);
  drop(held);
  done_rx.recv_timeout(TEST_WAIT).unwrap();
  done_rx.recv_timeout(TEST_WAIT).unwrap();
  first_close.join().unwrap();
  second_close.join().unwrap();
  close(&state, 1).unwrap();
  assert_eq!(probe.drops.load(Ordering::SeqCst), 1);
}

#[test]
fn worker_failure_is_reported_and_close_recovers_poisoned_session() {
  let state = NativePlatformState::default();
  let probe = Arc::new(Probe::default());
  insert(&state, 1, MockPort::new(probe.clone()));
  let caller = thread::current().id();
  tauri::async_runtime::block_on(invoke_session(&state, 1, move |_, _| {
    assert_ne!(thread::current().id(), caller);
    Ok(())
  }))
  .unwrap();
  let error = tauri::async_runtime::block_on(invoke_session::<()>(&state, 1, |_, _| {
    panic!("mock worker failure");
  }))
  .unwrap_err();
  assert!(error.contains("Native serial worker failed"));
  assert!(read(&state, 1, 1, 1000).unwrap_err().contains("poisoned"));
  begin_close(&state, 1).unwrap();
  close(&state, 1).unwrap();
  assert_eq!(probe.drops.load(Ordering::SeqCst), 1);
}

#[test]
fn final_driver_progress_cannot_reset_or_overrun_total_deadline() {
  let state = NativePlatformState::default();
  let probe = Arc::new(Probe::default());
  let mut port = MockPort::new(probe.clone());
  port
    .reads
    .push_back(Step::DelayedBytes(Duration::from_millis(30), vec![1]));
  port
    .writes
    .push_back(Step::DelayedBytes(Duration::from_millis(30), vec![0]));
  insert(&state, 1, port);
  assert!(read(&state, 1, 1, 10)
    .unwrap_err()
    .contains("Read package timeout in 10ms"));
  assert!(write(&state, 1, &[9], 10)
    .unwrap_err()
    .contains("timeout in 10ms"));
  assert_eq!(*probe.written.lock().unwrap(), [9]);
  assert_eq!(probe.flushes.load(Ordering::SeqCst), 0);
  close(&state, 1).unwrap();
}
