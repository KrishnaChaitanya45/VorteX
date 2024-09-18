export interface ElectronAPI {
  setIgnoreMouseEvents: (ignore: boolean) => void
  ipcRenderer: {
    send: (channel: string, ...args: any[]) => void
    on: (channel: string, func: (...args: any[]) => void) => void
  }
}

declare global {
  interface Window {
    electron: ElectronAPI
  }
}
