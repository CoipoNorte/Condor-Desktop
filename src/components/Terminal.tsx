import { useEffect, useRef, useState } from "react"
import { VscTerminal, VscTrash, VscDebugStop, VscCopy, VscAdd, VscClose } from "react-icons/vsc"
import { useStore } from "../store"

interface Tab {
  id: number
  label: string
  lines: string[]
  alive: boolean
}

let nextId = 1

export default function Terminal() {
  const { projectPath, addTermLine, terminalLines } = useStore()
  const [tabs, setTabs] = useState<Tab[]>([])
  const [activeTab, setActiveTab] = useState<number | null>(null)
  const [inp, setInp] = useState("")
  const [copied, setCopied] = useState(false)
  const sr = useRef<HTMLDivElement>(null)
  const ir = useRef<HTMLInputElement>(null)

  const current = tabs.find((t) => t.id === activeTab) || null

    // Auto-create tab when Run outputs data
  useEffect(() => {
    if (terminalLines.length > 0 && tabs.length === 0) {
      const id = nextId++
      setTabs([{ id, label: `Term ${id}`, lines: [...terminalLines], alive: true }])
      setActiveTab(id)
    } else if (terminalLines.length > 0 && activeTab) {
      setTabs((prev) => prev.map((t) =>
        t.id === activeTab ? { ...t, lines: [...terminalLines], alive: true } : t
      ))
    }
  }, [terminalLines])

  useEffect(() => {
    const cleanup = window.electronAPI?.onTerminalData((d: string) => {
      addTermLine(d)
    })
    return cleanup
  }, [])

  useEffect(() => {
    const cleanup = window.electronAPI?.onTerminalClosed(() => {
      setTabs((prev) => prev.map((t) =>
        t.id === activeTab ? { ...t, alive: false } : t
      ))
      addTermLine("[session ended]\r\n")
    })
    return cleanup
  }, [activeTab])

  useEffect(() => {
    if (sr.current) sr.current.scrollTop = sr.current.scrollHeight
  }, [current?.lines.length, terminalLines.length])

  const spawn = async () => {
    if (!projectPath) return
    useStore.getState().clearTerminal()
    await window.electronAPI?.killTerminal()
    await window.electronAPI?.spawnTerminal()
    const id = nextId++
    const newTab: Tab = { id, label: `Term ${id}`, lines: [`❯ ${projectPath}\r\n`], alive: true }
    setTabs((prev) => [...prev, newTab])
    setActiveTab(id)
    addTermLine(`❯ ${projectPath}\r\n`)
    setTimeout(() => ir.current?.focus(), 100)
  }

  const closeTab = (id: number) => {
    setTabs((prev) => {
      const filtered = prev.filter((t) => t.id !== id)
      if (id === activeTab && filtered.length > 0) {
        setActiveTab(filtered[filtered.length - 1].id)
      } else if (filtered.length === 0) {
        setActiveTab(null)
      }
      return filtered
    })
  }

  const send = () => {
    if (!current?.alive) return
    window.electronAPI?.writeTerminal(inp + "\r\n")
    setInp("")
  }

        const sendCtrlC = async () => {
    await window.electronAPI?.sendCtrlC()
    addTermLine("^C\r\n")
  }

    const killCurrent = async () => {
    // Stop running instructions
    useStore.setState({ isRunning: false })
    // Kill terminal process tree
    await window.electronAPI?.killTree()
    // Also kill regular terminal
    await window.electronAPI?.killTerminal()
    setTabs((prev) => prev.map((t) =>
      t.id === activeTab ? { ...t, alive: false } : t
    ))
  }

  const clearCurrent = () => {
    useStore.getState().clearTerminal()
    setTabs((prev) => prev.map((t) =>
      t.id === activeTab ? { ...t, lines: [] } : t
    ))
  }

  const copyOutput = () => {
    const lines = current ? current.lines : terminalLines
    const text = lines.map((l) => l.replace(/\x1b\[[0-9;]*m/g, "").replace(/\r\n/g, "\n").replace(/\r/g, "")).join("")
    navigator.clipboard?.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const cl = (t: string) => t.replace(/\x1b\[[0-9;]*m/g, "")
  const lc = (l: string) => {
    if (l.startsWith("❯")) return "text-indigo"
    if (l.includes("✓")) return "text-ok"
    if (l.includes("error") || l.includes("Error") || l.includes("ERR")) return "text-err"
    if (l.includes("[killed]") || l.includes("[session ended]")) return "text-rose"
    if (l.includes("^C")) return "text-amber"
    return "text-txt-2"
  }

  const displayLines = current ? current.lines : terminalLines

  return (
    <div className="flex flex-col h-full bg-bg-900" style={{ userSelect: "text", WebkitUserSelect: "text" }}>
      {/* Header */}
                  <div style={{ display: "flex", alignItems: "center", height: 22, padding: "0 4px 0 6px", flexShrink: 0, borderBottom: "1px solid #1e1e26" }}>
        <div style={{ display: "flex", gap: 1, flex: 1, overflow: "hidden", alignItems: "center" }}>
                    {tabs.length === 0 && (
            <span style={{ fontSize: 10, color: "#5c5c6e", fontWeight: 600 }}>
              <VscTerminal size={11} style={{ verticalAlign: "middle" }} />
            </span>
          )}
          {tabs.map((tab) => (
            <div key={tab.id} onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex", alignItems: "center", gap: 4, height: 22, padding: "0 4px 0 8px",
                fontSize: 10, fontWeight: 600, borderRadius: 3, cursor: "pointer",
                backgroundColor: tab.id === activeTab ? "#24242c" : "transparent",
                color: tab.id === activeTab ? "#e2e2ea" : "#5c5c6e",
              }}
              onMouseEnter={(e) => { if (tab.id !== activeTab) e.currentTarget.style.backgroundColor = "#1a1a22" }}
              onMouseLeave={(e) => { if (tab.id !== activeTab) e.currentTarget.style.backgroundColor = "transparent" }}
            >
              <span style={{ color: tab.alive ? "#10b981" : "#5c5c6e", fontSize: 7 }}>●</span>
              <span>{tab.label}</span>
              <button onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
                style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 2, marginLeft: 2 }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#f43f5e" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e" }}
              ><VscClose size={10} /></button>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 1 }}>
          <HBtn t={copied ? "Copied!" : "Copy"} fn={copyOutput} c={copied ? "#10b981" : "#5c5c6e"} h={copied ? "#10b981" : "#e2e2ea"}><VscCopy size={11} /></HBtn>
          <HBtn t="Stop Process (Ctrl+C)" fn={sendCtrlC} d={!current?.alive} c="#f59e0b" h="#f59e0b"><span style={{ fontSize: 8, fontWeight: 900 }}>^C</span></HBtn>
          <HBtn t="Kill All" fn={killCurrent} d={!current?.alive} c="#f43f5e" h="#f43f5e"><VscDebugStop size={11} /></HBtn>
          <HBtn t="New Terminal" fn={spawn} c="#5c5c6e" h="#0ea5e9"><VscAdd size={12} /></HBtn>
          <HBtn t="Clear" fn={clearCurrent} c="#5c5c6e" h="#e2e2ea"><VscTrash size={11} /></HBtn>
        </div>
      </div>

      {/* Output */}
            <div ref={sr} onClick={() => { if (!window.getSelection()?.toString()) ir.current?.focus() }}
        style={{ flex: 1, minHeight: 0, overflowY: "auto", padding: "3px 12px", fontFamily: "Consolas, monospace", fontSize: 11, lineHeight: "17px", cursor: "text", userSelect: "text", WebkitUserSelect: "text", outline: "none" }}>
        {displayLines.length === 0 ? (
          <span style={{ color: "#5c5c6e", fontSize: 11 }}>Click + to start a terminal</span>
        ) : displayLines.map((l, i) => (
          <div key={i} className={`whitespace-pre-wrap break-all ${lc(l)}`} style={{ userSelect: "text", WebkitUserSelect: "text" }}>{cl(l)}</div>
        ))}
      </div>

      {/* Input */}
            <div style={{ display: "flex", alignItems: "center", height: 26, padding: "0 12px", flexShrink: 0, borderTop: "1px solid #1e1e26", gap: 6 }}>
        <span style={{ color: current?.alive ? "#6366f1" : "#3a3a46", fontFamily: "Consolas, monospace", fontSize: 12, fontWeight: 700 }}>❯</span>
        <input ref={ir} value={inp} onChange={(e) => setInp(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") { e.preventDefault(); send() }
            if (e.ctrlKey && e.key === "c") { e.preventDefault(); sendCtrlC() }
          }}
          placeholder={current?.alive ? "command..." : tabs.length === 0 ? "No terminal" : "Session ended"}
          disabled={!current?.alive}
          style={{ flex: 1, backgroundColor: "transparent", color: "#e2e2ea", fontSize: 11, fontFamily: "Consolas, monospace", border: "none", outline: "none", opacity: current?.alive ? 1 : 0.3 }}
        />
      </div>
    </div>
  )
}

function HBtn({ children, t, fn, d, c, h }: { children: React.ReactNode; t: string; fn: () => void; d?: boolean; c: string; h: string }) {
  return (
    <button onClick={fn} disabled={d} title={t}
      style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: c, borderRadius: 3, opacity: d ? 0.3 : 1, cursor: d ? "not-allowed" : "pointer" }}
      onMouseEnter={(e) => { if (!d) { e.currentTarget.style.color = h; e.currentTarget.style.backgroundColor = "#1a1a22" } }}
      onMouseLeave={(e) => { e.currentTarget.style.color = c; e.currentTarget.style.backgroundColor = "transparent" }}
    >{children}</button>
  )
}
