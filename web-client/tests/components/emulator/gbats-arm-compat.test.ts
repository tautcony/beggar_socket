import { GameBoyAdvance } from 'gbats';
import { describe, expect, it } from 'vitest';

import { applyGbatsArmCompatibility } from '@/components/emulator/gbats-arm-compat';

const MSR_SPSR_CONTROL_R1 = 0xe161f001;
const MSR_CPSR_CONTROL_R1 = 0xe121f001;
const MOVS_PC_LR = 0xe1b0f00e;
const LEGAL_MODES = [0x10, 0x11, 0x12, 0x13, 0x17, 0x1b, 0x1f];

function createCore(): GameBoyAdvance {
  const core = new GameBoyAdvance(undefined, 'manual');
  core.reset();
  return core;
}

function executeArm(core: GameBoyAdvance, opcode: number): void {
  core.cpu.compileArm(opcode)();
}

function setRegister(core: GameBoyAdvance, register: number, value: number): void {
  (core.cpu.gprs as Int32Array)[register] = value;
}

function getRegister(core: GameBoyAdvance, register: number): number {
  return (core.cpu.gprs as Int32Array)[register];
}

function enterFiq(core: GameBoyAdvance): void {
  core.cpu.switchMode(core.cpu.MODE_FIQ);
  core.cpu.spsr = 0xa0000000;
  setRegister(core, 1, 0x3f);
}

describe('gbats ARM compatibility', () => {
  it('writes M4 into SPSR and returns from FIQ to System Thumb without changing saved flags', () => {
    const core = createCore();
    applyGbatsArmCompatibility(core);
    enterFiq(core);

    executeArm(core, MSR_SPSR_CONTROL_R1);
    expect(core.cpu.spsr >>> 0).toBe(0xa000003f);
    setRegister(core, core.cpu.LR, 0x08000101);
    executeArm(core, MOVS_PC_LR);

    expect(core.cpu.mode).toBe(core.cpu.MODE_SYSTEM);
    expect(core.cpu.execMode).toBe(true);
    expect(getRegister(core, core.cpu.PC)).toBe(0x08000101);
    expect((core.cpu.packCPSR() & 0xf0000000) >>> 0).toBe(0xa0000000);
  });

  it.each(LEGAL_MODES)('preserves valid SPSR mode 0x%i on exception return', mode => {
    const core = createCore();
    applyGbatsArmCompatibility(core);
    core.cpu.switchMode(core.cpu.MODE_FIQ);
    core.cpu.spsr = 0xa0000000;
    setRegister(core, 1, mode);

    executeArm(core, MSR_SPSR_CONTROL_R1);
    setRegister(core, core.cpu.LR, 0x08000100);
    executeArm(core, MOVS_PC_LR);

    expect(core.cpu.mode).toBe(mode);
    expect((core.cpu.packCPSR() & 0xf0000000) >>> 0).toBe(0xa0000000);
  });

  it('keeps CPSR T separate from the privileged mode mask and applies the fix idempotently', () => {
    const core = createCore();
    core.cpu.PRIV_MASK = 0xcf;
    applyGbatsArmCompatibility(core);
    applyGbatsArmCompatibility(core);
    expect(core.cpu.PRIV_MASK).toBe(0xdf);

    setRegister(core, 1, 0x3f);
    executeArm(core, MSR_CPSR_CONTROL_R1);

    expect(core.cpu.mode).toBe(core.cpu.MODE_SYSTEM);
    expect(core.cpu.execMode).toBe(core.cpu.MODE_ARM);
    expect(core.cpu.PRIV_MASK & core.cpu.STATE_MASK).toBe(0);
  });

  it('continues to throw for an actually invalid SPSR mode', () => {
    const core = createCore();
    applyGbatsArmCompatibility(core);
    core.cpu.switchMode(core.cpu.MODE_FIQ);
    core.cpu.spsr = 0xa0000000;
    setRegister(core, 1, 0x0f);
    executeArm(core, MSR_SPSR_CONTROL_R1);
    setRegister(core, core.cpu.LR, 0x08000100);

    expect(() => {
      executeArm(core, MOVS_PC_LR);
    }).toThrow('Invalid user mode passed to selectBank');
  });
});
