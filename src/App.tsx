import { useEffect, useState } from "react"
import { useStore, DEFAULT_CONFIG } from "./store"
import TitleBar from "./components/TitleBar"
import ActivityBar from "./components/ActivityBar"
import Explorer from "./components/Explorer"
import Main from "./components/Main"
import StatusBar from "./components/StatusBar"
import ConfigModal from "./components/ConfigModal"
import IgnoreModal from "./components/IgnoreModal"
import FileEditor from "./components/FileEditor"

export default function App() {
  const s = useStore()

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.loadConfig().then((raw: any) => {
      const cfg = {
        buttonOrder: raw?.buttonOrder || DEFAULT_CONFIG.buttonOrder,
        buttons: { ...DEFAULT_CONFIG.buttons, ...(raw?.buttons || {}) },
        checkboxes: { ...DEFAULT_CONFIG.checkboxes, ...(raw?.checkboxes || {}) },
      }
            // Remove old invalid keys
      const valid = new Set(DEFAULT_CONFIG.buttonOrder)
      for (const k of Object.keys(cfg.buttons)) {
        if (!valid.has(k)) delete cfg.buttons[k]
        else if (cfg.buttons[k].visible === undefined) cfg.buttons[k].visible = true
      }
      // Add missing buttons that exist in defaults but not in saved config
      for (const k of DEFAULT_CONFIG.buttonOrder) {
        if (!cfg.buttons[k]) {
          cfg.buttons[k] = { ...DEFAULT_CONFIG.buttons[k] }
        }
        if (cfg.buttonOrder.indexOf(k) === -1) {
          cfg.buttonOrder.push(k)
        }
      }
      cfg.buttonOrder = cfg.buttonOrder.filter((k: string) => valid.has(k))
      s.applyConfig(cfg)
    })
  }, [])

    useEffect(() => {
    const handler = async (e: MessageEvent) => {
      if (e.data?.type === "condor-project-opened" && e.data?.path) {
        useStore.setState({ projectPath: e.data.path, sidebarOpen: true })
        await window.electronAPI?.setProjectPath(e.data.path)
        const tree = await window.electronAPI?.getFileTree()
        if (tree) useStore.setState({ fileTree: tree })
        await window.electronAPI?.watchStart()
      }
      if (e.data?.type === "condor-instruction-file" && e.data?.content) {
        useStore.setState({ rawPaste: e.data.content })
        const p = await window.electronAPI?.parseInstructions(e.data.content)
        if (p) {
          useStore.setState({ instructions: p })
          const fileName = e.data.path?.split(/[\\/]/).pop() || "file"
          useStore.getState().addTermLine(`📄 Dropped: ${fileName} (${p.length} instructions)\r\n`)
        }
      }
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
    }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === "Enter") {
        e.preventDefault()
        // Trigger Run button
        const toolbar = document.querySelector("[data-run-btn]") as HTMLButtonElement
        if (toolbar && !toolbar.disabled) toolbar.click()
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [])

  return (
    <div className="flex flex-col h-full w-full bg-bg-900 text-txt">
      <TitleBar />
      <div className="flex flex-1 min-h-0 p-1.5 pt-0 gap-1.5">
        <ActivityBar />
        {s.sidebarOpen && <Explorer />}
        <Main />
      </div>
      <StatusBar />
            {s.showConfig && <ConfigModal />}
      {s.showIgnore && <IgnoreModal />}
      <FileEditor />
    </div>
  )
}
