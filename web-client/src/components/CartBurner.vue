<template>
  <div class="flashburner-container">
    <div class="mode-tabs-card">
      <button
        :class="{ active: mode === 'GBA' }"
        @click="mode = 'GBA'"
      >
        <span class="tab-icon">🎮</span> {{ $t('ui.mode.gba') }}
      </button>
      <button
        :class="{ active: mode === 'MBC5' }"
        @click="mode = 'MBC5'"
      >
        <span class="tab-icon">🕹️</span> {{ $t('ui.mode.mbc5') }}
      </button>
    </div>
    <div class="main-layout">
      <div class="content-area">
        <div class="status-row">
          <span
            v-if="busy"
            class="status busy"
          >{{ $t('ui.operation.busy') }}</span>
          <span
            v-if="result"
            class="status"
          >{{ result }}</span>
        </div>

        <TransitionGroup
          name="panel-move" 
          tag="div"
          class="operations-container"
        >
          <ChipOperations
            key="chip-operations"
            :device-ready="deviceReady"
            :busy="busy"
            :id-str="idStr"
            @read-id="readID"
            @erase-chip="eraseChip"
          />
          <!-- 共用进度条 -->
          <ProgressDisplay
            v-if="currentProgress !== null && currentProgress !== undefined"
            key="progress"
            :progress="currentProgress"
            :detail="currentProgressDetail"
          />

          <RomOperations
            key="rom-operations"
            :mode="mode"
            :device-ready="deviceReady"
            :busy="busy"
            :rom-file-data="romFileData || undefined"
            :rom-file-name="romFileName"
            :selected-rom-size="selectedRomSize"
            @file-selected="onRomFileSelected"
            @file-cleared="onRomFileCleared"
            @write-rom="writeRom"
            @read-rom="readRom"
            @verify-rom="verifyRom"
            @rom-size-change="onRomSizeChange"
          />

          <RamOperations
            key="ram-operations"
            :mode="mode"
            :device-ready="deviceReady"
            :busy="busy"
            :ram-file-data="ramFileData || undefined"
            :ram-file-name="ramFileName"
            :selected-ram-size="selectedRamSize"
            :selected-ram-type="selectedRamType"
            @file-selected="onRamFileSelected"
            @file-cleared="onRamFileCleared"
            @write-ram="writeRam"
            @read-ram="readRam"
            @verify-ram="verifyRam"
            @ram-size-change="onRamSizeChange"
            @ram-type-change="onRamTypeChange"
          />
        </TransitionGroup>
      </div>

      <LogViewer
        :logs="logs"
        :title="t('ui.log.title')"
        @clear-logs="clearLog"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import ChipOperations from '@/components/operaiton/ChipOperations.vue'
import RomOperations from '@/components/operaiton/RomOperations.vue'
import RamOperations from '@/components/operaiton/RamOperations.vue'
import LogViewer from '@/components/common/LogViewer.vue'
import ProgressDisplay from '@/components/common/ProgressDisplay.vue'
import CartridgeAdapter from '@/utils/CartridgeAdapter'
import { GBAAdapter } from '@/utils/GBAAdapter.ts'
import { MBC5Adapter } from '@/utils/MBC5Adapter.ts'
import { MockAdapter } from '@/utils/MockAdapter.ts'
import { DebugConfig } from '@/utils/DebugConfig.ts'
import { DeviceInfo } from '@/types/DeviceInfo.ts'
import { FileInfo } from '@/types/FileInfo.ts'

const { t } = useI18n()

const props = defineProps<{
  device: DeviceInfo | null,
  deviceReady: boolean
}>()

const mode = ref<'GBA' | 'MBC5'>('GBA')
const busy = ref(false)
const result = ref('')
const idStr = ref('')
const operateProgress = ref<number | null>(null)
const operateProgressDetail = ref<string | undefined>('')
const logs = ref<string[]>([])

// Adapter
const gbaAdapter = ref<CartridgeAdapter | null>()
const mbc5Adapter = ref<CartridgeAdapter | null>()

// ROM
const romFileData = ref<Uint8Array | null>(null)
const romFileName = ref('')
const selectedRomSize = ref('0x800000') // 默认8MB

// RAM
const ramFileData = ref<Uint8Array | null>(null)
const ramFileName = ref('')
const selectedRamSize = ref('0x8000')   // 默认32KB
const selectedRamType = ref('SRAM')     // 默认SRAM

// 计算当前显示的进度
const currentProgress = computed(() => {
  return operateProgress.value !== null ? operateProgress.value : undefined
})

const currentProgressDetail = computed(() => {
  return operateProgressDetail.value || undefined
})

// 设备连接状态改变时，初始化适配器
watch(() => props.deviceReady, (newVal) => {
  if (newVal && props.device) {
    if (DebugConfig.enabled) {
      // 调试模式下使用 MockAdapter
      const adapter = new MockAdapter(
        (msg) => log(msg),
        (progress, detail) => updateProgress(progress, detail),
        t
      )
      gbaAdapter.value = adapter
      mbc5Adapter.value = adapter
    } else {
      // 正常模式下使用真实适配器
      gbaAdapter.value = new GBAAdapter(
        props.device,
        (msg) => log(msg),
        (progress, detail) => updateProgress(progress, detail),
        t
      )
      mbc5Adapter.value = new MBC5Adapter(
        props.device,
        (msg) => log(msg),
        (progress, detail) => updateProgress(progress, detail),
        t
      )
    }
  } else {
    gbaAdapter.value = null
    mbc5Adapter.value = null
  }
})

function updateProgress(progress: number, detail: string | undefined) {
  operateProgress.value = progress
  operateProgressDetail.value = detail
}

function log(msg: string) {
  const time = new Date().toLocaleTimeString()
  logs.value.push(`[${time}] ${msg}`)
  if (logs.value.length > 500) logs.value.shift()
}

function clearLog() {
  logs.value = []
}

// 文件处理函数
function onRomFileSelected(fileInfo: FileInfo) {
  romFileName.value = fileInfo.name
  romFileData.value = fileInfo.data
  log(t('messages.file.selectRom', { name: fileInfo.name, size: formatFileSize(fileInfo.size) }))
}

function onRomFileCleared() {
  romFileData.value = null
  romFileName.value = ''
  log(t('messages.file.clearRom'))
}

function onRamFileSelected(fileInfo: FileInfo) {
  ramFileName.value = fileInfo.name
  ramFileData.value = fileInfo.data
  log(t('messages.file.selectRam', { name: fileInfo.name, size: formatFileSize(fileInfo.size) }))
}

function onRamFileCleared() {
  ramFileData.value = null
  ramFileName.value = ''
  log(t('messages.file.clearRam'))
}

// 大小选择处理函数
function onRomSizeChange(size: string) {
  selectedRomSize.value = size
  log(t('messages.rom.sizeChanged', { size: formatSize(size) }))
}

function onRamSizeChange(size: string) {
  selectedRamSize.value = size
  log(t('messages.ram.sizeChanged', { size: formatSize(size) }))
}

function onRamTypeChange(type: string) {
  selectedRamType.value = type
  log(t('messages.ram.typeChanged', { type }))
}

// 格式化大小显示
function formatSize(hexSize: string): string {
  const bytes = parseInt(hexSize, 16)
  if (bytes >= 1024 * 1024) {
    return `${bytes / (1024 * 1024)}MB`
  } else if (bytes >= 1024) {
    return `${bytes / 1024}KB`
  }
  return `${bytes}B`
}

// 格式化文件大小
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

function getAdapter() {
  if (mode.value === 'GBA') {
    return gbaAdapter.value
  } else if (mode.value === 'MBC5') {
    return mbc5Adapter.value
  }
  result.value = t('messages.operation.unsupportedMode')
  return null
}

async function readID() {
  busy.value = true
  result.value = ''

  try {
    let adapter = getAdapter()
    if (!adapter) {
      return
    }

    const response = await adapter.readID()
    if (response.success) {
      idStr.value = response.idStr || ''
      result.value = response.message
    } else {
      result.value = response.message
    }
  } catch (e) {
    result.value = t('messages.operation.readIdFailed')
    log(`${t('messages.operation.readIdFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
  }
}

async function eraseChip() {
  busy.value = true
  result.value = ''

  try {
    const adapter = getAdapter()
    if (!adapter) {
      return
    }

    const response = await adapter.eraseChip()
    result.value = response.message
  } catch (e) {
    result.value = t('messages.operation.eraseFailed')
    log(`${t('messages.operation.eraseFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
    setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function writeRom() {
  busy.value = true
  result.value = ''
  operateProgress.value = 0
  operateProgressDetail.value = ''

  try {
    const adapter = getAdapter()
    if (!adapter || !romFileData.value) {
      result.value = t('messages.operation.unsupportedMode')
      return
    }

    const response = await adapter.writeROM(romFileData.value, { useDirectWrite: false})
    result.value = response.message
  } catch (e) {
    result.value = t('messages.rom.writeFailed')
    log(`${t('messages.rom.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
    setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function readRom() {
  busy.value = true
  result.value = ''

  try {

    const adapter = getAdapter()
    if (!adapter) {
      return
    }

    const romSize = romFileData.value ? romFileData.value.length : parseInt(selectedRomSize.value, 16)
    const response = await adapter.readROM(romSize)
    if (response.success) {
      result.value = response.message
      if (response.data) {
        saveAsFile(response.data, 'exported.rom')
      }
    } else {
      result.value = response.message
    }
  } catch (e) {
    result.value = t('messages.rom.readFailed')
    log(`${t('messages.rom.readFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
    setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function verifyRom() {
  busy.value = true
  result.value = ''

  try {
    const adapter = getAdapter()
    if (!adapter || !romFileData.value) {
      result.value = t('messages.operation.unsupportedMode')
      return
    }

    const response = await adapter.verifyROM(romFileData.value)
    result.value = response.message

  } catch (e) {
    result.value = t('messages.rom.verifyFailed')
    log(`${t('messages.rom.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
    setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function writeRam() {
  busy.value = true
  result.value = ''
  operateProgress.value = 0
  operateProgressDetail.value = ''

  try {
    const adapter = getAdapter()
    if (!adapter || !ramFileData.value) {
      result.value = t('messages.operation.unsupportedMode')
      return
    }

    const response = await adapter.writeRAM(ramFileData.value, { ramType: selectedRamType.value as 'SRAM' | 'FLASH' })
    result.value = response.message
  } catch (e) {
    result.value = t('messages.ram.writeFailed')
    log(`${t('messages.ram.writeFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
    setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function readRam() {
  busy.value = true
  result.value = ''

  try {
    const adapter = getAdapter()
    if (!adapter) {
      return
    }

    const defaultSize = ramFileData.value ? ramFileData.value.length : parseInt(selectedRamSize.value, 16)
    const response = await adapter.readRAM(defaultSize, { ramType: selectedRamType.value as 'SRAM' | 'FLASH' })
    if (response.success) {
      result.value = response.message
      if (response.data) {
        saveAsFile(response.data, 'exported.sav')
      }
    } else {
      result.value = response.message
    }
  } catch (e) {
    result.value = t('messages.ram.readFailed')
    log(`${t('messages.ram.readFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
    setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

async function verifyRam() {
  busy.value = true
  result.value = ''

  try {
    const adapter = getAdapter()
    if (!adapter || !ramFileData.value) {
      result.value = t('messages.operation.unsupportedMode')
      return
    }

    const response = await adapter.verifyRAM(ramFileData.value, { ramType: selectedRamType.value as 'SRAM' | 'FLASH' })
    result.value = response.message
  } catch (e) {
    result.value = t('messages.ram.verifyFailed')
    log(`${t('messages.ram.verifyFailed')}: ${e instanceof Error ? e.message : String(e)}`)
  } finally {
    busy.value = false
    setTimeout(() => { operateProgress.value = null; operateProgressDetail.value = '' }, 1500)
  }
}

function saveAsFile(data: Uint8Array, filename: string) {
  const blob = new Blob([data], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
</script>

<style scoped>
.flashburner-container {
  max-width: 1200px;
  margin: 32px auto;
  padding: 24px 32px;
  background: #fafbfc;
  border-radius: 14px;
  box-shadow: 0 2px 16px #0002;
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
}

/* 响应式主布局 */
.main-layout {
  display: flex;
  gap: 24px;
  height: 820px;
  align-items: stretch;
}

/* 内容区域 */
.content-area {
  flex: 1;
  min-width: 400px;
  max-width: 450px;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-right: 8px;
}

/* 操作容器 */
.operations-container {
  display: flex;
  flex-direction: column;
  position: relative;
}

/* TransitionGroup 动画 - 面板移动效果 */
.panel-move-move,
.panel-move-enter-active,
.panel-move-leave-active {
  transition: all 0.4s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

.panel-move-enter-from {
  opacity: 0;
  transform: translateY(-20px);
}

.panel-move-leave-to {
  opacity: 0;
  transform: translateY(-10px);
}

/* 确保离开的元素不占用布局空间 */
.panel-move-leave-active {
  position: absolute;
  width: 100%;
  z-index: -1;
}

/* 为操作面板添加平滑的位置变化动画 */
.content-area > * {
  transition: transform 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94), 
              margin 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94);
}

/* 操作面板向上移动时的优化 */
.content-area > *:not(:first-child) {
  transform-origin: top center;
}

/* 美化滚动条 */
.content-area::-webkit-scrollbar {
  width: 6px;
}

.content-area::-webkit-scrollbar-track {
  background: #f1f1f1;
  border-radius: 3px;
}

.content-area::-webkit-scrollbar-thumb {
  background: #c1c1c1;
  border-radius: 3px;
}

.content-area::-webkit-scrollbar-thumb:hover {
  background: #a1a1a1;
}

/* 移动端响应式 */
@media (max-width: 768px) {
  .flashburner-container {
    margin: 16px;
    padding: 16px 20px;
  }

  .main-layout {
    flex-direction: column;
    gap: 20px;
    height: auto;
  }

  .content-area {
    min-width: 320px;
    max-width: 100%;
    overflow-y: visible;
    padding-right: 0;
  }
  
  .mode-tabs-card button {
    font-size: 1rem;
    padding: 10px 0 8px 0;
  }
}

/* 小屏幕进一步优化 */
@media (max-width: 480px) {
  .flashburner-container {
    margin: 8px;
    padding: 12px 16px;
  }
  
  .content-area {
    min-width: 280px;
  }
}

.mode-tabs-card {
  display: flex;
  gap: 0;
  margin-bottom: 22px;
  background: #e3f2fd;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 1px 4px #0001;
}

.mode-tabs-card button {
  flex: 1 1 0;
  border: none;
  background: none;
  padding: 12px 0 10px 0;
  font-size: 1.08rem;
  font-weight: 600;
  color: #1976d2;
  background: #e3f2fd;
  transition: background 0.2s, color 0.2s;
  cursor: pointer;
  border-bottom: 2px solid transparent;
  display: flex;
  align-items: center;
  justify-content: center;
  outline: none;
}

.mode-tabs-card button:focus {
  outline: none;
}

.mode-tabs-card button.active {
  background: #fff;
  color: #1565c0;
  border-bottom: 2.5px solid #1976d2;
  z-index: 1;
}

.tab-icon {
  margin-right: 6px;
  font-size: 1.2em;
}

.status-row {
  margin-top: 18px;
  min-height: 24px;
}

.status {
  max-width: 100%;
  word-wrap: break-word;
  font-size: 1rem;
  color: #333;
}

.status.busy {
  color: #e67e22;
  font-weight: bold;
}
</style>
