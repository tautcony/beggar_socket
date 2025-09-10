<template>
  <div class="serial-test">
    <h3>串口测试</h3>

    <!-- 串口列表 (仅 Electron) -->
    <div
      v-if="isElectronEnv"
      class="port-list"
    >
      <h4>可用串口:</h4>
      <button @click="refreshPorts">
        刷新串口列表
      </button>
      <ul>
        <li
          v-for="port in availablePorts"
          :key="port.path"
          @click="selectPort(port)"
        >
          {{ port.path }}
          <span v-if="port.manufacturer">({{ port.manufacturer }})</span>
        </li>
      </ul>
    </div>

    <!-- 连接控制 -->
    <div class="connection-control">
      <div class="port-config">
        <label>波特率:</label>
        <select v-model="serialOptions.baudRate">
          <option value="9600">
            9600
          </option>
          <option value="115200">
            115200
          </option>
          <option value="230400">
            230400
          </option>
          <option value="460800">
            460800
          </option>
        </select>

        <label>数据位:</label>
        <select v-model="serialOptions.dataBits">
          <option value="8">
            8
          </option>
          <option value="7">
            7
          </option>
          <option value="6">
            6
          </option>
          <option value="5">
            5
          </option>
        </select>

        <label>停止位:</label>
        <select v-model="serialOptions.stopBits">
          <option value="1">
            1
          </option>
          <option value="2">
            2
          </option>
        </select>

        <label>校验位:</label>
        <select v-model="serialOptions.parity">
          <option value="none">
            无
          </option>
          <option value="even">
            偶校验
          </option>
          <option value="odd">
            奇校验
          </option>
        </select>
      </div>

      <div class="actions">
        <button
          v-if="!isConnected"
          :disabled="connecting"
          :title="connectionTooltip"
          @click="connectSerial"
        >
          {{ connecting ? '连接中...' : '连接串口' }}
        </button>
        <button
          v-else
          @click="disconnectSerial"
        >
          断开连接
        </button>
        <span
          class="status"
          :class="{ connected: isConnected }"
        >
          {{ isConnected ? '已连接' : '未连接' }}
        </span>
      </div>
    </div>

    <!-- 数据发送 -->
    <div
      v-if="isConnected"
      class="data-control"
    >
      <h4>发送数据:</h4>
      <div class="send-area">
        <input
          v-model="sendData"
          placeholder="输入要发送的数据 (HEX)"
        >
        <button @click="sendHexData">
          发送 HEX
        </button>
        <input
          v-model="sendText"
          placeholder="输入要发送的文本"
        >
        <button @click="sendTextData">
          发送文本
        </button>
      </div>
    </div>

    <!-- 接收数据 -->
    <div class="receive-area">
      <h4>接收数据:</h4>
      <div class="data-display">
        <div
          ref="dataDisplay"
          class="received-data"
        >
          <div
            v-for="(item, index) in receivedData"
            :key="index"
            class="data-item"
          >
            <span class="timestamp">{{ item.timestamp }}</span>
            <span class="data">{{ item.data }}</span>
          </div>
        </div>
        <button @click="clearData">
          清空数据
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue';

import { type SerialConnection, type SerialPortInfo, serialService } from '@/services/serial-service';
import { isElectron } from '@/utils/electron';

// 响应式数据
const isElectronEnv = ref(isElectron());
const availablePorts = ref<SerialPortInfo[]>([]);
const selectedPort = ref<SerialPortInfo | null>(null);
const isConnected = ref(false);
const connecting = ref(false);
const currentConnection = ref<SerialConnection | null>(null);

// 串口配置
const serialOptions = ref({
  baudRate: 115200,
  dataBits: 8 as 5 | 6 | 7 | 8,
  stopBits: 1 as 1 | 2,
  parity: 'none' as 'none' | 'even' | 'odd' | undefined,
});

// 数据收发
const sendData = ref('');
const sendText = ref('');
const receivedData = ref<{ timestamp: string; data: string }[]>([]);

// 计算属性
const connectionTooltip = computed(() => {
  if (isElectronEnv.value) {
    return 'SerialPort';
  } else {
    return 'Web Serial API';
  }
});

// 方法
const refreshPorts = async () => {
  if (!isElectronEnv.value) return;

  try {
    availablePorts.value = await serialService.listPorts();
  } catch (error) {
    console.error('Failed to refresh ports:', error);
  }
};

const selectPort = (port: SerialPortInfo) => {
  selectedPort.value = port;
};

const addReceivedData = (data: string) => {
  const timestamp = new Date().toLocaleTimeString();
  receivedData.value.push({ timestamp, data });

  // 限制数据条数
  if (receivedData.value.length > 1000) {
    receivedData.value.splice(0, 100);
  }

  // 自动滚动到底部
  setTimeout(() => {
    const display = document.querySelector('.received-data');
    if (display) {
      display.scrollTop = display.scrollHeight;
    }
  }, 10);
};

const connectSerial = async () => {
  if (connecting.value) return;

  connecting.value = true;

  try {
    let connection: SerialConnection;

    if (isElectronEnv.value) {
      if (!selectedPort.value) {
        alert('请先选择串口');
        return;
      }
      // 创建一个纯对象以确保可序列化
      const options = {
        baudRate: serialOptions.value.baudRate,
        dataBits: serialOptions.value.dataBits,
        stopBits: serialOptions.value.stopBits,
        parity: serialOptions.value.parity,
      };
      connection = await serialService.openPort(selectedPort.value.path, options);
    } else {
      // Web 环境
      const options = {
        baudRate: serialOptions.value.baudRate,
        dataBits: serialOptions.value.dataBits,
        stopBits: serialOptions.value.stopBits,
        parity: serialOptions.value.parity,
      };
      connection = await serialService.openPort('', options);
    }

    currentConnection.value = connection;
    isConnected.value = true;

    // 设置数据监听
    serialService.onData(connection.id, (data: Uint8Array) => {
      const hexString = Array.from(data)
        .map(byte => byte.toString(16).padStart(2, '0'))
        .join(' ');

      addReceivedData(`HEX: ${hexString}`);

      // 尝试解析为文本
      try {
        const text = new TextDecoder().decode(data);
        if (text.trim()) {
          addReceivedData(`TXT: ${text}`);
        }
      } catch (e) {
        // 忽略解码错误
      }
    });

    serialService.onError(connection.id, (error: string) => {
      console.error('Serial error:', error);
      addReceivedData(`ERROR: ${error}`);
    });

    serialService.onClose(connection.id, () => {
      isConnected.value = false;
      currentConnection.value = null;
      addReceivedData('CONNECTION: 串口已关闭');
    });

    addReceivedData('CONNECTION: 串口连接成功');

  } catch (error) {
    console.error('Failed to connect:', error);
    alert('连接串口失败: ' + (error as Error).message);
  } finally {
    connecting.value = false;
  }
};

const disconnectSerial = async () => {
  if (!currentConnection.value) return;

  try {
    // 保存连接 ID，因为 close() 后连接对象可能被修改
    const connectionId = currentConnection.value.id;

    await currentConnection.value.close();
    serialService.removeListeners(connectionId);
    currentConnection.value = null;
    isConnected.value = false;
    addReceivedData('CONNECTION: 串口已断开');
  } catch (error) {
    console.error('Failed to disconnect:', error);
    alert('断开串口失败: ' + (error as Error).message);
  }
};

const sendHexData = async () => {
  if (!currentConnection.value || !sendData.value) return;

  try {
    // 解析 HEX 字符串
    const hexString = sendData.value.replace(/\s+/g, '');
    const bytes = [];

    for (let i = 0; i < hexString.length; i += 2) {
      const hex = hexString.slice(i, i + 2);
      const byte = parseInt(hex, 16);
      if (isNaN(byte)) {
        throw new Error(`Invalid hex: ${hex}`);
      }
      bytes.push(byte);
    }

    await currentConnection.value.write(new Uint8Array(bytes));
    addReceivedData(`SENT HEX: ${sendData.value}`);
    sendData.value = '';

  } catch (error) {
    console.error('Failed to send hex data:', error);
    alert('发送 HEX 数据失败: ' + (error as Error).message);
  }
};

const sendTextData = async () => {
  if (!currentConnection.value || !sendText.value) return;

  try {
    const encoder = new TextEncoder();
    const data = encoder.encode(sendText.value);

    await currentConnection.value.write(data);
    addReceivedData(`SENT TXT: ${sendText.value}`);
    sendText.value = '';

  } catch (error) {
    console.error('Failed to send text data:', error);
    alert('发送文本数据失败: ' + (error as Error).message);
  }
};

const clearData = () => {
  receivedData.value = [];
};

// 生命周期
onMounted(async () => {
  if (isElectronEnv.value) {
    await refreshPorts();
  }
});

onUnmounted(async () => {
  if (currentConnection.value) {
    await currentConnection.value.close();
  }
});
</script>

<style scoped>
.serial-test {
  padding: 20px;
  max-width: 800px;
}

.port-list ul {
  list-style: none;
  padding: 0;
}

.port-list li {
  padding: 8px;
  border: 1px solid #ddd;
  margin: 4px 0;
  cursor: pointer;
  border-radius: 4px;
}

.port-list li:hover {
  background-color: #f0f0f0;
}

.port-config {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
  flex-wrap: wrap;
}

.port-config label {
  font-weight: bold;
  margin-right: 5px;
}

.actions {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
}

.status {
  padding: 4px 8px;
  border-radius: 4px;
  background-color: #f44336;
  color: white;
}

.status.connected {
  background-color: #4caf50;
}

.send-area {
  display: flex;
  gap: 10px;
  align-items: center;
  margin: 10px 0;
  flex-wrap: wrap;
}

.send-area input {
  flex: 1;
  min-width: 200px;
  padding: 4px 8px;
  border: 1px solid #ddd;
  border-radius: 4px;
}

.data-display {
  border: 1px solid #ddd;
  border-radius: 4px;
  height: 300px;
  display: flex;
  flex-direction: column;
}

.received-data {
  flex: 1;
  overflow-y: auto;
  padding: 10px;
  font-family: monospace;
  font-size: 12px;
}

.data-item {
  margin: 2px 0;
}

.timestamp {
  color: #666;
  margin-right: 10px;
}

.data {
  font-weight: bold;
}

button {
  padding: 6px 12px;
  border: none;
  border-radius: 4px;
  background-color: #2196f3;
  color: white;
  cursor: pointer;
}

button:hover {
  background-color: #1976d2;
}

button:disabled {
  background-color: #ccc;
  cursor: not-allowed;
}

h3, h4 {
  margin: 10px 0;
}
</style>
