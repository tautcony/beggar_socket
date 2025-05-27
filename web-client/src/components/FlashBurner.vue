<template>
  <div class="flashburner-container">
    <div class="mode-tabs-card">
      <button
        :class="{active: mode==='GBA'}"
        @click="mode='GBA'"
      >
        <span class="tab-icon">🎮</span> GBA
      </button>
      <button
        :class="{active: mode==='MBC5'}"
        @click="mode='MBC5'"
      >
        <span class="tab-icon">🕹️</span> MBC5
      </button>
    </div>
    <div class="main-layout">
      <div class="content-area">
        <div class="status-row">
          <span
            v-if="busy"
            class="status busy"
          >操作中...</span>
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
        title="日志"
        @clear-logs="clearLog"
      />
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { 
  // GBA Commands
  rom_readID, rom_eraseChip, rom_direct_write, rom_read, rom_verify, 
  ram_write, ram_read, ram_verify,
  // GBC Commands
  gbc_direct_write, gbc_read
} from '../utils/protocol.js'
import ChipOperations from './ChipOperations.vue'
import RomOperations from './RomOperations.vue'
import RamOperations from './RamOperations.vue'
import LogViewer from './LogViewer.vue'

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
  log(`已选择ROM文件: ${fileInfo.name}，大小${formatFileSize(fileInfo.size)}`)
}

function onRomFileCleared() {
  romFileData.value = null
  romFileName.value = ''
  log('已清除ROM文件选择')
}

function onRamFileSelected(fileInfo) {
  ramFileName.value = fileInfo.name
  ramFileData.value = fileInfo.data
  log(`已选择RAM文件: ${fileInfo.name}，大小${formatFileSize(fileInfo.size)}`)
}

function onRamFileCleared() {
  ramFileData.value = null
  ramFileName.value = ''
  log('已清除RAM文件选择')
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
  log(`[${mode.value}] 开始读取ID`)
  try {
    const id = await rom_readID(props.device)
    idStr.value = id.map(x => x.toString(16).padStart(2, '0')).join(' ')
    result.value = '读取ID成功'
    log(`[${mode.value}] 读取ID成功: ${idStr.value}`)
  } catch (e) {
    result.value = '读取ID失败: ' + e
    log(`[${mode.value}] 读取ID失败: ${e}`)
  }
  busy.value = false
}

async function eraseChip() {
  busy.value = true
  result.value = ''
  log(`[${mode.value}] 开始全片擦除`)
  try {
    await rom_eraseChip(props.device)
    result.value = '擦除成功'
    log(`[${mode.value}] 擦除成功`)
  } catch (e) {
    result.value = '擦除失败: ' + e
    log(`[${mode.value}] 擦除失败: ${e}`)
  }
  busy.value = false
}

async function writeToDevice() {
  busy.value = true
  result.value = ''
  writeProgress.value = 0
  writeDetail.value = ''
  log(`[${mode.value}] 开始写入ROM，大小${romFileData.value.length}字节`)
  try {
    const total = romFileData.value.length
    let written = 0
    const pageSize = 256
    
    // 根据模式选择写入函数
    const writeFunction = mode.value === 'GBA' ? rom_direct_write : gbc_direct_write
    
    // 分块写入并更新进度
    for (let addr = 0; addr < total; addr += pageSize) {
      const chunk = romFileData.value.slice(addr, Math.min(addr + pageSize, total))
      await writeFunction(props.device, chunk, addr) // 使用 baseAddress 参数
      written += chunk.length
      writeProgress.value = Math.floor((written / total) * 100)
      writeDetail.value = `${written} / ${total} 字节`
      if (written % (pageSize * 16) === 0) log(`[${mode.value}] 已写入${written}字节`)
    }
    writeProgress.value = 100
    result.value = '写入成功'
    log(`[${mode.value}] 写入ROM完成`)
  } catch (e) {
    result.value = '写入失败: ' + e
    log(`[${mode.value}] 写入ROM失败: ${e}`)
  }
  busy.value = false
  setTimeout(() => { writeProgress.value = null; writeDetail.value = '' }, 1500)
}

async function readRom() {
  busy.value = true
  result.value = ''
  log(`[${mode.value}] 开始导出ROM`)
  try {
    // 根据模式选择读取函数
    const readFunction = mode.value === 'GBA' ? rom_read : gbc_read
    const defaultSize = romFileData.value ? romFileData.value.length : 0x200000
    const data = await readFunction(props.device, defaultSize)
    result.value = `导出ROM成功，大小：${data.length} 字节`
    log(`[${mode.value}] 导出ROM成功，大小：${data.length} 字节`)
    saveAsFile(data, 'exported.rom')
  } catch (e) {
    result.value = '导出ROM失败: ' + e
    log(`[${mode.value}] 导出ROM失败: ${e}`)
  }
  busy.value = false
}

async function verifyRom() {
  busy.value = true
  result.value = ''
  log(`[${mode.value}] 开始校验ROM`)
  try {
    const ok = await rom_verify(props.device, romFileData.value)
    result.value = ok ? '校验通过' : '校验失败'
    log(`[${mode.value}] 校验ROM: ${ok ? '通过' : '失败'}`)
  } catch (e) {
    result.value = '校验失败: ' + e
    log(`[${mode.value}] 校验ROM失败: ${e}`)
  }
  busy.value = false
}

async function writeRam() {
  busy.value = true
  result.value = ''
  ramWriteProgress.value = 0
  ramWriteDetail.value = ''
  log(`[${mode.value}] 开始写入RAM，大小${ramFileData.value.length}字节`)
  try {
    const total = ramFileData.value.length
    let written = 0
    const pageSize = 256
    
    // 分块写入并更新进度
    for (let addr = 0; addr < total; addr += pageSize) {
      const chunk = ramFileData.value.slice(addr, Math.min(addr + pageSize, total))
      await ram_write(props.device, chunk, addr) // 使用 baseAddress 参数
      written += chunk.length
      ramWriteProgress.value = Math.floor((written / total) * 100)
      ramWriteDetail.value = `${written} / ${total} 字节`
      if (written % (pageSize * 16) === 0) log(`[${mode.value}] 已写入RAM ${written}字节`)
    }
    ramWriteProgress.value = 100
    result.value = 'RAM写入成功'
    log(`[${mode.value}] 写入RAM完成`)
  } catch (e) {
    result.value = 'RAM写入失败: ' + e
    log(`[${mode.value}] 写入RAM失败: ${e}`)
  }
  busy.value = false
  setTimeout(() => { ramWriteProgress.value = null; ramWriteDetail.value = '' }, 1500)
}

async function readRam() {
  busy.value = true
  result.value = ''
  log(`[${mode.value}] 开始导出RAM`)
  try {
    const data = await ram_read(props.device, ramFileData.value ? ramFileData.value.length : 0x8000)
    result.value = `导出RAM成功，大小：${data.length} 字节`
    log(`[${mode.value}] 导出RAM成功，大小：${data.length} 字节`)
    saveAsFile(data, 'exported.sav')
  } catch (e) {
    result.value = '导出RAM失败: ' + e
    log(`[${mode.value}] 导出RAM失败: ${e}`)
  }
  busy.value = false
}

async function verifyRam() {
  busy.value = true
  result.value = ''
  log(`[${mode.value}] 开始校验RAM`)
  try {
    const ok = await ram_verify(props.device, ramFileData.value)
    result.value = ok ? 'RAM校验通过' : 'RAM校验失败'
    log(`[${mode.value}] 校验RAM: ${ok ? '通过' : '失败'}`)
  } catch (e) {
    result.value = 'RAM校验失败: ' + e
    log(`[${mode.value}] 校验RAM失败: ${e}`)
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
