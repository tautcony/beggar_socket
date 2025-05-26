<template>
  <div class="flashburner-container">
    <div class="mode-tabs-card">
      <button :class="{active: mode==='GBA'}" @click="mode='GBA'">
        <span class="tab-icon">🎮</span> GBA
      </button>
      <button :class="{active: mode==='MBC5'}" @click="mode='MBC5'">
        <span class="tab-icon">🕹️</span> MBC5
      </button>
    </div>
    <section class="section">
      <h2>芯片操作</h2>
      <div class="button-row">
        <button @click="readID" :disabled="!deviceReady || busy">读取ID</button>
        <button @click="eraseChip" :disabled="!deviceReady || busy">全片擦除</button>
      </div>
      <div v-if="idStr" class="id-display">ID: {{ idStr }}</div>
    </section>
    <section class="section">
      <h2>ROM 操作</h2>
      <div class="button-row">
        <button @click="writeToDevice" :disabled="!deviceReady || !fileReady || busy">写入ROM</button>
        <button @click="readRom" :disabled="!deviceReady || busy">导出ROM</button>
        <button @click="verifyRom" :disabled="!deviceReady || !fileReady || busy">校验ROM</button>
      </div>
      <div v-if="writeProgress !== null" class="progress-row">
        <progress :value="writeProgress" max="100"></progress>
        <span>{{ writeProgress }}%</span>
        <span v-if="writeDetail">{{ writeDetail }}</span>
      </div>
    </section>
    <section class="section">
      <h2>RAM 操作</h2>
      <div class="ram-upload">
        <label>选择RAM文件：
          <input type="file" @change="onRamFileChange" :disabled="!deviceReady || busy" />
        </label>
      </div>
      <div class="button-row">
        <button @click="writeRam" :disabled="!deviceReady || !ramFileData || busy">写入RAM</button>
        <button @click="readRam" :disabled="!deviceReady || busy">导出RAM</button>
        <button @click="verifyRam" :disabled="!deviceReady || !ramFileData || busy">校验RAM</button>
      </div>
      <div v-if="ramWriteProgress !== null" class="progress-row">
        <progress :value="ramWriteProgress" max="100"></progress>
        <span>{{ ramWriteProgress }}%</span>
        <span v-if="ramWriteDetail">{{ ramWriteDetail }}</span>
      </div>
    </section>
    <div class="status-row">
      <span v-if="busy" class="status busy">操作中...</span>
      <span v-if="result" class="status">{{ result }}</span>
    </div>
    <div class="log-section">
      <div class="log-header">
        <h2>日志</h2>
        <button class="log-clear" @click="clearLog">清空</button>
      </div>
      <div ref="logBox" class="log-area-scroll">
        <div v-for="(line, idx) in logs" :key="idx" class="log-line">{{ line }}</div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, watch, nextTick } from 'vue'
import { sendFileToDevice, rom_readID, rom_eraseChip, rom_read, rom_verify, ram_write, ram_read, ram_verify } from '../utils/protocol.js'

const props = defineProps({
  fileData: Uint8Array,
  device: Object,
  deviceReady: Boolean,
  fileReady: Boolean
})

const mode = ref('GBA')
const busy = ref(false)
const result = ref('')
const idStr = ref('')
const ramFileData = ref(null)
const writeProgress = ref(null)
const writeDetail = ref('')
const ramWriteProgress = ref(null)
const ramWriteDetail = ref('')
const logs = ref([])
const logBox = ref(null)

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

function onRamFileChange(e) {
  const file = e.target.files[0]
  if (!file) return
  const reader = new FileReader()
  reader.onload = () => {
    ramFileData.value = new Uint8Array(reader.result)
    log(`已选择RAM文件，大小${ramFileData.value.length}字节`)
  }
  reader.readAsArrayBuffer(file)
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
  log(`[${mode.value}] 开始写入ROM，大小${props.fileData.length}字节`)
  try {
    const total = props.fileData.length
    let written = 0
    const pageSize = 256
    for (let addr = 0; addr < total; addr += pageSize) {
      const chunk = props.fileData.slice(addr, addr + pageSize)
      let payload = new Uint8Array(1 + 4 + chunk.length)
      payload[0] = 0xf5
      let addrBytes = new Uint8Array(new Uint32Array([addr / 2]).buffer)
      payload.set(addrBytes, 1)
      payload.set(chunk, 5)
      await sendFileToDevice(props.device, chunk)
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
    const data = await rom_read(props.device, props.fileData ? props.fileData.length : 0x200000)
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
    const ok = await rom_verify(props.device, props.fileData)
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
    for (let addr = 0; addr < total; addr += pageSize) {
      const chunk = ramFileData.value.slice(addr, addr + pageSize)
      let payload = new Uint8Array(1 + 4 + chunk.length)
      payload[0] = 0xf7
      let addrBytes = new Uint8Array(new Uint32Array([addr]).buffer)
      payload.set(addrBytes, 1)
      payload.set(chunk, 5)
      await ram_write(props.device, chunk)
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
  max-width: 650px;
  margin: 32px auto;
  padding: 24px 32px;
  background: #fafbfc;
  border-radius: 14px;
  box-shadow: 0 2px 16px #0002;
  font-family: 'Segoe UI', 'PingFang SC', Arial, sans-serif;
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
.ram-upload {
  margin-bottom: 10px;
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
.log-section {
  margin-top: 28px;
}
.log-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
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
.log-area-scroll {
  background: #f4f4f4;
  border-radius: 6px;
  border: 1px solid #ccc;
  padding: 8px 8px 8px 12px;
  height: 140px;
  overflow-y: auto;
  font-family: monospace;
  font-size: 0.97rem;
  line-height: 1.6;
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
</style>
