import { contextBridge, ipcRenderer } from 'electron'

const electronAPI = {
  setIgnoreMouseEvents: (ignore: boolean) => ipcRenderer.send('set-ignore-mouse-events', ignore),
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => ipcRenderer.send(channel, ...args),
    on: (channel: string, func: (...args: any[]) => void) => {
      const subscription = (_event: Electron.IpcRendererEvent, ...args: any[]) => func(...args)
      ipcRenderer.on(channel, subscription)
      return () => {
        ipcRenderer.removeListener(channel, subscription)
      }
    }
  }
}

contextBridge.exposeInMainWorld('electron', electronAPI)
