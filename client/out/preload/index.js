"use strict";
const electron = require("electron");
const electronAPI = {
  setIgnoreMouseEvents: (ignore) => electron.ipcRenderer.send("set-ignore-mouse-events", ignore),
  ipcRenderer: {
    send: (channel, ...args) => electron.ipcRenderer.send(channel, ...args),
    on: (channel, func) => {
      const subscription = (_event, ...args) => func(...args);
      electron.ipcRenderer.on(channel, subscription);
      return () => {
        electron.ipcRenderer.removeListener(channel, subscription);
      };
    }
  }
};
electron.contextBridge.exposeInMainWorld("electron", electronAPI);
