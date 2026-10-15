import { config, flushPromises, mount, type VueWrapper } from '@vue/test-utils';
import { createPinia } from 'pinia';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { defineComponent, h, ref } from 'vue';

import CartBurner from '@/components/CartBurner.vue';
import { GB_NINTENDO_LOGO, GBA_NINTENDO_LOGO } from '@/utils/parsers/rom-parser';

/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument, vue/one-component-per-file, vue/require-prop-types */
const harness = vi.hoisted(() => ({ gbaLaunches: [] as any[], gbaClosed: vi.fn(), export: vi.fn() }));

vi.mock('@/platform/native', () => ({ saveBinaryFile: harness.export }));
vi.mock('@/platform/runtime', () => ({ isTauriRuntime: () => false, isWebRuntime: () => true }));
vi.mock('@/composables/useToast', () => ({ useToast: () => ({ showToast: vi.fn() }) }));
vi.mock('vue-i18n', () => ({ useI18n: () => ({ t: (key: string) => key }) }));
vi.mock('@ionic/vue', () => ({ IonIcon: { render: () => h('span') } }));
vi.mock('@/services', () => ({ CartridgeAdapter: class {}, GBAAdapter: class {}, MBC5Adapter: class {} }));
vi.mock('@/features/burner/adapters', () => ({ createCartridgeProtocolSession: vi.fn() }));
vi.mock('@/features/burner/application', async () => {
  const actual = await vi.importActual<typeof import('@/features/burner/application')>('@/features/burner/application');
  return { ...actual, createBurnerFacade: () => ({}) };
});

vi.mock('@/components/emulator/GBAEmulator.vue', () => {
  return {
    __esModule: true,
    default: defineComponent({
      name: 'GBAEmulatorTestHarness',
      props: ['isVisible', 'romData', 'romName', 'launch'],
      emits: ['save-checkpoint', 'save-result', 'save-use-changed', 'close'],
      setup(props: any, { emit }: any) {
        const bytes = ref(new Uint8Array(props.launch.saveData ?? new Uint8Array(32768)));
        const checkpoint = () => {
          bytes.value = new Uint8Array(bytes.value);
          bytes.value.fill(0x42, 0, Math.min(32768, bytes.value.length));
          emit('save-checkpoint', {
            launch: props.launch,
            data: new Uint8Array(bytes.value),
            capacity: Math.min(32768, bytes.value.length),
            changed: true,
          });
        };
        const reset = () => { bytes.value = new Uint8Array(bytes.value); };
        const close = () => {
          emit('save-result', {
            launch: props.launch,
            data: new Uint8Array(bytes.value),
            capacity: Math.min(32768, bytes.value.length),
            changed: true,
          });
          emit('close', props.launch.sessionId);
          harness.gbaClosed();
        };
        return () => h('div', { class: 'gba-test-harness' }, [
          h('output', { class: 'gba-first-byte' }, String(bytes.value[0])),
          h('button', { class: 'gba-checkpoint', onClick: checkpoint }, 'checkpoint'),
          h('button', { class: 'gba-reset', onClick: reset }, 'reset'),
          h('button', { class: 'gba-close', onClick: close }, 'close'),
        ]);
      },
    }),
  };
});

vi.mock('@/components/emulator/GBCEmulator.vue', () => {
  return { __esModule: true, default: defineComponent({
    name: 'GBCEmulatorTestHarness',
    props: ['isVisible', 'romData', 'romName'],
    emits: ['close'],
    setup(props: any) { return () => h('div', { class: 'gbc-test-harness', 'data-rom-name': props.romName }); },
  }) };
});

vi.mock('@/components/operaiton/ChipOperations.vue', () => {
  return { default: defineComponent({ name: 'ChipOperationsTestStub', setup: () => () => h('div') }) };
});

function makeGbaRom(): Uint8Array {
  const rom = new Uint8Array(1024);
  rom.set(GBA_NINTENDO_LOGO, 0x04);
  rom.set(new TextEncoder().encode('TEST GAME   '), 0xa0);
  rom.set(new TextEncoder().encode('ABCE'), 0xac);
  rom.set(new TextEncoder().encode('01'), 0xb0);
  rom[0xb2] = 0x96;
  rom.set(new TextEncoder().encode('SRAM_V123'), 0xe4);
  let sum = 0;
  for (let index = 0xa0; index <= 0xbc; index += 1) sum += rom[index];
  rom[0xbd] = (-(sum + 0x19)) & 0xff;
  return rom;
}

function makeGbRom(): Uint8Array {
  const rom = new Uint8Array(0x8000);
  rom.set(GB_NINTENDO_LOGO, 0x104);
  rom.set(new TextEncoder().encode('TEST COLOR'), 0x134);
  rom[0x143] = 0x80;
  rom[0x147] = 0x19;
  let checksum = 0;
  for (let index = 0x134; index <= 0x14c; index += 1) checksum = (checksum - rom[index] - 1) & 0xff;
  rom[0x14d] = checksum;
  return rom;
}

function makeFile(name: string, bytes: Uint8Array): File {
  return new File([bytes.slice().buffer], name, { type: 'application/octet-stream' });
}

async function selectFile(wrapper: VueWrapper, accept: '.rom,.gba,.gb,.gbc' | '.sav,.ram', file: File) {
  const input = wrapper.findAll('input[type="file"]').find(candidate => candidate.attributes('accept') === accept);
  expect(input, `input for ${accept}`).toBeDefined();
  if (!input) throw new Error(`Missing file input for ${accept}`);
  Object.defineProperty(input.element, 'files', { configurable: true, value: [file] });
  await input.trigger('change');
  await flushPromises();
  await vi.waitFor(() => {
    expect(wrapper.text()).toContain(file.name);
  });
}

async function renderBurner() {
  delete config.global.components?.Teleport;
  const wrapper = mount(CartBurner, {
    props: { device: null, deviceReady: false },
    global: { plugins: [createPinia()] },
  });
  await flushPromises();
  return wrapper;
}

function button(wrapper: VueWrapper, text: string) {
  const found = wrapper.findAll('button').find(candidate => candidate.text().includes(text));
  expect(found, `button ${text}`).toBeDefined();
  if (!found) throw new Error(`Missing button ${text}`);
  return found;
}

async function clickModalButton(text: string) {
  const found = Array.from(document.body.querySelectorAll('button')).find(candidate => candidate.textContent?.includes(text));
  expect(found, `modal button ${text}`).toBeDefined();
  if (!found) throw new Error(`Missing modal button ${text}`);
  found.click();
  await flushPromises();
}

describe('CartBurner preview container integration', () => {
  beforeEach(() => {
    harness.gbaLaunches.length = 0;
    harness.gbaClosed.mockClear();
    harness.export.mockReset().mockResolvedValue({ saved: true });
  });

  it('routes an oversized raw save through checkpoint, reset, full RAM writeback, export, and reimport', async () => {
    const wrapper = await renderBurner();
    const originalSave = new Uint8Array(131072);
    for (let index = 0; index < originalSave.length; index += 1) originalSave[index] = (index * 7 + 1) & 0xff;
    const expectedOutput = new Uint8Array(originalSave);
    expectedOutput.fill(0x42, 0, 32768);
    const originalTail = originalSave.slice(32768);
    await selectFile(wrapper, '.rom,.gba,.gb,.gbc', makeFile('game.gba', makeGbaRom()));
    await selectFile(wrapper, '.sav,.ram', makeFile('game.sav', originalSave));

    await wrapper.get('.play-button').trigger('click');
    await flushPromises();
    const emulator = wrapper.find('.gba-test-harness');
    expect(emulator.exists()).toBe(true);
    const launch = wrapper.findComponent({ name: 'GBAEmulatorTestHarness' }).props('launch') as { saveData: Uint8Array; saveName: string; usesSelectedSave: boolean };
    expect(launch.saveName).toBe('game.sav');
    expect(launch.usesSelectedSave).toBe(true);
    expect(launch.saveData).toEqual(originalSave);
    expect(wrapper.find('.gba-first-byte').text()).toBe('1');

    await wrapper.get('.gba-checkpoint').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.file-preview .file-name').map(item => item.text())).toEqual(['game.gba', 'game.sav']);
    expect(wrapper.findAll('.file-preview')[1].text()).toContain('game.sav');
    await wrapper.get('.ram-content .download-file-btn').trigger('click');
    await flushPromises();
    expect(harness.export).toHaveBeenCalledTimes(1);
    expect(harness.export.mock.calls[0][0]).toEqual(originalSave);
    expect(originalSave[0]).toBe(1);

    await wrapper.get('.gba-reset').trigger('click');
    await wrapper.get('.gba-close').trigger('click');
    await flushPromises();
    const fileNames = wrapper.findAll('.file-preview .file-name').map(item => item.text());
    expect(fileNames).toContain('game.sav');
    const updatedRam = wrapper.findAll('.file-preview')[1];
    expect(updatedRam.text()).toContain('game.sav');

    await wrapper.get('.ram-content .download-file-btn').trigger('click');
    await flushPromises();
    expect(harness.export).toHaveBeenCalledTimes(2);
    expect(harness.export.mock.calls[1][0]).toEqual(expectedOutput);
    expect(harness.export.mock.calls[1][0].slice(32768)).toEqual(originalTail);
    expect(harness.export.mock.calls[1][1]).toBe('game.sav');

    const ramInput = wrapper.findAll('input[type="file"]').find(candidate => candidate.attributes('accept') === '.sav,.ram');
    await wrapper.get('.ram-content .remove-file-btn').trigger('click');
    await flushPromises();
    await selectFile(wrapper, '.sav,.ram', makeFile('game.sav', expectedOutput));
    await wrapper.get('.play-button').trigger('click');
    await flushPromises();
    const secondLaunch = wrapper.findComponent({ name: 'GBAEmulatorTestHarness' }).props('launch') as { saveData: Uint8Array };
    expect(secondLaunch.saveData).toEqual(expectedOutput);
    expect(ramInput?.exists()).toBe(true);

    expect(button(wrapper, 'ui.rom.write').element).toHaveProperty('disabled', true);
    expect(button(wrapper, 'ui.ram.write').element).toHaveProperty('disabled', true);
    wrapper.unmount();
  });

  it('requires an explicit mismatch choice and keeps a skipped save out of RAM writeback', async () => {
    const wrapper = await renderBurner();
    await selectFile(wrapper, '.rom,.gba,.gb,.gbc', makeFile('new-game.gba', makeGbaRom()));
    await selectFile(wrapper, '.sav,.ram', makeFile('old-game.sav', new Uint8Array(32768).fill(0x13)));
    await wrapper.get('.play-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.gba-test-harness').exists()).toBe(false);
    expect(document.body.textContent).toContain('ui.emulator.saveAssociationMessage');

    document.body.querySelector<HTMLButtonElement>('.modal-overlay .close-btn')?.click();
    await flushPromises();
    expect(wrapper.find('.gba-test-harness').exists()).toBe(false);
    expect(wrapper.findAll('.file-preview .file-name').map(item => item.text())).toContain('old-game.sav');
    await wrapper.get('.play-button').trigger('click');
    await flushPromises();

    await clickModalButton('ui.emulator.startWithoutSave');
    const launch = wrapper.findComponent({ name: 'GBAEmulatorTestHarness' }).props('launch') as { saveData?: Uint8Array; usesSelectedSave: boolean };
    expect(launch.saveData).toBeUndefined();
    expect(launch.usesSelectedSave).toBe(false);
    await wrapper.get('.gba-checkpoint').trigger('click');
    await wrapper.get('.gba-close').trigger('click');
    await flushPromises();
    expect(wrapper.findAll('.file-preview .file-name').map(item => item.text())).toContain('old-game.sav');
    expect(wrapper.text()).toContain('messages.emulator.pendingSaveRecovery');
    await wrapper.get('.play-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.gba-test-harness').exists()).toBe(false);
    expect(wrapper.text()).toContain('messages.emulator.pendingSaveRecovery');

    harness.export.mockResolvedValueOnce({ saved: false });
    await button(wrapper, 'ui.emulator.exportSave').trigger('click');
    await flushPromises();
    expect(wrapper.text()).toContain('messages.emulator.pendingSaveRecovery');
    harness.export.mockResolvedValueOnce({ saved: true });
    await button(wrapper, 'ui.emulator.exportSave').trigger('click');
    await flushPromises();
    expect(wrapper.text()).not.toContain('messages.emulator.pendingSaveRecovery');
    await wrapper.get('.play-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.gba-test-harness').exists()).toBe(false);
    expect(document.body.textContent).toContain('ui.emulator.saveAssociationMessage');
    wrapper.unmount();
  });

  it('can explicitly use a differently named save after showing both selected files', async () => {
    const wrapper = await renderBurner();
    const selectedSave = new Uint8Array(32768).fill(0x27);
    await selectFile(wrapper, '.rom,.gba,.gb,.gbc', makeFile('current.gba', makeGbaRom()));
    await selectFile(wrapper, '.sav,.ram', makeFile('imported.sav', selectedSave));
    await wrapper.get('.play-button').trigger('click');
    await flushPromises();
    expect(document.body.textContent).toContain('ui.emulator.saveAssociationMessage');
    await clickModalButton('ui.emulator.useSelectedSave');
    const launch = wrapper.findComponent({ name: 'GBAEmulatorTestHarness' }).props('launch') as { saveData: Uint8Array; saveName: string; usesSelectedSave: boolean };
    expect(launch.saveName).toBe('imported.sav');
    expect(launch.usesSelectedSave).toBe(true);
    expect(launch.saveData).toEqual(selectedSave);
    wrapper.unmount();
  });

  it('keeps GB/GBC preview launch working through the real operation component', async () => {
    const wrapper = await renderBurner();
    await selectFile(wrapper, '.rom,.gba,.gb,.gbc', makeFile('game.gbc', makeGbRom()));
    await wrapper.get('.play-button').trigger('click');
    await flushPromises();
    expect(wrapper.find('.gbc-test-harness').attributes('data-rom-name')).toBe('game.gbc');
    expect(wrapper.find('.gba-test-harness').exists()).toBe(false);
    wrapper.unmount();
  });
});
