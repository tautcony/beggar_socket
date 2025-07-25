<template>
  <div class="app-menu-container">
    <button
      class="menu-trigger"
      :class="{ active: isMenuOpen }"
      @click="toggleMenu"
    >
      <IonIcon :icon="menuOutline" />
      <span class="menu-text">{{ $t('ui.menu.tools') }}</span>
    </button>

    <Teleport to="body">
      <div
        v-if="isMenuOpen"
        class="menu-overlay"
        @click="closeMenu"
      />
    </Teleport>

    <div
      v-if="isMenuOpen"
      class="menu-dropdown"
    >
      <div class="menu-header">
        <h4>{{ $t('ui.menu.tools') }}</h4>
      </div>

      <div class="menu-items">
        <button
          class="menu-item"
          @click="openRomAssembly"
        >
          <IonIcon :icon="constructOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.romAssembly') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.romAssemblyDesc') }}</span>
          </div>
        </button>

        <button
          class="menu-item"
          @click="openRomAnalyzer"
        >
          <IonIcon :icon="analyticsOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.romAnalyzer') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.romAnalyzerDesc') }}</span>
          </div>
        </button>

        <button
          class="menu-item"
          @click="openDebugTool"
        >
          <IonIcon :icon="terminalOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.debugTool') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.debugToolDesc') }}</span>
          </div>
        </button>

        <div class="menu-divider" />

        <button
          class="menu-item"
          @click="openSettings"
        >
          <IonIcon :icon="settingsOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.settings') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.settingsDesc') }}</span>
          </div>
        </button>

        <button
          class="menu-item"
          @click="openAbout"
        >
          <IonIcon :icon="informationCircleOutline" />
          <div class="menu-item-content">
            <span class="menu-item-title">{{ $t('ui.menu.about') }}</span>
            <span class="menu-item-desc">{{ $t('ui.menu.aboutDesc') }}</span>
          </div>
        </button>
      </div>
    </div>

    <!-- ROM组装弹框 -->
    <RomAssemblyModal
      v-model="isRomAssemblyVisible"
      :initial-rom-type="currentMode"
      @close="closeRomAssembly"
      @assembled="onRomAssembled"
    />

    <!-- ROM分析器弹框 -->
    <RomAnalyzerModal
      v-model="isRomAnalyzerVisible"
      @close="closeRomAnalyzer"
    />

    <!-- 调试工具弹框 -->
    <DebugToolModal
      v-model="isDebugToolVisible"
      :device="device"
      @close="closeDebugTool"
    />

    <!-- 关于弹框 -->
    <AboutModal
      v-model="isAboutVisible"
      @close="closeAbout"
    />

    <!-- 高级设置面板 -->
    <AdvancedSettingsModal
      v-model="isSettingsVisible"
      @close="closeSettings"
      @applied="onSettingsApplied"
    />
  </div>
</template>

<script setup lang="ts">
import { IonIcon } from '@ionic/vue';
import {
  analyticsOutline,
  constructOutline,
  informationCircleOutline,
  menuOutline,
  settingsOutline,
  terminalOutline,
} from 'ionicons/icons';
import { ref } from 'vue';
import { useI18n } from 'vue-i18n';

import AboutModal from '@/components/modal/AboutModal.vue';
import AdvancedSettingsModal from '@/components/modal/AdvancedSettingsModal.vue';
import DebugToolModal from '@/components/modal/DebugToolModal.vue';
import RomAnalyzerModal from '@/components/modal/RomAnalyzerModal.vue';
import RomAssemblyModal from '@/components/modal/RomAssemblyModal.vue';
import { useToast } from '@/composables/useToast';
import type { DeviceInfo } from '@/types/device-info';
import type { AssembledRom } from '@/types/rom-assembly';

const { t } = useI18n();
const { showToast } = useToast();

const props = withDefaults(defineProps<{
  currentMode?: 'MBC5' | 'GBA';
  device?: DeviceInfo | null;
}>(), {
  currentMode: 'GBA',
  device: null,
});

const emit = defineEmits<{
  'rom-assembled': [rom: AssembledRom, romType: 'MBC5' | 'GBA'];
}>();

const isMenuOpen = ref(false);
const isRomAssemblyVisible = ref(false);
const isRomAnalyzerVisible = ref(false);
const isDebugToolVisible = ref(false);
const isSettingsVisible = ref(false);
const isAboutVisible = ref(false);

function toggleMenu() {
  isMenuOpen.value = !isMenuOpen.value;
}

function closeMenu() {
  isMenuOpen.value = false;
}

function openRomAssembly() {
  closeMenu();
  isRomAssemblyVisible.value = true;
}

function closeRomAssembly() {
  isRomAssemblyVisible.value = false;
}

function onRomAssembled(rom: AssembledRom, romType: 'MBC5' | 'GBA') {
  emit('rom-assembled', rom, romType);
  showToast(t('messages.romAssembly.applied'), 'success');
}

function openRomAnalyzer() {
  closeMenu();
  isRomAnalyzerVisible.value = true;
}

function closeRomAnalyzer() {
  isRomAnalyzerVisible.value = false;
}

function openDebugTool() {
  closeMenu();
  isDebugToolVisible.value = true;
}

function closeDebugTool() {
  isDebugToolVisible.value = false;
}

function openSettings() {
  closeMenu();
  isSettingsVisible.value = true;
}

function closeSettings() {
  isSettingsVisible.value = false;
}

function onSettingsApplied() {
  showToast(t('ui.settings.messages.applied'), 'success');
}

function openAbout() {
  closeMenu();
  isAboutVisible.value = true;
}

function closeAbout() {
  isAboutVisible.value = false;
}
</script>

<style scoped>
.app-menu-container {
  position: relative;
}

.menu-trigger {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 8px;
  cursor: pointer;
  transition: all 0.2s ease;
  font-size: 0.9rem;
  color: #495057;
  min-width: 120px;
}

.menu-trigger:hover {
  background: #e9ecef;
  border-color: #adb5bd;
}

.menu-trigger.active {
  background: #007bff;
  border-color: #007bff;
  color: white;
}

.menu-text {
  font-weight: 500;
}

.menu-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  z-index: 999;
}

.menu-dropdown {
  position: absolute;
  top: calc(100% + 8px);
  left: 0;
  background: white;
  border: 1px solid #e1e8ed;
  border-radius: 12px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.15);
  z-index: 1000;
  min-width: 320px;
  overflow: hidden;
}

.menu-header {
  padding: 16px 20px 12px;
  border-bottom: 1px solid #f1f3f4;
  background: #f8f9fa;
}

.menu-header h4 {
  margin: 0;
  color: #2c3e50;
  font-size: 1rem;
  font-weight: 600;
}

.menu-items {
  padding: 8px 0;
}

.menu-item {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 20px;
  background: none;
  border: none;
  cursor: pointer;
  transition: background 0.2s ease;
  text-align: left;
}

.menu-item:hover:not(:disabled) {
  background: #f8f9fa;
}

.menu-item:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.menu-item-content {
  display: flex;
  flex-direction: column;
  gap: 2px;
  flex: 1;
}

.menu-item-title {
  font-weight: 600;
  color: #2c3e50;
  font-size: 0.9rem;
}

.menu-item-desc {
  font-size: 0.8rem;
  color: #6c757d;
  line-height: 1.3;
}

.menu-item:disabled .menu-item-title {
  color: #adb5bd;
}

.menu-item:disabled .menu-item-desc {
  color: #adb5bd;
}

.menu-divider {
  height: 1px;
  background: #e9ecef;
  margin: 8px 20px;
}
</style>
