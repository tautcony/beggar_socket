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
        <section class="section">
          <h2>芯片操作</h2>
          <div class="button-row">
            <button
              :disabled="!deviceReady || busy"
              @click="readID"
            >
              读取ID
            </button>
            <button
              :disabled="!deviceReady || busy"
              @click="eraseChip"
            >
              全片擦除
            </button>
          </div>
          <div
            v-if="idStr"
            class="id-display"
          >
            ID: {{ idStr }}
          </div>
        </section>
        <section class="section">
          <h2>ROM 操作</h2>
          <div class="file-upload-area">
            <div 
              class="file-drop-zone"
              :class="{ 
                'has-file': romFileData,
                'drag-over': romDragOver,
                'disabled': !deviceReady || busy
              }"
              @click="triggerRomFileSelect"
              @dragover.prevent="handleRomDragOver"
              @dragleave.prevent="handleRomDragLeave"
              @drop.prevent="handleRomDrop"
            >
              <input 
                ref="romFileInput"
                type="file" 
                :disabled="!deviceReady || busy" 
                style="display: none"
                accept=".rom,.gba,.gb,.gbc"
                @change="onRomFileChange"
              >
              <div
                v-if="!romFileData"
                class="drop-zone-content"
              >
                <div class="upload-icon">
                  📁
                </div>
                <div class="upload-text">
                  <p class="main-text">
                    点击选择ROM文件
                  </p>
                  <p class="sub-text">
                    或拖拽文件到此处
                  </p>
                  <p class="hint-text">
                    支持 .rom, .gba, .gb, .gbc 格式
                  </p>
                </div>
              </div>
              <div
                v-else
                class="file-preview"
              >
                <div class="file-icon">
                  🎮
                </div>
                <div class="file-details">
                  <div class="file-name">
                    {{ romFileName }}
                  </div>
                  <div class="file-size">
                    {{ formatFileSize(romFileData.length) }}
                  </div>
                  <div class="file-type">
                    ROM 文件
                  </div>
                </div>
                <button 
                  class="remove-file-btn"
                  :disabled="busy"
                  @click.stop="clearRomFile"
                >
                  ✕
                </button>
              </div>
            </div>
          </div>
          <div class="button-row">
            <button
              :disabled="!deviceReady || !romFileData || busy"
              @click="writeToDevice"
            >
              写入ROM
            </button>
            <button
              :disabled="!deviceReady || busy"
              @click="readRom"
            >
              导出ROM
            </button>
            <button
              :disabled="!deviceReady || !romFileData || busy"
              @click="verifyRom"
            >
              校验ROM
            </button>
          </div>
          <div
            v-if="writeProgress !== null"
            class="progress-row"
          >
            <progress
              :value="writeProgress"
              max="100"
            />
            <span>{{ writeProgress }}%</span>
            <span v-if="writeDetail">{{ writeDetail }}</span>
          </div>
        </section>
        <section class="section">
          <h2>RAM 操作</h2>
          <div
            v-if="mode === 'GBA'"
            class="ram-content"
          >
            <div class="file-upload-area">
              <div 
                class="file-drop-zone"
                :class="{ 
                  'has-file': ramFileData,
                  'drag-over': ramDragOver,
                  'disabled': !deviceReady || busy
                }"
                @click="triggerRamFileSelect"
                @dragover.prevent="handleRamDragOver"
                @dragleave.prevent="handleRamDragLeave"
                @drop.prevent="handleRamDrop"
              >
                <input 
                  ref="ramFileInput"
                  type="file" 
                  :disabled="!deviceReady || busy" 
                  style="display: none"
                  accept=".sav,.ram"
                  @change="onRamFileChange"
                >
                <div
                  v-if="!ramFileData"
                  class="drop-zone-content"
                >
                  <div class="upload-icon">
                    💾
                  </div>
                  <div class="upload-text">
                    <p class="main-text">
                      点击选择RAM文件
                    </p>
                    <p class="sub-text">
                      或拖拽文件到此处
                    </p>
                    <p class="hint-text">
                      支持 .sav, .ram 格式
                    </p>
                  </div>
                </div>
                <div
                  v-else
                  class="file-preview"
                >
                  <div class="file-icon">
                    💾
                  </div>
                  <div class="file-details">
                    <div class="file-name">
                      {{ ramFileName }}
                    </div>
                    <div class="file-size">
                      {{ formatFileSize(ramFileData.length) }}
                    </div>
                    <div class="file-type">
                      RAM 文件
                    </div>
                  </div>
                  <button 
                    class="remove-file-btn"
                    :disabled="busy"
                    @click.stop="clearRamFile"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>
            <div class="button-row">
              <button
                :disabled="!deviceReady || !ramFileData || busy"
                @click="writeRam"
              >
                写入RAM
              </button>
              <button
                :disabled="!deviceReady || busy"
                @click="readRam"
              >
                导出RAM
              </button>
              <button
                :disabled="!deviceReady || !ramFileData || busy"
                @click="verifyRam"
              >
                校验RAM
              </button>
            </div>
            <div
              v-if="ramWriteProgress !== null"
              class="progress-row"
            >
              <progress
                :value="ramWriteProgress"
                max="100"
              />
              <span>{{ ramWriteProgress }}%</span>
              <span v-if="ramWriteDetail">{{ ramWriteDetail }}</span>
            </div>
          </div>
          <div
            v-else
            class="mode-info"
          >
            <p>💡 MBC5 模式下 RAM 操作不可用</p>
          </div>
        </section>
      </div>
      
      <div class="log-section">
        <div class="log-header">
          <h2>日志</h2>
          <button
            class="log-clear"
            @click="clearLog"
          >
            清空
          </button>
        </div>
        <div
          ref="logBox"
          class="log-area-scroll"
        >
          <div
            v-for="(line, idx) in logs"
            :key="idx"
            class="log-line"
          >
            {{ line }}
          </div>
        </div>
      </div>
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
const logBox = ref(null)

// 拖拽状态
const romDragOver = ref(false)
const ramDragOver = ref(false)

// 文件输入引用
const romFileInput = ref(null)
const ramFileInput = ref(null)

function log(msg) {
  const time = new Date().toLocaleTimeString()
  logs.value.push(`[${time}] ${msg}`)
  if (logs.value.length > 500) logs.value.shift()
}
function clearLog() {
  logs.value = []
}

watch(logs, async () => {
  await nextTick()
  if (logBox.value) {
    logBox.value.scrollTop = logBox.value.scrollHeight
  }
})

function onRomFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  processRomFile(file)
}

function onRamFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  processRamFile(file)
}

function processRomFile(file) {
  romFileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    romFileData.value = new Uint8Array(reader.result)
    log(`已选择ROM文件: ${romFileName.value}，大小${formatFileSize(romFileData.value.length)}`)
  }
  reader.readAsArrayBuffer(file)
}

function processRamFile(file) {
  ramFileName.value = file.name
  const reader = new FileReader()
  reader.onload = () => {
    ramFileData.value = new Uint8Array(reader.result)
    log(`已选择RAM文件: ${ramFileName.value}，大小${formatFileSize(ramFileData.value.length)}`)
  }
  reader.readAsArrayBuffer(file)
}

// 格式化文件大小
function formatFileSize(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

// ROM 文件相关
function triggerRomFileSelect() {
  if (!props.deviceReady || busy.value) return
  romFileInput.value.click()
}

function clearRomFile() {
  romFileData.value = null
  romFileName.value = ''
  if (romFileInput.value) romFileInput.value.value = ''
  log('已清除ROM文件选择')
}

function handleRomDragOver(e) {
  if (!props.deviceReady || busy.value) return
  romDragOver.value = true
}

function handleRomDragLeave() {
  romDragOver.value = false
}

function handleRomDrop(e) {
  romDragOver.value = false
  if (!props.deviceReady || busy.value) return
  
  const files = e.dataTransfer.files
  if (files.length > 0) {
    processRomFile(files[0])
  }
}

// RAM 文件相关
function triggerRamFileSelect() {
  if (!props.deviceReady || busy.value) return
  ramFileInput.value.click()
}

function clearRamFile() {
  ramFileData.value = null
  ramFileName.value = ''
  if (ramFileInput.value) ramFileInput.value.value = ''
  log('已清除RAM文件选择')
}

function handleRamDragOver(e) {
  if (!props.deviceReady || busy.value) return
  ramDragOver.value = true
}

function handleRamDragLeave() {
  ramDragOver.value = false
}

function handleRamDrop(e) {
  ramDragOver.value = false
  if (!props.deviceReady || busy.value) return
  
  const files = e.dataTransfer.files
  if (files.length > 0) {
    processRamFile(files[0])
  }
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

.log-section {
  width: 350px;
  flex-shrink: 0;
  display: flex;
  flex-direction: column;
  height: 820px; /* 与主布局相同的固定高度 */
}

.log-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 12px;
  flex-shrink: 0; /* 防止 header 被压缩 */
  height: 32px; /* 固定 header 高度 */
}

.log-header h2 {
  margin: 0;
  font-size: 1.1rem;
  color: #333;
}

.log-clear {
  background: #f44336;
  color: white;
  border: none;
  padding: 4px 8px;
  border-radius: 4px;
  font-size: 0.8rem;
  cursor: pointer;
}

.log-clear:hover {
  background: #d32f2f;
}

.log-area-scroll {
  background: #f4f4f4;
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 8px 8px 8px 12px;
  flex: 1; /* 占用剩余空间 */
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.97rem;
  line-height: 1.6;
  height: calc(820px - 44px); /* 总高度减去 header 高度和 margin */
}

/* 日志区域滚动条样式 */
.log-area-scroll::-webkit-scrollbar {
  width: 6px;
}

.log-area-scroll::-webkit-scrollbar-track {
  background: #e8e8e8;
  border-radius: 3px;
}

.log-area-scroll::-webkit-scrollbar-thumb {
  background: #bbb;
  border-radius: 3px;
}

.log-area-scroll::-webkit-scrollbar-thumb:hover {
  background: #999;
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
  
  .log-section {
    width: 100%;
    height: 350px; /* 移动端给日志区域设置固定高度 */
  }
  
  .log-area-scroll {
    height: calc(350px - 44px) !important; /* 移动端日志滚动区域高度 */
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
.section {
  margin-bottom: 28px;
}
.section h2 {
  font-size: 1.15rem;
  margin-bottom: 10px;
  color: #2c3e50;
  font-weight: 600;
}
.button-row {
  display: flex;
  gap: 16px;
  margin-bottom: 8px;
  flex-wrap: wrap;
}

/* 新的文件上传区域样式 */
.file-upload-area {
  margin-bottom: 12px;
}

.file-drop-zone {
  border: 2px dashed #d1d5db;
  border-radius: 8px;
  padding: 16px;
  text-align: center;
  cursor: pointer;
  transition: all 0.3s ease;
  background: #fafbfc;
  min-height: 80px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.file-drop-zone:hover:not(.disabled) {
  border-color: #1976d2;
  background: #f8faff;
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(25, 118, 210, 0.1);
}

.file-drop-zone.drag-over {
  border-color: #1976d2;
  background: #e3f2fd;
  transform: scale(1.02);
}

.file-drop-zone.has-file {
  border-color: #4caf50;
  background: #f1f8e9;
  border-style: solid;
}

.file-drop-zone.disabled {
  cursor: not-allowed;
  opacity: 0.6;
  border-color: #e0e0e0;
  background: #f5f5f5;
}

.drop-zone-content {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  width: 100%;
}

.upload-icon {
  font-size: 2rem;
  margin-bottom: 4px;
  opacity: 0.7;
}

.upload-text {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.main-text {
  font-size: 0.95rem;
  font-weight: 600;
  color: #2c3e50;
  margin: 0;
}

.sub-text {
  font-size: 0.85rem;
  color: #6c757d;
  margin: 0;
}

.hint-text {
  font-size: 0.75rem;
  color: #9ca3af;
  margin: 0;
}

.file-preview {
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  padding: 6px 8px;
  background: white;
  border-radius: 6px;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
}

.file-icon {
  font-size: 1.8rem;
  opacity: 0.8;
}

.file-details {
  flex: 1;
  text-align: left;
}

.file-name {
  font-size: 0.9rem;
  font-weight: 600;
  color: #2c3e50;
  margin-bottom: 2px;
  word-break: break-all;
}

.file-size {
  font-size: 0.8rem;
  color: #6c757d;
  margin-bottom: 1px;
}

.file-type {
  font-size: 0.75rem;
  color: #4caf50;
  font-weight: 500;
}

.remove-file-btn {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 1px solid #dc3545;
  background: #fff;
  color: #dc3545;
  font-size: 0.8rem;
  font-weight: bold;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s ease;
  padding: 0;
}

.remove-file-btn:hover:not(:disabled) {
  background: #dc3545;
  color: white;
  transform: scale(1.1);
}

.remove-file-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.id-display {
  margin-top: 6px;
  color: #1976d2;
  font-weight: bold;
  letter-spacing: 2px;
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
.progress-row {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 8px 0;
}
progress {
  width: 180px;
  height: 16px;
}

.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}
.log-header h2 {
  font-size: 1.08rem;
  color: #1976d2;
  margin: 0;
}
.log-clear {
  background: #f5f7fa;
  border: 1px solid #bbb;
  border-radius: 5px;
  padding: 2px 14px;
  font-size: 0.98rem;
  color: #888;
  cursor: pointer;
  transition: background 0.2s, color 0.2s;
}
.log-clear:hover {
  background: #e3f2fd;
  color: #1976d2;
}

.log-line {
  white-space: pre-wrap;
  word-break: break-all;
}
button {
  padding: 6px 18px;
  border-radius: 5px;
  border: 1px solid #bbb;
  background: #f5f7fa;
  cursor: pointer;
  font-size: 1rem;
  transition: background 0.2s, color 0.2s;
}
button:disabled {
  background: #eee;
  color: #aaa;
  cursor: not-allowed;
}
button:not(:disabled):hover {
  background: #e3f2fd;
  color: #1976d2;
}
input[type="file"] {
  margin-left: 8px;
}
.mode-info {
  padding: 12px 16px;
  background: #f8f9fa;
  border: 1px solid #dee2e6;
  border-radius: 6px;
  color: #6c757d;
  font-size: 0.95rem;
}
.mode-info p {
  margin: 0;
  display: flex;
  align-items: center;
  gap: 8px;
}
</style>
