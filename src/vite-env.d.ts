/// <reference types="vite/client" />

interface FileNode {
  name: string
  path: string
  fullPath: string
  type: "file" | "directory"
  children?: FileNode[]
  isImage?: boolean
  extension?: string
}

interface CondorInstruction {
  id: string
  ubicacion: string
  nombre: string
  extension: string
  accion: string
  content: string
  status: "pending" | "running" | "success" | "error" | "skipped"
  enabled: boolean
  message?: string
}

interface ButtonConfig { label: string; color: string }

interface AppConfig {
  buttons: Record<string, ButtonConfig>
  checkboxes: { autoRun: boolean; dryRun: boolean; backup: boolean; cmdSep: boolean }
}

interface IgnoreConfig {
  ignored_folders: string[]
  ignored_files: string[]
  ignored_extensions: string[]
  image_extensions: string[]
  exceptions: { folders: string[]; files: string[]; extensions: string[] }
  max_depth: number
  show_hidden_files: boolean
  log_format: string
}

interface ElectronAPI {
  getLastDrop: () => string | null
    minimize: () => Promise<void>
  minimizeToTray: () => Promise<void>
  maximize: () => Promise<void>
  close: () => Promise<void>
  isMaximized: () => Promise<boolean>
    openFolder: () => Promise<string | null>
  openFile: (filters?: any) => Promise<{ path: string; content: string } | null>
  setProjectPath: (p: string) => Promise<boolean>
  getProjectPath: () => Promise<string | null>
  getFileTree: () => Promise<FileNode[]>
  copyTreeString: () => Promise<string>
  watchStart: () => Promise<boolean>
  watchStop: () => Promise<boolean>
  createFile: (dir: string, name: string) => Promise<{ success: boolean; message?: string }>
  createFolder: (dir: string, name: string) => Promise<{ success: boolean; message?: string }>
  onFileChanged: (cb: () => void) => () => void
  readClipboard: () => Promise<string>
  parseInstructions: (text: string) => Promise<CondorInstruction[]>
  executeInstruction: (inst: CondorInstruction, opts: { dryRun: boolean; backup: boolean }) => Promise<{ success: boolean; message: string }>
  stopExecution: () => Promise<{ success: boolean }>
  undo: () => Promise<{ success: boolean; message: string }>
  loadConfig: () => Promise<AppConfig>
  saveConfig: (c: AppConfig) => Promise<boolean>
  loadIgnoreConfig: () => Promise<IgnoreConfig>
  saveIgnoreConfig: (c: IgnoreConfig) => Promise<boolean>
  spawnTerminal: () => Promise<boolean>
  writeTerminal: (data: string) => Promise<boolean>
      killTerminal: () => Promise<boolean>
  killTree: () => Promise<boolean>
  sendCtrlC: () => Promise<boolean>
  onTerminalClosed: (cb: () => void) => () => void
  onTerminalData: (cb: (data: string) => void) => () => void
  checkNode: () => Promise<string | null>
  checkPython: () => Promise<string | null>
  openExternal: (url: string) => Promise<void>
        readFile: (p: string) => Promise<string | null>
  deleteFile: (p: string) => Promise<{ success: boolean; message?: string }>
      moveFile: (src: string, destDir: string) => Promise<{ success: boolean; message?: string }>
  copyFile: (src: string) => Promise<{ success: boolean }>
  pasteFile: (destDir: string) => Promise<{ success: boolean; message?: string }>
      getScripts: () => Promise<Record<string, string>>
  saveScripts: (s: Record<string, string>) => Promise<{ success: boolean; message?: string }>
  loadPrompt: () => Promise<string>
  savePrompt: (t: string) => Promise<boolean>
  loadMiniPrompt: () => Promise<string>
  saveMiniPrompt: (t: string) => Promise<boolean>
  runExternal: (cmd: string) => Promise<{ success: boolean }>
  moveFile: (src: string, destDir: string) => Promise<{ success: boolean; message?: string }>
}

declare global {
  interface Window { electronAPI: ElectronAPI }
}

export {}
