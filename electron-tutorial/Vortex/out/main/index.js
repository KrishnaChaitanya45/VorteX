"use strict";
const electron = require("electron");
const path = require("path");
const utils = require("@electron-toolkit/utils");
const fs = require("fs");
const icon = path.join(__dirname, "../../resources/icon.png");
let drawWindow = null;
let mainWindow = null;
function createDrawWindow() {
  if (drawWindow) {
    drawWindow.show();
    return;
  }
  const { width, height } = electron.screen.getPrimaryDisplay().workAreaSize;
  drawWindow = new electron.BrowserWindow({
    width,
    height,
    show: false,
    frame: false,
    transparent: true,
    movable: false,
    resizable: false,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false
    }
  });
  drawWindow.on("ready-to-show", () => {
    drawWindow?.show();
  });
  drawWindow.on("closed", () => {
    drawWindow = null;
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    drawWindow.loadURL(`${process.env["ELECTRON_RENDERER_URL"]}/draw.html`);
  } else {
    drawWindow.loadFile(path.join(__dirname, "../renderer/draw.html"));
  }
}
electron.ipcMain.on("start-drawing", () => {
  if (drawWindow) {
    drawWindow.setIgnoreMouseEvents(false, { forward: true });
    drawWindow.setAlwaysOnTop(true);
  }
});
electron.ipcMain.on("stop-drawing", () => {
  if (drawWindow) {
    drawWindow.setIgnoreMouseEvents(true, { forward: true });
    drawWindow.setAlwaysOnTop(true);
  }
});
electron.ipcMain.on("toggle-draw-window", () => {
  if (drawWindow) {
    drawWindow.close();
  } else {
    const window = electron.BrowserWindow.getFocusedWindow();
    window?.close();
    createDrawWindow();
  }
});
function createWindow() {
  const width = electron.screen.getPrimaryDisplay().workAreaSize.width;
  const height = electron.screen.getPrimaryDisplay().workAreaSize.height;
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.show();
    return;
  }
  mainWindow = new electron.BrowserWindow({
    width: 200,
    // Initial width of the window
    height: 300,
    // Initial height of the window
    show: false,
    // Hide until ready to show
    minWidth: 90,
    maxHeight: 300,
    maxWidth: 300,
    x: width - width * 5 / 100,
    // Position window near the bottom right
    y: height - height * 5 / 100,
    minHeight: 90,
    transparent: true,
    resizable: false,
    roundedCorners: true,
    alwaysOnTop: true,
    frame: false,
    autoHideMenuBar: true,
    ...process.platform === "linux" ? { icon } : {},
    webPreferences: {
      preload: path.join(__dirname, "../preload/index.js"),
      sandbox: false,
      nodeIntegration: false,
      contextIsolation: true
    }
  });
  mainWindow.on("ready-to-show", () => {
    mainWindow?.show();
  });
  mainWindow.setAlwaysOnTop(true);
  mainWindow.webContents.setWindowOpenHandler((details) => {
    electron.shell.openExternal(details.url);
    return { action: "deny" };
  });
  if (utils.is.dev && process.env["ELECTRON_RENDERER_URL"]) {
    mainWindow.loadURL(process.env["ELECTRON_RENDERER_URL"]);
  } else {
    mainWindow.loadFile(path.join(__dirname, "../renderer/index.html"));
  }
  let isIgnoringMouseEvents = true;
  mainWindow.setIgnoreMouseEvents(isIgnoringMouseEvents, { forward: true });
  electron.ipcMain.on("set-ignore-mouse-events", (_, ignore) => {
    if (isIgnoringMouseEvents !== ignore) {
      isIgnoringMouseEvents = ignore;
      mainWindow?.setIgnoreMouseEvents(ignore, { forward: true });
    }
  });
}
electron.app.whenReady().then(() => {
  const primaryDisplay = electron.screen.getPrimaryDisplay();
  const { width, height } = primaryDisplay.workAreaSize;
  const window = electron.BrowserWindow.getFocusedWindow();
  if (window) {
    window.setBounds({
      x: width - 200,
      y: height - 300
    });
  }
  utils.electronApp.setAppUserModelId("com.electron");
  electron.app.on("browser-window-created", (_, window2) => {
    utils.optimizer.watchWindowShortcuts(window2);
  });
  electron.ipcMain.on("open-file-location", (event, path2) => {
    let cleanPath = path2.replace(/^local-file:\/\/\//, "");
    cleanPath = cleanPath.replace(/^vortex:\/\//, "");
    const decodedPath = decodeURIComponent(cleanPath);
    electron.shell.showItemInFolder(decodedPath);
  });
  electron.ipcMain.on("quit-drawing", () => {
    if (drawWindow && !drawWindow.isDestroyed()) {
      drawWindow.close();
      drawWindow = null;
    }
    if (!mainWindow || mainWindow.isDestroyed()) {
      createWindow();
    } else {
      mainWindow.show();
    }
  });
  electron.ipcMain.on("close-window", () => {
    const window2 = electron.BrowserWindow.getFocusedWindow();
    window2?.close();
  });
  electron.ipcMain.on("take-screenshot", async (event) => {
    try {
      console.log("take-screenshot event received in main process");
      const sources = await electron.desktopCapturer.getSources({
        types: ["screen"],
        thumbnailSize: { width, height }
      });
      console.log("Sources:", sources);
      const picturesPath = electron.app.getPath("pictures");
      const vortexDataDir = path.join(picturesPath, "Vortex_Data");
      fs.mkdirSync(vortexDataDir, { recursive: true });
      console.log("Vortex_Data directory:", vortexDataDir);
      const fileName = `VorteX-${Date.now()}.png`;
      const screenshotPath = path.join(vortexDataDir, fileName);
      console.log("Screenshot path:", screenshotPath);
      for (const source of sources) {
        if (source.name === "Entire Screen" || source.name === "Entire screen" || source.name === "Screen 1") {
          const thumbnail = source.thumbnail.toPNG();
          fs.writeFileSync(screenshotPath, thumbnail);
          console.log("Screenshot saved successfully to:", screenshotPath);
          console.log("Sending screenshot-captured event with path:", screenshotPath);
          event.sender.send("screenshot-captured", screenshotPath);
          console.log("screenshot-captured event sent");
          return;
        }
      }
      throw new Error("No suitable screen source found");
    } catch (error) {
      console.error("Error capturing screenshot:", error);
      console.log("Sending screenshot-error event with message:", error.message);
      event.sender.send("screenshot-error", error.message);
    }
  });
  electron.ipcMain.on("get-sources", async (event) => {
    console.log("get-sources event received in main process");
    const sources = await electron.desktopCapturer.getSources({ types: ["window", "screen"] });
    event.sender.send("sources-captured", sources);
  });
  electron.ipcMain.handle("showSaveDialog", async () => {
    return await electron.dialog.showSaveDialog({
      buttonLabel: "Save video",
      defaultPath: `vid-${Date.now()}.webm`
    });
  });
  electron.ipcMain.handle("getOperatingSystem", () => {
    return process.platform;
  });
  electron.ipcMain.on("selected", (event, increase) => {
    const window2 = electron.BrowserWindow.getFocusedWindow();
    const bounds = window2?.getBounds() || {
      x: 0,
      y: 0,
      width: 200,
      height: 300
    };
    window2?.setBounds({
      x: bounds.x - (increase - bounds.width),
      y: bounds?.y,
      width: increase,
      height: 300
    });
  });
  electron.ipcMain.on("unselected", () => {
    const window2 = electron.BrowserWindow.getFocusedWindow();
    const bounds = window2?.getBounds() || { x: 0, y: 0 };
    window2?.setBounds({ x: bounds.x + 200, width: 200, height: 300 });
  });
  createWindow();
  electron.ipcMain.on("save-video", (event, buffer) => {
    const picturesPath = electron.app.getPath("pictures");
    const vortexDataDir = path.join(picturesPath, "Vortex_Data");
    fs.mkdirSync(vortexDataDir, { recursive: true });
    const fileName = `VorteX-Video-${Date.now()}.webm`;
    const videoPath = path.join(vortexDataDir, fileName);
    fs.writeFile(videoPath, buffer, (err) => {
      if (err) {
        console.error("Error saving video:", err);
        event.reply("video-save-error", err.message);
      } else {
        console.log("Video saved successfully:", videoPath);
        event.reply("video-saved", videoPath);
      }
    });
  });
  electron.app.on("activate", function() {
    if (electron.BrowserWindow.getAllWindows().length === 0) createWindow();
  });
  electron.protocol.handle("local-file", (request) => {
    const url = new URL(request.url);
    let filePath = decodeURIComponent(url.pathname);
    filePath = filePath.replace(/^\//, "");
    console.log("Requested file path:", filePath);
    try {
      if (fs.existsSync(filePath)) {
        const data = fs.readFileSync(filePath);
        const extension = path.extname(filePath).toLowerCase();
        const mimeType = {
          ".png": "image/png",
          ".jpg": "image/jpeg",
          ".jpeg": "image/jpeg",
          ".webm": "video/webm",
          ".gif": "image/gif"
        }[extension] || "application/octet-stream";
        return new Response(data, {
          headers: {
            "Content-Type": mimeType,
            "Content-Length": data.length.toString()
          }
        });
      } else {
        console.error("File not found:", filePath);
        return new Response("File not found", { status: 404 });
      }
    } catch (error) {
      console.error("Error reading file:", error);
      return new Response("Error reading file", { status: 500 });
    }
  });
  electron.protocol.handle("vortex", (request) => {
    let filePath = request.url.replace("vortex://", "");
    filePath = filePath.replace(/\\/g, "/").replace(/^([A-Za-z])\//, "$1:/");
    console.log("filePath", filePath);
    return electron.net.fetch(`file:///${filePath}`);
  });
});
electron.app.on("window-all-closed", () => {
  if (process.platform !== "darwin") {
    electron.app.quit();
  }
});
