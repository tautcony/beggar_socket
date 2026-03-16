const { app, BrowserWindow, Menu, shell, session } = require('electron');
const path = require('path');
const { setupIpcHandlers, updateMainWindow, cleanupSerialPorts } = require('./ipc-handlers');
const { isAppNavigationUrl, isSafeExternalUrl } = require('./security-utils');

// 串口支持检查（移到 ipc-handlers.js 中）

// 只有在明确设置开发环境或通过 electron:dev 启动时才是开发模式
const isDev = process.env.ELECTRON_DEV === 'true';

if (isDev) {
  console.log('isDev:', isDev);
  console.log('app.isPackaged:', app.isPackaged);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('ELECTRON_DEV:', process.env.ELECTRON_DEV);
}

// 保持窗口对象的全局引用
let mainWindow;

function createWindow() {
  // 创建浏览器窗口
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: 'ChisFlash Burner',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, 'preload.js'),
      webSecurity: isDev ? false : true, // 生产环境启用安全性
    },
    titleBarStyle: 'default', // 使用默认标题栏样式
    show: false, // 先不显示，等页面加载完成后再显示
  });

  // 加载应用
  if (isDev) {
    mainWindow.loadURL('http://localhost:5173');
    // 开发模式下打开开发者工具
    mainWindow.webContents.openDevTools();
  } else {
    // 生产模式下加载本地文件
    const indexPath = path.join(__dirname, '../dist/index.html');
    mainWindow.loadFile(indexPath);
  }

  // 当窗口准备好显示时
  mainWindow.once('ready-to-show', () => {
    mainWindow.show();
    
    // 如果是开发模式，聚焦窗口
    if (isDev) {
      mainWindow.focus();
    }

  // 设置 IPC 处理器（防重复注册已在函数内处理）
    setupIpcHandlers(mainWindow);
  });

  // 添加加载失败的错误处理
  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    console.error('Failed to load:', validatedURL, 'Error:', errorDescription);
  });

  // 添加页面加载完成的日志
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Page loaded successfully');
  });

  // 监听控制台消息
  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`Console [${level}]:`, message);
  });

  // 当 window 被关闭，这个事件会被触发
  mainWindow.on('closed', () => {
    // 清除 IPC handlers 中的窗口引用，避免向已销毁窗口发送消息
    updateMainWindow(null);
    mainWindow = null;
  });

  // 在新窗口中打开外部链接
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isSafeExternalUrl(url)) {
      void shell.openExternal(url);
    } else {
      console.warn('[Security] Blocked unsafe window.open URL:', url);
    }
    return { action: 'deny' };
  });

  // 阻止导航到外部链接
  mainWindow.webContents.on('will-navigate', (event, navigationUrl) => {
    if (!isAppNavigationUrl(navigationUrl, isDev)) {
      event.preventDefault();

      if (isSafeExternalUrl(navigationUrl)) {
        void shell.openExternal(navigationUrl);
      } else {
        console.warn('[Security] Blocked unsafe navigation URL:', navigationUrl);
      }
    }
  });
}

// Electron 会在初始化后并准备
// 创建浏览器窗口时，调用这个函数。
// 部分 API 在 ready 事件触发后才能使用。
app.whenReady().then(() => {
  // 配置 Content-Security-Policy，防止 XSS 攻击
  session.defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [
          "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'self'; img-src 'self' data: blob:; font-src 'self' data:;"
        ],
      },
    });
  });

  createWindow();

  app.on('activate', () => {
    // 在macOS上，当单击dock图标并且没有其他窗口打开时，
    // 通常在应用程序中重新创建一个窗口。
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });

  // 设置应用菜单
  createMenu();
});

// 当全部窗口关闭时退出
app.on('window-all-closed', () => {
  // 清理串口资源
  cleanupSerialPorts();
  
  // 在 macOS 上，除非用户用 Cmd + Q 确定地退出，
  // 否则绝大部分应用及其菜单栏会保持激活。
  if (process.platform !== 'darwin') app.quit();
});

// 应用即将退出时清理资源
app.on('before-quit', () => {
  cleanupSerialPorts();
});

function createMenu() {
  const template = [
    {
      label: 'File',
      submenu: [
        {
          label: 'Exit',
          accelerator: process.platform === 'darwin' ? 'Cmd+Q' : 'Ctrl+Q',
          click: () => {
            app.quit();
          }
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        { role: 'reload' },
        { role: 'forceReload' },
        ...(isDev ? [{ role: 'toggleDevTools' }] : []),
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Window',
      submenu: [
        { role: 'minimize' },
        { role: 'close' }
      ]
    }
  ];

  if (process.platform === 'darwin') {
    template.unshift({
      label: app.getName(),
      submenu: [
        { role: 'about' },
        { type: 'separator' },
        { role: 'hide' },
        { role: 'hideOthers' },
        { role: 'unhide' },
        { type: 'separator' },
        { role: 'quit' }
      ]
    });

    // Window menu
    template[3].submenu = [
      { role: 'close' },
      { role: 'minimize' },
      { role: 'zoom' },
      { type: 'separator' },
      { role: 'front' }
    ];
  }

  const menu = Menu.buildFromTemplate(template);
  Menu.setApplicationMenu(menu);
}
