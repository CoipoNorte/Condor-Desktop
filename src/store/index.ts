import { create } from "zustand"

interface BtnCfg {
  label: string
  color: string
  visible: boolean
}

interface StoredConfig {
  buttonOrder: string[]
  buttons: Record<string, BtnCfg>
  checkboxes: {
    autoRun: boolean
    dryRun: boolean
    backup: boolean
    cmdSep: boolean
  }
}

interface Store {
  projectPath: string | null
  fileTree: FileNode[]
  instructions: CondorInstruction[]
  storedConfig: StoredConfig
  isRunning: boolean
  currentIndex: number
  autoRun: boolean
  dryRun: boolean
  backup: boolean
  cmdSep: boolean
  sidebarView: "explorer" | "markdown" | null
  sidebarOpen: boolean
  sidebarWidth: number
  terminalLines: string[]
  rawPaste: string
  showConfig: boolean
  showIgnore: boolean

  set: (partial: Partial<Store>) => void
  addTermLine: (l: string) => void
  clearTerminal: () => void
  updateInst: (id: string, u: Partial<CondorInstruction>) => void
  toggleInst: (id: string) => void
  setSidebarView: (v: "explorer" | "markdown" | null) => void
  applyConfig: (cfg: StoredConfig) => void
}

const DEFAULT_CONFIG: StoredConfig = {
    buttonOrder: ["scan", "run", "reload", "clean", "undo", "paste", "cmd", "scripts", "copylog", "prompt", "mini"],
  buttons: {
    scan: { label: "", color: "#6366f1", visible: true },
    run: { label: "Run", color: "#10b981", visible: true },
    reload: { label: "Reload", color: "#6366f1", visible: true },
    clean: { label: "Clean", color: "#f59e0b", visible: true },
    undo: { label: "Undo", color: "#f97316", visible: true },
    paste: { label: "Paste", color: "#8b5cf6", visible: true },
    cmd: { label: "CMD", color: "#0ea5e9", visible: true },
    scripts: { label: "Scripts", color: "#f59e0b", visible: true },
    prompt: { label: "Prompt", color: "#d946ef", visible: true },
        mini: { label: "", color: "#14b8a6", visible: true },
    copylog: { label: "", color: "#9494a4", visible: true },
  },
  checkboxes: { autoRun: false, dryRun: false, backup: true, cmdSep: true },
}

export { DEFAULT_CONFIG }
export type { StoredConfig, BtnCfg }

export const useStore = create<Store>((set) => ({
  projectPath: null,
  fileTree: [],
  instructions: [],
  storedConfig: DEFAULT_CONFIG,
  isRunning: false,
  currentIndex: -1,
  autoRun: false,
  dryRun: false,
  backup: true,
  cmdSep: true,
  sidebarView: "explorer",
  sidebarOpen: true,
  sidebarWidth: 260,
  terminalLines: [],
  rawPaste: "",
  showConfig: false,
  showIgnore: false,

  set: (partial) => set(partial),
  addTermLine: (l) => set((s) => ({ terminalLines: [...s.terminalLines, l] })),
  clearTerminal: () => set({ terminalLines: [] }),
  updateInst: (id, u) =>
    set((s) => ({
      instructions: s.instructions.map((i) => (i.id === id ? { ...i, ...u } : i)),
    })),
  toggleInst: (id) =>
    set((s) => ({
      instructions: s.instructions.map((i) =>
        i.id === id ? { ...i, enabled: !i.enabled } : i
      ),
    })),
  setSidebarView: (v) =>
    set((s) => ({
      sidebarView: s.sidebarView === v ? null : v,
      sidebarOpen: s.sidebarView === v ? false : true,
    })),
  applyConfig: (cfg) =>
    set({
      storedConfig: cfg,
      autoRun: cfg.checkboxes.autoRun,
      dryRun: cfg.checkboxes.dryRun,
      backup: cfg.checkboxes.backup,
      cmdSep: cfg.checkboxes.cmdSep,
    }),
}))
