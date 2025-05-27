<template>
  <div class="flashburner-container">
    <div class="mode-tabs-card">
      <button
        :class="{active: mode==='GBA'}"
        @click="mode='GBA'"
      >
        <span class="tab-icon">🎮</span> {{ $t('ui.mode.gba') }}
      </button>
      <button
        :class="{active: mode==='MBC5'}"
        @click="mode='MBC5'"
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
        
        <ChipOperations
          :device-ready="deviceReady"
          :busy="busy"
          :id-str="idStr"
          @read-id="readID"
          @erase-chip="eraseChip"
        />
        
        <RomOperations
          :device-ready="deviceReady"
          :busy="busy"
          :rom-file-data="romFileData"
          :rom-file-name="romFileName"
          :write-progress="writeProgress"
          :write-detail="writeDetail"
          @file-selected="onRomFileSelected"
          @file-cleared="onRomFileCleared"
          @write-rom="writeToDevice"
          @read-rom="readRom"
          @verify-rom="verifyRom"
        />
        
        <RamOperations
          :mode="mode"
          :device-ready="deviceReady"
          :busy="busy"
          :ram-file-data="ramFileData"
          :ram-file-name="ramFileName"
          :ram-write-progress="ramWriteProgress"
          :ram-write-detail="ramWriteDetail"
          @file-selected="onRamFileSelected"
          @file-cleared="onRamFileCleared"
          @write-ram="writeRam"
          @read-ram="readRam"
          @verify-ram="verifyRam"
        />
      </div>
      
      <LogViewer
        :logs="logs"
        :title="t('ui.log.title')"
        @clear-logs="clearLog"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { useI18n } from 'vue-i18n'
import { 
  // GBC Commands
  gbc_direct_write, gbc_read
} from '../utils/protocol.js'
import { GBAAdapter } from '../utils/gba_adapter.js'
import { MBC5Adapter } from '../utils/mbc5_adapter.js'
import ChipOperations from './ChipOperations.vue'
import RomOperations from './RomOperations.vue'
import RamOperations from './RamOperations.vue'
import LogViewer from './LogViewer.vue'

const { t } = useI18n()

const props = defineProps({
  // eslint-disable-next-line vue/require-default-prop
  device: Object,
  deviceReady: Boolean
})

const mode = ref('GBA')
const busy = ref(false)
const result = ref('')
const idStr = ref('')
const romFileData = ref(null)
const romFileName = ref('')
const ramFileData = ref(null)
const ramFileName = ref('')
const writeProgress = ref(null)
const writeDetail = ref('')
const ramWriteProgress = ref(null)
const ramWriteDetail = ref('')
const logs = ref([])
const gbaAdapter = ref(null)
const mbc5Adapter = ref(null)

// 当设备连接状态改变时，初始化适配器
watch(() => props.deviceReady, (newVal) => {
  if (newVal && props.device) {
    gbaAdapter.value = new GBAAdapter(
      props.device, 
      (msg) => log(msg), 
      (progress, detail) => updateProgress(progress, detail),
      t
    )
    mbc5Adapter.value = new MBC5Adapter(props.device, { t })
    mbc5Adapter.value.setProgressCallback((progress) => {
      if (mode.value === 'MBC5') {
        writeProgress.value = progress
        ramWriteProgress.value = progress
      }
    })
    mbc5Adapter.value.setMessageCallback((msg) => log(msg))
  } else {
    gbaAdapter.value = null
    mbc5Adapter.value = null
  }
})

function updateProgress(progress, detail) {
  if (mode.value === 'GBA') {
    // 根据操作类型判断更新哪个进度条
    if (detail && detail.includes('RAM')) {
      ramWriteProgress.value = progress
      ramWriteDetail.value = detail
    } else {
      writeProgress.value = progress
      writeDetail.value = detail
    }
  }
}

function log(msg) {
  const time = new Date().toLocaleTimeString()
  logs.value.push(`[${time}] ${msg}`)
  if (logs.value.length > 500) logs.value.shift()
}

function clearLog() {
  logs.value = []
}

// 文件处理函数
function onRomFileSelected(fileInfo) {
  romFileName.value = fileInfo.name
  romFileData.value = fileInfo.data
  log(t('file.selectRom', { name: fileInfo.name, size: formatFileSize(fileInfo.size) }))
}

function onRomFileCleared() {
  romFileData.value = null
  romFileName.value = ''
  log(t('file.clearRom'))
}

function onRamFileSelected(fileInfo) {
  ramFileName.value = fileInfo.name
  ramFileData.value = fileInfo.data
  log(t('file.selectRam', { name: fileInfo.name, size: formatFileSize(fileInfo.size) }))
}

function onRamFileCleared() {
  ramFileData.value = null
  ramFileName.value = ''
  log(t('file.clearRam'))
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

async function readID() {
  busy.value = true
  result.value = ''
  
  if (mode.value === 'GBA' && gbaAdapter.value) {
    const response = await gbaAdapter.value.readID()
    if (response.success) {
      idStr.value = response.idStr
      result.value = response.message
    } else {
      result.value = response.message
    }
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      const id = await mbc5Adapter.value.readID()
      const idStr = id.map(b => b.toString(16).toUpperCase().padStart(2, '0')).join(' ')
      idStr.value = idStr
      
      // 识别芯片类型
      let chipType = '未知芯片'
      if (id.every((val, idx) => val === [0xc2, 0xc2, 0xcb, 0xcb][idx])) {
        chipType = 'MX29LV640EB'
      } else if (id.every((val, idx) => val === [0xc2, 0xc2, 0xc9, 0xc9][idx])) {
        chipType = 'MX29LV640ET'
      } else if (id.every((val, idx) => val === [0x01, 0x01, 0x7e, 0x7e][idx])) {
        chipType = 'S29GL256N'
      }
      
      result.value = `${t('operation.readIdSuccess')}: ${chipType}`
      log(`ROM ID: ${idStr} (${chipType})`)
      
      // 获取容量信息
      try {
        const sizeInfo = await mbc5Adapter.value.getROMSize()
        log(`容量: ${sizeInfo.deviceSize} 扇区数量: ${sizeInfo.sectorCount} 扇区大小: ${sizeInfo.sectorSize} BuffWr: ${sizeInfo.bufferWriteBytes}`)
      } catch (e) {
        log(`获取容量信息失败: ${e.message}`)
      }
    } catch (e) {
      result.value = t('operation.readIdFailed') + ': ' + e.message
      log(`${t('operation.readIdFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
}

async function eraseChip() {
  busy.value = true
  result.value = ''
  
  if (mode.value === 'GBA' && gbaAdapter.value) {
    const response = await gbaAdapter.value.eraseChip()
    result.value = response.message
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      await mbc5Adapter.value.eraseChip()
      result.value = t('operation.eraseSuccess')
    } catch (e) {
      result.value = t('operation.eraseFailed') + ': ' + e.message
      log(`${t('operation.eraseFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
}

async function writeToDevice() {
  busy.value = true
  result.value = ''
  writeProgress.value = 0
  writeDetail.value = ''

  if (mode.value === 'GBA' && gbaAdapter.value) {
    const response = await gbaAdapter.value.writeROM(romFileData.value, true) // 使用直接写入模式
    result.value = response.message
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      // 检查是否需要擦除
      const isBlank = await mbc5Adapter.value.isBlank(0)
      if (!isBlank) {
        log('Flash不为空，开始擦除...')
        const sizeInfo = await mbc5Adapter.value.getROMSize()
        await mbc5Adapter.value.eraseSectors(0, romFileData.value.length - 1, sizeInfo.sectorSize)
      }
      
      await mbc5Adapter.value.writeROM(romFileData.value)
      result.value = t('rom.writeSuccess')
    } catch (e) {
      result.value = t('rom.writeFailed') + ': ' + e.message
      log(`${t('rom.writeFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
  setTimeout(() => { writeProgress.value = null; writeDetail.value = '' }, 1500)
}

async function readRom() {
  busy.value = true
  result.value = ''
  
  if (mode.value === 'GBA' && gbaAdapter.value) {
    const defaultSize = romFileData.value ? romFileData.value.length : 0x200000
    const response = await gbaAdapter.value.readROM(defaultSize)
    
    if (response.success) {
      result.value = response.message
      saveAsFile(response.data, 'exported.rom')
    } else {
      result.value = response.message
    }
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      const defaultSize = romFileData.value ? romFileData.value.length : 0x200000
      const data = await mbc5Adapter.value.readROM(defaultSize)
      result.value = t('rom.readSuccess', { size: data.length })
      saveAsFile(data, 'exported.rom')
    } catch (e) {
      result.value = t('rom.readFailed') + ': ' + e.message
      log(`${t('rom.readFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
}

async function verifyRom() {
  busy.value = true
  result.value = ''
  
  if (mode.value === 'GBA' && gbaAdapter.value) {
    const response = await gbaAdapter.value.verifyROM(romFileData.value)
    result.value = response.message
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      const success = await mbc5Adapter.value.verifyROM(romFileData.value)
      result.value = success ? t('rom.verifySuccess') : t('rom.verifyFailed')
    } catch (e) {
      result.value = t('rom.verifyFailed') + ': ' + e.message
      log(`${t('rom.verifyFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
}

async function writeRam() {
  busy.value = true
  result.value = ''
  ramWriteProgress.value = 0
  ramWriteDetail.value = ''
  
  if (mode.value === 'GBA' && gbaAdapter.value) {
    // 使用适配器写入RAM，默认使用SRAM类型
    const response = await gbaAdapter.value.writeRAM(ramFileData.value, "SRAM")
    result.value = response.message
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      await mbc5Adapter.value.writeRAM(ramFileData.value)
      result.value = t('ram.writeSuccess')
    } catch (e) {
      result.value = t('ram.writeFailed') + ': ' + e.message
      log(`${t('ram.writeFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
  setTimeout(() => { ramWriteProgress.value = null; ramWriteDetail.value = '' }, 1500)
}

async function readRam() {
  busy.value = true
  result.value = ''
  
  if (mode.value === 'GBA' && gbaAdapter.value) {
    const defaultSize = ramFileData.value ? ramFileData.value.length : 0x8000
    const response = await gbaAdapter.value.readRAM(defaultSize, "SRAM")
    
    if (response.success) {
      result.value = response.message
      saveAsFile(response.data, 'exported.sav')
    } else {
      result.value = response.message
    }
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      const defaultSize = ramFileData.value ? ramFileData.value.length : 0x8000
      const data = await mbc5Adapter.value.readRAM(defaultSize)
      result.value = t('ram.readSuccess', { size: data.length })
      saveAsFile(data, 'exported.sav')
    } catch (e) {
      result.value = t('ram.readFailed') + ': ' + e.message
      log(`${t('ram.readFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
}

async function verifyRam() {
  busy.value = true
  result.value = ''
  
  if (mode.value === 'GBA' && gbaAdapter.value) {
    const response = await gbaAdapter.value.verifyRAM(ramFileData.value, "SRAM")
    result.value = response.message
  } else if (mode.value === 'MBC5' && mbc5Adapter.value) {
    try {
      const success = await mbc5Adapter.value.verifyRAM(ramFileData.value)
      result.value = success ? t('ram.verifySuccess') : t('ram.verifyFailed')
    } catch (e) {
      result.value = t('ram.verifyFailed') + ': ' + e.message
      log(`${t('ram.verifyFailed')}: ${e.message}`)
    }
  } else {
    result.value = '未支持的模式或适配器未初始化'
  }
  
  busy.value = false
}

function saveAsFile(data, filename) {
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
  min-width: 0;
  display: flex;
  flex-direction: column;
  overflow-y: auto;
  padding-right: 8px;
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
    height: auto; /* 移动端取消固定高度 */
  }
  
  .content-area {
    width: 100%;
    overflow-y: visible; /* 移动端取消滚动 */
    padding-right: 0; /* 移动端不需要滚动条空间 */
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
  font-size: 1rem;
  color: #333;
}

.status.busy {
  color: #e67e22;
  font-weight: bold;
}
</style>
