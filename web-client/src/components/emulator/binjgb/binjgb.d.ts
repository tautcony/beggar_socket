export interface BinjgbModule {
  HEAP8: Int8Array;
  HEAPU8: Uint8Array;
  HEAP16: Int16Array;
  HEAPU16: Uint16Array;
  HEAP32: Int32Array;
  HEAPU32: Uint32Array;
  HEAPF32: Float32Array;
  HEAPF64: Float64Array;

  _malloc(size: number): number;
  _free(ptr: number): void;

  _emulator_new_simple(
    romPtr: number,
    romSize: number,
    audioSampleRate: number,
    audioBufferSize: number,
    cgbColorCurve: number,
  ): number;
  _emulator_delete(emuPtr: number): void;
  _emulator_run_until_f64(emuPtr: number, untilTicks: number): number;
  _emulator_get_ticks_f64(emuPtr: number): number;

  _get_frame_buffer_ptr(emuPtr: number): number;
  _get_frame_buffer_size(emuPtr: number): number;
  _get_sgb_frame_buffer_ptr(emuPtr: number): number;
  _get_sgb_frame_buffer_size(emuPtr: number): number;

  _get_audio_buffer_ptr(emuPtr: number): number;
  _get_audio_buffer_capacity(emuPtr: number): number;

  _joypad_new(): number;
  _joypad_delete(joypadPtr: number): void;
  _emulator_set_default_joypad_callback(emuPtr: number, joypadPtr: number): void;

  _set_joyp_up(joypadPtr: number, down: number | boolean): void;
  _set_joyp_down(joypadPtr: number, down: number | boolean): void;
  _set_joyp_left(joypadPtr: number, down: number | boolean): void;
  _set_joyp_right(joypadPtr: number, down: number | boolean): void;
  _set_joyp_B(joypadPtr: number, down: number | boolean): void;
  _set_joyp_A(joypadPtr: number, down: number | boolean): void;
  _set_joyp_start(joypadPtr: number, down: number | boolean): void;
  _set_joyp_select(joypadPtr: number, down: number | boolean): void;

  _emulator_read_mem(emuPtr: number, addr: number): number;

  _emulator_was_ext_ram_updated(emuPtr: number): number | boolean;
  _emulator_read_ext_ram(emuPtr: number, fileDataPtr: number): number;
  _emulator_write_ext_ram(emuPtr: number, fileDataPtr: number): number;
  _ext_ram_file_data_new(emuPtr: number): number;
  _state_file_data_new(emuPtr: number): number;
  _get_file_data_ptr(fileDataPtr: number): number;
  _get_file_data_size(fileDataPtr: number): number;
  _file_data_delete(fileDataPtr: number): void;

  _emulator_set_builtin_palette(emuPtr: number, paletteIndex: number): void;
  _emulator_set_bw_palette_simple(emuPtr: number, p0: number, p1: number, p2: number, p3: number): void;
  _set_audio_channel_mute(emuPtr: number, channel: number, mute: number | boolean): void;

  _emulator_read_state(emuPtr: number, fileDataPtr: number): number;
  _emulator_write_state(emuPtr: number, fileDataPtr: number): number;
}

export interface BinjgbOptions {
  locateFile?: (path: string, scriptDirectory?: string) => string;
  wasmBinary?: ArrayBuffer | Uint8Array;
  [key: string]: unknown;
}

export declare function Binjgb(options?: BinjgbOptions): Promise<BinjgbModule>;
export default Binjgb;
