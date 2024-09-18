import {
  app,
  shell,
  BrowserWindow,
  ipcMain,
  screen,
  desktopCapturer,
  dialog,
  protocol,
  net
} from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import fs from 'fs' // Import filesystem module
import path from 'path' // Import path module

let drawWindow: BrowserWindow | null = null
let mainWindow: BrowserWindow | null = null
function createDrawWindow(): void {
  if (drawWindow) {
    drawWindow.show()
    return
  }

  const { width, height } = screen.getPrimaryDisplay().workAreaSize
  drawWindow = new BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    movable: false,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  drawWindow.on('ready-to-show', () => {
    drawWindow?.show()
  })

  drawWindow.on('closed', () => {
    drawWindow = null
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    drawWindow.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/draw.html`)
  } else {
    drawWindow.loadFile(join(__dirname, '../renderer/draw.html'))
  }
}
ipcMain.on('start-drawing', () => {
  if (drawWindow) {
    drawWindow.setIgnoreMouseEvents(false, { forward: true })
    drawWindow.setAlwaysOnTop(true)
  }
})
ipcMain.on('stop-drawing', () => {
  if (drawWindow) {
    drawWindow.setIgnoreMouseEvents(true, { forward: true })
    drawWindow.setAlwaysOnTop(true)
  }
})
// Add this IPC handler in the app.whenReady().then() callback
ipcMain.on('toggle-draw-window', () => {
  if (drawWindow) {
    drawWindow.close()
  } else {
    const window = BrowserWindow.getFocusedWindow()
    window?.close()
    createDrawWindow()
  }
})

function createWindow(): void {
  // Create the browser window.
  const width = screen.getPrimaryDisplay().workAreaSize.width
  const height = screen.getPrimaryDisplay().workAreaSize.height
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show()
    return
  }
  mainWindow = new BrowserWindow({
    width: 200, // Initial width of the window
    height: 300, // Initial height of the window
    show: false, // Hide until ready to show

    minWidth: 90,
    maxHeight: 300,
    maxWidth: 300,
    x: width - (width * 5) / 100, // Position window near the bottom right
    y: height - (height * 5) / 100,
    minHeight: 90,

    transparent: true,
    resizable: false,
    roundedCorners: true,
    alwaysOnTop: true,
    frame: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  })

  // Show the window once it's ready
  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })
  mainWindow.setAlwaysOnTop(true)

  // Handle external links
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Load the remote URL for development or the local HTML file for production
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }

  // Add this line to allow loading local resources

  // Add this line to set the window to be transparent and click-through
  let isIgnoringMouseEvents = true
  mainWindow.setIgnoreMouseEvents(isIgnoringMouseEvents, { forward: true })

  ipcMain.on('set-ignore-mouse-events', (_, ignore) => {
    if (isIgnoringMouseEvents !== ignore) {
      isIgnoringMouseEvents = ignore
      mainWindow?.setIgnoreMouseEvents(ignore, { forward: true })
    }
  })
}

// This method will be called when Electron has finished initialization
app.whenReady().then(() => {
  const primaryDisplay = screen.getPrimaryDisplay()
  const { width, height } = primaryDisplay.workAreaSize

  const window = BrowserWindow.getFocusedWindow()
  if (window) {
    window.setBounds({
      x: width - 200,
      y: height - 300
    })
  }

  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })
  ipcMain.on('open-file-location', (event, path) => {
    // Remove the 'safe-local://' prefix if present
    let cleanPath = path.replace(/^local-file:\/\/\//, '')
    cleanPath = cleanPath.replace(/^vortex:\/\//, '')
    // Decode the URI component to handle any special characters
    const decodedPath = decodeURIComponent(cleanPath)
    // Open the file location using the cleaned and decoded path
    shell.showItemInFolder(decodedPath)
  })
  ipcMain.on('quit-drawing', () => {
    // Check if the drawWindow exists and is not destroyed before closing
    if (drawWindow && !drawWindow.isDestroyed()) {
      drawWindow.close()
      drawWindow = null // Explicitly set it to null after closing
    }

    // Check if mainWindow exists and handle accordingly
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow()
    } else {
      mainWindow.show()
    }
  })

  // IPC event to close window
  ipcMain.on('close-window', () => {
    const window = BrowserWindow.getFocusedWindow()
    window?.close()
  })

  ipcMain.on('take-screenshot', async (event) => {
    try {
      console.log('take-screenshot event received in main process')
      const sources = await desktopCapturer.getSources({
        types: ['screen'],
        thumbnailSize: { width, height }
      })
      console.log('Sources:', sources)

      const picturesPath = app.getPath('pictures')
      const vortexDataDir = path.join(picturesPath, 'Vortex_Data')
      fs.mkdirSync(vortexDataDir, { recursive: true })
      console.log('Vortex_Data directory:', vortexDataDir)

      const fileName = `VorteX-${Date.now()}.png`
      const screenshotPath = path.join(vortexDataDir, fileName)
      console.log('Screenshot path:', screenshotPath)

      for (const source of sources) {
        if (
          source.name === 'Entire Screen' ||
          source.name === 'Entire screen' ||
          source.name === 'Screen 1'
        ) {
          const thumbnail = source.thumbnail.toPNG()
          fs.writeFileSync(screenshotPath, thumbnail)
          console.log('Screenshot saved successfully to:', screenshotPath)
          console.log('Sending screenshot-captured event with path:', screenshotPath)
          event.sender.send('screenshot-captured', screenshotPath)
          console.log('screenshot-captured event sent')
          return
        }
      }

      throw new Error('No suitable screen source found')
    } catch (error: any) {
      console.error('Error capturing screenshot:', error)
      console.log('Sending screenshot-error event with message:', error.message)
      event.sender.send('screenshot-error', error.message)
    }
  })

  // IPC handlers for capturing sources and saving dialogs
  ipcMain.on('get-sources', async (event) => {
    console.log('get-sources event received in main process')
    const sources = await desktopCapturer.getSources({ types: ['window', 'screen'] })
    event.sender.send('sources-captured', sources)
  })

  ipcMain.handle('showSaveDialog', async () => {
    return await dialog.showSaveDialog({
      buttonLabel: 'Save video',
      defaultPath: `vid-${Date.now()}.webm`
    })
  })

  ipcMain.handle('getOperatingSystem', () => {
    return process.platform
  })

  ipcMain.on('selected', (event, increase) => {
    const window = BrowserWindow.getFocusedWindow()
    const bounds = window?.getBounds() || {
      x: 0,
      y: 0,
      width: 200,
      height: 300
    }
    window?.setBounds({
      x: bounds.x - (increase - bounds.width),
      y: bounds?.y,
      width: increase,
      height: 300
    })
  })

  ipcMain.on('unselected', () => {
    const window = BrowserWindow.getFocusedWindow()
    const bounds = window?.getBounds() || { x: 0, y: 0 }
    window?.setBounds({ x: bounds.x + 200, width: 200, height: 300 })
  })

  createWindow()

  ipcMain.on('save-video', (event, buffer) => {
    const picturesPath = app.getPath('pictures')
    const vortexDataDir = join(picturesPath, 'Vortex_Data')
    fs.mkdirSync(vortexDataDir, { recursive: true })

    const fileName = `VorteX-Video-${Date.now()}.webm`
    const videoPath = path.join(vortexDataDir, fileName)

    fs.writeFile(videoPath, buffer, (err) => {
      if (err) {
        console.error('Error saving video:', err)
        event.reply('video-save-error', err.message)
      } else {
        console.log('Video saved successfully:', videoPath)

        event.reply('video-saved', videoPath)
      }
    })
  })

  app.on('activate', function () {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })

  protocol.handle('local-file', (request) => {
    const url = new URL(request.url)
    let filePath = decodeURIComponent(url.pathname)
    // Remove the leading slash but keep the drive letter
    filePath = filePath.replace(/^\//, '')
    console.log('Requested file path:', filePath)
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath)
        const extension = path.extname(filePath).toLowerCase()
        const mimeType =
          {
            '.png': 'image/png',
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.webm': 'video/webm',
            '.gif': 'image/gif'
          }[extension] || 'application/octet-stream'
        return new Response(data, {
          headers: {
            'Content-Type': mimeType,
            'Content-Length': data.length.toString()
          }
        })
      } else {
        console.error('File not found:', filePath)
        return new Response('File not found', { status: 404 })
      }
    } catch (error) {
      console.error('Error reading file:', error)
      return new Response('Error reading file', { status: 500 })
    }
  })
  protocol.handle('vortex', (request) => {
    let filePath = request.url.replace('vortex://', '')
    filePath = filePath.replace(/\\/g, '/').replace(/^([A-Za-z])\//, '$1:/')
    console.log('filePath', filePath)

    return net.fetch(`file:///${filePath}`)
  })
  // Add this function at the top of the file

  // In the app.whenReady().then() callback, add this line:
})

// Quit when all windows are closed, except on macOS
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
