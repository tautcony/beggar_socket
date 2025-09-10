const { ipcMain } = require('electron');

// 串口支持
let SerialPort;
try {
  const { SerialPort: SP } = require('serialport');
  SerialPort = SP;
} catch (error) {
  console.warn('SerialPort not available:', error.message);
  SerialPort = null;
}

// 存储活跃的串口连接
let activeSerialPorts = new Map();

/**
 * 初始化 IPC 处理器
 * @param {BrowserWindow} mainWindow - 主窗口实例
 */
function setupIpcHandlers(mainWindow) {
  // 基础系统信息
  ipcMain.handle('get-platform', () => {
    return process.platform;
  });

  ipcMain.handle('get-app-version', () => {
    const { app } = require('electron');
    return app.getVersion();
  });

  // 串口相关的权限请求（Web Serial API 兼容）
  ipcMain.handle('request-serial-port', async () => {
    // 在 Electron 中，我们有直接的串口访问权限
    return { granted: true };
  });

  // 列出可用的串口
  ipcMain.handle('serial-list-ports', async () => {
    if (!SerialPort) {
      throw new Error('SerialPort not available');
    }
    
    try {
      const ports = await SerialPort.list();
      return ports.map(port => ({
        path: port.path,
        manufacturer: port.manufacturer,
        serialNumber: port.serialNumber,
        pnpId: port.pnpId,
        locationId: port.locationId,
        productId: port.productId,
        vendorId: port.vendorId
      }));
    } catch (error) {
      console.error('Failed to list serial ports:', error);
      throw error;
    }
  });

  // 选择串口对话框
  ipcMain.handle('select-serial-port', async () => {
    if (!SerialPort) {
      throw new Error('SerialPort not available');
    }

    try {
      // 获取可用串口列表
      const ports = await SerialPort.list();
      
      if (ports.length === 0) {
        throw new Error('No serial ports available');
      }

      // 如果只有一个串口，直接返回
      if (ports.length === 1) {
        return {
          path: ports[0].path,
          manufacturer: ports[0].manufacturer,
          serialNumber: ports[0].serialNumber,
          pnpId: ports[0].pnpId,
          locationId: ports[0].locationId,
          productId: ports[0].productId,
          vendorId: ports[0].vendorId,
        };
      }
      
      // 返回所有串口信息，让前端处理选择界面
      return {
        needsSelection: true,
        ports: ports.map(port => ({
          path: port.path,
          manufacturer: port.manufacturer,
          serialNumber: port.serialNumber,
          pnpId: port.pnpId,
          locationId: port.locationId,
          productId: port.productId,
          vendorId: port.vendorId,
        }))
      };
    } catch (error) {
      console.error('Failed to select serial port:', error);
      throw error;
    }
  });

  // 打开串口
  ipcMain.handle('serial-open', async (event, portPath, options = {}) => {
    if (!SerialPort) {
      throw new Error('SerialPort not available');
    }

    try {
      const defaultOptions = {
        baudRate: 115200,
        dataBits: 8,
        stopBits: 1,
        parity: 'none',
        ...options
      };

      const port = new SerialPort({
        path: portPath,
        ...defaultOptions,
        autoOpen: false
      });

      // 返回 Promise 来处理异步打开
      return new Promise((resolve, reject) => {
        port.open((error) => {
          if (error) {
            reject(error);
          } else {
            const portId = `${portPath}_${Date.now()}`;
            activeSerialPorts.set(portId, port);

            // 设置数据接收处理
            port.on('data', (data) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('serial-data', portId, Array.from(data));
              }
            });

            port.on('error', (error) => {
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('serial-error', portId, error.message);
              }
            });

            port.on('close', () => {
              activeSerialPorts.delete(portId);
              if (mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('serial-closed', portId);
              }
            });

            resolve(portId);
          }
        });
      });
    } catch (error) {
      console.error('Failed to open serial port:', error);
      throw error;
    }
  });

  // 写入数据到串口
  ipcMain.handle('serial-write', async (event, portId, data) => {
    const port = activeSerialPorts.get(portId);
    if (!port) {
      throw new Error(`Serial port ${portId} not found`);
    }

    try {
      const buffer = Buffer.from(data);
      return new Promise((resolve, reject) => {
        port.write(buffer, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Failed to write to serial port:', error);
      throw error;
    }
  });

  // 关闭串口
  ipcMain.handle('serial-close', async (event, portId) => {
    const port = activeSerialPorts.get(portId);
    if (!port) {
      return false;
    }

    try {
      return new Promise((resolve) => {
        port.close(() => {
          activeSerialPorts.delete(portId);
          resolve(true);
        });
      });
    } catch (error) {
      console.error('Failed to close serial port:', error);
      throw error;
    }
  });

  // 获取串口状态
  ipcMain.handle('serial-is-open', async (event, portId) => {
    const port = activeSerialPorts.get(portId);
    return port ? port.isOpen : false;
  });

  // 设置串口信号
  ipcMain.handle('serial-set-signals', async (event, portId, signals) => {
    const port = activeSerialPorts.get(portId);
    if (!port) {
      throw new Error(`Serial port ${portId} not found`);
    }

    try {
      // 设置 DTR (Data Terminal Ready) 和 RTS (Request To Send) 信号
      const options = {};
      if (signals.dataTerminalReady !== undefined) {
        options.dtr = signals.dataTerminalReady;
      }
      if (signals.requestToSend !== undefined) {
        options.rts = signals.requestToSend;
      }

      return new Promise((resolve, reject) => {
        port.set(options, (error) => {
          if (error) {
            reject(error);
          } else {
            resolve(true);
          }
        });
      });
    } catch (error) {
      console.error('Failed to set serial port signals:', error);
      throw error;
    }
  });
}

/**
 * 清理所有活跃的串口连接
 */
function cleanupSerialPorts() {
  for (const [portId, port] of activeSerialPorts) {
    try {
      if (port.isOpen) {
        port.close();
      }
    } catch (error) {
      console.error(`Failed to close port ${portId}:`, error);
    }
  }
  activeSerialPorts.clear();
}

module.exports = {
  setupIpcHandlers,
  cleanupSerialPorts
};
