import { useState, useEffect, useRef } from "react"
import { VscSearch, VscPlay, VscTrash, VscDiscard, VscClippy, VscTerminal, VscEdit, VscNote, VscListFlat, VscRefresh, VscCopy, VscClose, VscSave } from "react-icons/vsc"
import { useStore } from "../store"

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  scan: VscSearch, run: VscPlay, clean: VscTrash, undo: VscDiscard,
  paste: VscClippy, cmd: VscTerminal, prompt: VscEdit, mini: VscNote,
  reload: VscRefresh, scripts: VscListFlat, copylog: VscCopy,
}

const BOTTOM_ROW_BUTTONS = new Set(["scripts", "copylog"])

export default function Toolbar() {
  const s = useStore()
  const sc = useStore((x) => x.storedConfig)
  const [scripts, setScripts] = useState<Record<string, string>>({})
    const [showScripts, setShowScripts] = useState(false)
  const [showScriptEditor, setShowScriptEditor] = useState(false)
  const [editScripts, setEditScripts] = useState<Record<string, string>>({})
  const [newScriptName, setNewScriptName] = useState("")
  const [newScriptCmd, setNewScriptCmd] = useState("")
  const [dropRight, setDropRight] = useState(true)
  const scriptsRef = useRef<HTMLDivElement>(null)
  const scriptsBtnRef = useRef<HTMLButtonElement>(null)

    const loadScripts = () => {
    if (!s.projectPath) { setScripts({}); return }
    window.electronAPI?.getScripts().then((r) => setScripts(r || {}))
  }
  useEffect(() => { loadScripts() }, [s.projectPath])
  useEffect(() => { if (!s.isRunning) loadScripts() }, [s.isRunning])
  useEffect(() => { if (s.instructions.length === 0) loadScripts() }, [s.instructions.length])
  // Poll for scripts every 5 seconds
  useEffect(() => {
    if (!s.projectPath) return
    const id = setInterval(loadScripts, 5000)
    return () => clearInterval(id)
  }, [s.projectPath])
  // Also reload when file tree changes
  useEffect(() => { loadScripts() }, [s.fileTree])

  const toggleScripts = () => {
    if (!showScripts && scriptsBtnRef.current) {
      const rect = scriptsBtnRef.current.getBoundingClientRect()
      setDropRight(window.innerWidth - rect.left > 220)
    }
    setShowScripts(!showScripts)
  }

  useEffect(() => {
    if (!showScripts) return
    const close = (e: MouseEvent) => { if (scriptsRef.current && !scriptsRef.current.contains(e.target as Node)) setShowScripts(false) }
    window.addEventListener("click", close); return () => window.removeEventListener("click", close)
  }, [showScripts])

  const paste = async () => {
    const t = await window.electronAPI?.readClipboard(); if (!t) return
    s.set({ rawPaste: t }); const p = await window.electronAPI?.parseInstructions(t)
    if (p) { s.set({ instructions: p }); if (useStore.getState().autoRun && useStore.getState().projectPath) setTimeout(() => runAll(), 300) }
  }

  const runAll = async () => {
    if (!s.projectPath || s.isRunning) return
    const insts = useStore.getState().instructions; if (!insts.some((i) => i.enabled && i.status !== "success")) return
    s.set({ isRunning: true }); s.clearTerminal()
    await window.electronAPI?.killTerminal(); await window.electronAPI?.spawnTerminal()
    s.addTermLine(`❯ Running ${insts.filter((i) => i.enabled).length} instructions...\r\n`)
    const cmdSep = useStore.getState().cmdSep
    for (let i = 0; i < insts.length; i++) {
      const inst = insts[i]; if (!inst.enabled || inst.status === "success") continue; if (!useStore.getState().isRunning) break
      s.set({ currentIndex: i }); s.updateInst(inst.id, { status: "running" })
      try {
        if (cmdSep && inst.accion === "EJECUTAR") {
          s.addTermLine(`↗ External: ${inst.content.split("\n")[0]}\r\n`)
          const r = await window.electronAPI.executeInstruction({ ...inst, accion: "EJECUTAR_EXTERNO" }, { dryRun: useStore.getState().dryRun, backup: false })
          s.updateInst(inst.id, { status: r.success ? "success" : "error", message: r.message }); if (!r.success) break
        } else {
          s.addTermLine(`❯ [${i + 1}] ${inst.accion} ${inst.accion === "EJECUTAR" ? inst.content.split("\n")[0] : inst.nombre}\r\n`)
          const r = await window.electronAPI.executeInstruction(inst, { dryRun: useStore.getState().dryRun, backup: useStore.getState().backup })
          s.updateInst(inst.id, { status: r.success ? "success" : "error", message: r.message }); if (!r.success) break
        }
      } catch (e: any) { s.updateInst(inst.id, { status: "error", message: e.message }); break }
    }
        s.set({ isRunning: false, currentIndex: -1 }); s.addTermLine(`\r\n✅ Execution finished\r\n`)
    // Play notification sound
    try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Rk4yAc2xrbHeCkpOLgXRtbnN8i5eSi4F2cXJ2fImUk4uCd3N0d3yIkZKLgnl1dnh8ho+RjIN7d3d5fIWNkIyEfHl5en2EjI+MhH16ent9g4uOjIV+e3t8fYKKjYyGf3x8fX6BiYyMh4B9fX5/gYiLi4eAfn5/gIGHioqIgX9/gIGBhoqKiIKAgICBgYWJiYmCgYCBgoKFiIiJg4KBgoKDhIeIiIOCgoKDg4SGh4iEg4KDg4OEhoaHhIODg4SEhIaGhoSEg4SEhIWFhoaFhIOEhISFhYaGhYSEhIWEhYWFhYWEhISFhYWFhYWFhISEhYWFhYWFhYSEhIWFhYWFhYWFhISFhYWFhYWFhYSEhYWFhYWFhQ==").play() } catch {}
    if (s.projectPath) s.set({ fileTree: await window.electronAPI.getFileTree() })
  }

  const copyLog = () => {
    const insts = useStore.getState().instructions
    const log = insts.map((inst, i) => {
      const fp = inst.accion === "EJECUTAR" ? inst.content.split("\n")[0] : `${inst.ubicacion}/${inst.nombre}.${inst.extension}`
      const st = inst.status === "success" ? "✓" : inst.status === "error" ? "✗" : "○"
      const line = `${st} [${i + 1}] ${inst.accion} ${fp}`
      return inst.message && inst.status === "error" ? `${line}\n  ERROR: ${inst.message}` : line
    }).join("\n")
    navigator.clipboard?.writeText(log)
    s.addTermLine("📋 Log copied to clipboard\r\n")
  }

  const runScript = async (name: string, external: boolean) => {
    const cmd = `npm run ${name}`; setShowScripts(false)
    if (external) { await window.electronAPI?.runExternal(cmd); s.addTermLine(`↗ External: ${cmd}\r\n`) }
    else { s.clearTerminal(); await window.electronAPI?.killTerminal(); await window.electronAPI?.spawnTerminal(); s.addTermLine(`❯ ${cmd}\r\n`); window.electronAPI?.writeTerminal(cmd + "\r\n") }
  }

  const ACTIONS: Record<string, () => void> = {
    scan: async () => { const file = await window.electronAPI?.openFile(); if (!file) return; s.set({ rawPaste: file.content }); const p = await window.electronAPI?.parseInstructions(file.content); if (p) { s.set({ instructions: p }); s.addTermLine(`📄 Loaded: ${file.path.split(/[\\/]/).pop()} (${p.length} instructions)\r\n`) } },
    run: runAll,
    reload: () => { s.instructions.forEach((inst) => s.updateInst(inst.id, { status: "pending", message: undefined })) },
    clean: () => s.set({ instructions: [], rawPaste: "", terminalLines: [] }),
            undo: async () => {
      const r = await window.electronAPI?.undo()
      if (r?.success) {
        s.addTermLine(`↩ ${r.message}\r\n`)
        if (s.projectPath) s.set({ fileTree: await window.electronAPI.getFileTree() })
      } else {
        s.addTermLine(`✅ Nothing more to undo\r\n`)
        try { new Audio("data:audio/wav;base64,UklGRnoGAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoGAACBhYqFbF1fdH2Rk4yAc2xrbHeCkpOLgXRtbnN8i5eSi4F2cXJ2fImUk4uCd3N0d3yIkZKLgnl1dnh8ho+RjIN7d3d5fIWNkIyEfHl5en2EjI+MhH16ent9g4uOjIV+e3t8fYKKjYyGf3x8fX6BiYyMh4B9fX5/gYiLi4eAfn5/gIGHioqIgX9/gIGBhoqKiIKAgICBgYWJiYmCgYCBgoKFiIiJg4KBgoKDhIeIiIOCgoKDg4SGh4iEg4KDg4OEhoaHhIODg4SEhIaGhoSEg4SEhIWFhoaFhIOEhISFhYaGhYSEhIWEhYWFhYWEhISFhYWFhYWFhISEhYWFhYWFhYSEhIWFhYWFhYWFhISFhYWFhYWFhYSEhYWFhYWFhQ==").play() } catch {}
      }
    },
    paste: paste,
    cmd: async () => { if (!s.projectPath) return; s.clearTerminal(); await window.electronAPI?.spawnTerminal(); s.addTermLine(`❯ ${s.projectPath}\r\n`) },
    scripts: toggleScripts,
    copylog: copyLog,
        prompt: async () => {
      const text = await window.electronAPI?.loadPrompt()
      if (text) { navigator.clipboard?.writeText(text); s.addTermLine("📋 Prompt copied to clipboard\r\n") }
      else s.addTermLine("⚠ No prompt configured. Set it in Settings.\r\n")
    },
    mini: async () => {
      const text = await window.electronAPI?.loadMiniPrompt()
      if (text) { navigator.clipboard?.writeText(text); s.addTermLine("📋 Mini prompt copied to clipboard\r\n") }
      else s.addTermLine("⚠ No mini prompt configured. Set it in Settings.\r\n")
    },
  }

  const CMD_CTX: Record<string, ((e: React.MouseEvent) => void) | undefined> = {
    cmd: async (e) => { e.preventDefault(); if (!s.projectPath) return; await window.electronAPI?.runExternal(`cd /d "${s.projectPath}"`); s.addTermLine(`↗ External CMD\r\n`) },
  }

  const DISABLED: Record<string, boolean> = {
    run: s.isRunning || !s.projectPath,
    reload: s.isRunning || s.instructions.length === 0 || s.instructions.every((i) => i.status === "pending"),
    scripts: Object.keys(scripts).length === 0,
    copylog: s.instructions.length === 0 || s.instructions.every((i) => i.status === "pending"),
  }

  const scriptKeys = Object.keys(scripts)
  const topButtons = sc.buttonOrder.filter((k) => !BOTTOM_ROW_BUTTONS.has(k))
  const bottomButtons = sc.buttonOrder.filter((k) => BOTTOM_ROW_BUTTONS.has(k))

  const renderButton = (k: string) => {
    const Icon = ICONS[k]; if (!Icon) return null
    const btn = sc.buttons[k]; if (!btn || btn.visible === false) return null
    const disabled = DISABLED[k] || false; const action = ACTIONS[k] || (() => {}); const ctxAction = CMD_CTX[k]

    if (k === "scripts") {
      return (
        <div key={k} style={{ position: "relative" }} ref={scriptsRef}>
          <button ref={scriptsBtnRef} onClick={action} disabled={disabled} title={btn.label || k}
            style={{ height: 24, display: "flex", alignItems: "center", gap: 5, padding: btn.label ? "0 8px" : "0 6px", backgroundColor: btn.color + "18", color: btn.color, border: `1px solid ${btn.color}22`, borderRadius: 3, fontSize: 10, fontWeight: 700, opacity: disabled ? 0.15 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
            onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = "brightness(1.25)" }} onMouseLeave={(e) => { e.currentTarget.style.filter = "none" }}>
            <Icon size={12} />{btn.label && <span>{btn.label}</span>}
          </button>
          {showScripts && scriptKeys.length > 0 && (
                                    <div style={{ position: "fixed", marginTop: 4, backgroundColor: "#16161a", border: "1px solid #2e2e38", borderRadius: 4, boxShadow: "0 8px 24px rgba(0,0,0,0.4)", minWidth: 200, maxHeight: 300, overflowY: "auto", zIndex: 99999, padding: "4px 0", top: scriptsBtnRef.current ? scriptsBtnRef.current.getBoundingClientRect().bottom : 0, ...(dropRight ? { left: scriptsBtnRef.current ? scriptsBtnRef.current.getBoundingClientRect().left : 0 } : { right: window.innerWidth - (scriptsBtnRef.current ? scriptsBtnRef.current.getBoundingClientRect().right : 0) }) }}>
                                  <div style={{ padding: "4px 12px", fontSize: 9, color: "#5c5c6e", fontWeight: 700, textTransform: "uppercase", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span>Click = internal · Right = external</span>
                      <button onClick={(e) => { e.stopPropagation(); setShowScripts(false); setShowScriptEditor(true) }}
                        style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 3, fontSize: 10, fontWeight: 900, cursor: "pointer" }}
                        onMouseEnter={(e) => { e.currentTarget.style.color = "#f59e0b"; e.currentTarget.style.backgroundColor = "#1a1a22" }}
                        onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e"; e.currentTarget.style.backgroundColor = "transparent" }}
                        title="Edit scripts"
                      >{"{}"}</button>
                    </div>
              {scriptKeys.map((name) => (
                <button key={name} onClick={() => runScript(name, false)} onContextMenu={(e) => { e.preventDefault(); runScript(name, true) }}
                  style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", padding: "6px 12px", textAlign: "left", fontSize: 11, color: "#9494a4", cursor: "pointer", borderBottom: "1px solid #1e1e26" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1a1a22"; e.currentTarget.style.color = "#e2e2ea" }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#9494a4" }}>
                  <VscPlay size={11} style={{ color: "#10b981", flexShrink: 0 }} /><span style={{ fontWeight: 600 }}>{name}</span>
                  <span style={{ flex: 1, fontSize: 9, color: "#3a3a46", textAlign: "right", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{scripts[name]}</span>
                </button>))}
            </div>)}
        </div>)
    }

    return (
      <button key={k} onClick={action} onContextMenu={ctxAction} disabled={disabled}
        title={ctxAction ? `${btn.label || k} (right-click: external)` : (btn.label || k)}
        style={{ height: k === "copylog" ? 24 : 32, display: "flex", alignItems: "center", gap: 6, padding: btn.label ? (k === "copylog" ? "0 8px" : "0 12px") : (k === "copylog" ? "0 6px" : "0 8px"), backgroundColor: btn.color + "18", color: btn.color, border: `1px solid ${btn.color}22`, borderRadius: k === "copylog" ? 3 : 4, fontSize: k === "copylog" ? 10 : 11, fontWeight: 700, opacity: disabled ? 0.15 : 1, cursor: disabled ? "not-allowed" : "pointer" }}
        onMouseEnter={(e) => { if (!disabled) e.currentTarget.style.filter = "brightness(1.25)" }} onMouseLeave={(e) => { e.currentTarget.style.filter = "none" }}>
        <Icon size={k === "copylog" ? 12 : 15} />{btn.label && <span>{btn.label}</span>}
      </button>)
  }

  return (
    <div style={{ flexShrink: 0 }}>
      {/* Top row: main buttons */}
      <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: 8, padding: "8px 12px 6px 4px", borderBottom: "1px solid #1e1e26" }}>
        {topButtons.map(renderButton)}
        {s.isRunning && (
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: 8, padding: "4px 12px", borderRadius: 999, backgroundColor: "#10b98110", border: "1px solid #10b98120" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", backgroundColor: "#10b981" }} className="animate-pulse" />
            <span style={{ fontSize: 11, color: "#10b981", fontWeight: 700 }}>Running</span>
          </div>)}
      </div>

      {/* Bottom row: checkboxes + scripts/copylog */}
      <div style={{ display: "flex", alignItems: "center", gap: 20, padding: "5px 12px", borderBottom: "1px solid #1e1e26" }}>
        {([
          { k: "autoRun" as const, l: "Auto-Run", tip: "Run immediately after pasting" },
          { k: "dryRun" as const, l: "Dry-Run", tip: "Simulate without changes" },
          { k: "backup" as const, l: "Backup", tip: "Create restore points" },
          { k: "cmdSep" as const, l: "CMD Sep", tip: "CMD in external windows" },
        ]).map((c) => (
          <label key={c.k} title={c.tip} style={{ display: "flex", alignItems: "center", gap: 7, fontSize: 11, color: s[c.k] ? "#e2e2ea" : "#9494a4", cursor: "pointer" }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2ea" }} onMouseLeave={(e) => { e.currentTarget.style.color = s[c.k] ? "#e2e2ea" : "#9494a4" }}>
            <input type="checkbox" checked={s[c.k]} onChange={(e) => s.set({ [c.k]: e.target.checked })} style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
            <span style={{ fontWeight: 500 }}>{c.l}</span>
          </label>))}

        <div style={{ flex: 1 }} />

        {/* Scripts and Copylog buttons in checkbox row */}
        <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
          {bottomButtons.map(renderButton)}
        </div>

        {s.instructions.length > 0 && (
          <span style={{ fontSize: 11, color: "#5c5c6e", fontWeight: 500 }}>
            <span style={{ color: "#34d399" }}>{s.instructions.filter((i) => i.status === "success").length}</span>
            <span style={{ margin: "0 2px" }}>/</span>{s.instructions.length}
          </span>)}
            </div>

      {/* Script Editor Modal */}
      {showScriptEditor && (
        <ScriptEditor
          scripts={scripts}
          onSave={async (newScripts) => {
            await window.electronAPI?.saveScripts(newScripts)
            setShowScriptEditor(false)
            loadScripts()
          }}
          onClose={() => setShowScriptEditor(false)}
        />
      )}
    </div>
  )
}

function ScriptEditor({ scripts, onSave, onClose }: {
  scripts: Record<string, string>
  onSave: (s: Record<string, string>) => void
  onClose: () => void
}) {
  const [items, setItems] = useState<{ name: string; cmd: string }[]>([])
  const [newName, setNewName] = useState("")
  const [newCmd, setNewCmd] = useState("")
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })

  useEffect(() => {
    setItems(Object.entries(scripts).map(([name, cmd]) => ({ name, cmd })))
    setPos({ x: Math.max(0, (window.innerWidth - 460) / 2), y: Math.max(30, (window.innerHeight - 400) / 2) })
  }, [])

  useEffect(() => {
    if (!dragging) return
    const mv = (e: MouseEvent) => setPos({ x: e.clientX - dragOff.x, y: e.clientY - dragOff.y })
    const up = () => setDragging(false)
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up)
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up) }
  }, [dragging, dragOff])

  const save = () => {
    const obj: Record<string, string> = {}
    items.forEach((i) => { if (i.name.trim()) obj[i.name.trim()] = i.cmd })
    onSave(obj)
  }

  const addScript = () => {
    if (!newName.trim()) return
    setItems([...items, { name: newName.trim(), cmd: newCmd }])
    setNewName(""); setNewCmd("")
  }

  const removeScript = (idx: number) => {
    setItems(items.filter((_, i) => i !== idx))
  }

  const updateScript = (idx: number, field: "name" | "cmd", value: string) => {
    setItems(items.map((item, i) => i === idx ? { ...item, [field]: value } : item))
  }

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 99999 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()}
        style={{ position: "absolute", left: pos.x, top: pos.y, backgroundColor: "#16161a", border: "1px solid #2e2e38", width: 460, maxHeight: "75vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>

        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #2e2e38", flexShrink: 0, cursor: "move", userSelect: "none" }}
          onMouseDown={(e) => { setDragging(true); setDragOff({ x: e.clientX - pos.x, y: e.clientY - pos.y }) }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>📝 Edit Scripts</span>
          <button onClick={onClose}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2ea"; e.currentTarget.style.backgroundColor = "#24242c" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e"; e.currentTarget.style.backgroundColor = "transparent" }}>
            <VscClose size={15} />
          </button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          <p style={{ fontSize: 10, color: "#5c5c6e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>
            package.json scripts
          </p>

          {items.map((item, idx) => (
            <div key={idx} style={{ display: "flex", gap: 6, marginBottom: 6, alignItems: "center" }}>
              <input value={item.name} onChange={(e) => updateScript(idx, "name", e.target.value)}
                style={{ width: 100, height: 28, backgroundColor: "#0a0a0c", border: "1px solid #2e2e38", color: "#f59e0b", fontSize: 11, padding: "0 8px", outline: "none", fontWeight: 700, flexShrink: 0 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }} />
              <input value={item.cmd} onChange={(e) => updateScript(idx, "cmd", e.target.value)}
                style={{ flex: 1, height: 28, backgroundColor: "#0a0a0c", border: "1px solid #2e2e38", color: "#e2e2ea", fontSize: 11, padding: "0 8px", outline: "none", fontFamily: "Consolas, monospace" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }} />
              <button onClick={() => removeScript(idx)}
                style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 3, flexShrink: 0, cursor: "pointer" }}
                onMouseEnter={(e) => { e.currentTarget.style.color = "#f43f5e"; e.currentTarget.style.backgroundColor = "#f43f5e18" }}
                onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e"; e.currentTarget.style.backgroundColor = "transparent" }}>
                <VscTrash size={12} />
              </button>
            </div>
          ))}

          {/* Add new */}
          <div style={{ borderTop: "1px solid #2e2e38", marginTop: 10, paddingTop: 10 }}>
            <p style={{ fontSize: 10, color: "#5c5c6e", marginBottom: 6 }}>Add new script</p>
            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
              <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="name"
                onKeyDown={(e) => { if (e.key === "Enter") addScript() }}
                style={{ width: 100, height: 28, backgroundColor: "#0a0a0c", border: "1px solid #2e2e38", color: "#f59e0b", fontSize: 11, padding: "0 8px", outline: "none", fontWeight: 700, flexShrink: 0 }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }} />
              <input value={newCmd} onChange={(e) => setNewCmd(e.target.value)} placeholder="command"
                onKeyDown={(e) => { if (e.key === "Enter") addScript() }}
                style={{ flex: 1, height: 28, backgroundColor: "#0a0a0c", border: "1px solid #2e2e38", color: "#e2e2ea", fontSize: 11, padding: "0 8px", outline: "none", fontFamily: "Consolas, monospace" }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }} />
              <button onClick={addScript}
                style={{ height: 28, padding: "0 10px", fontSize: 10, fontWeight: 700, backgroundColor: "#6366f1", color: "white", borderRadius: 3, cursor: "pointer", flexShrink: 0 }}>
                Add
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid #2e2e38", flexShrink: 0 }}>
          <button onClick={onClose}
            style={{ height: 32, padding: "0 16px", fontSize: 11, fontWeight: 600, backgroundColor: "#24242c", color: "#9494a4", borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2e2e38" }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#24242c" }}>Cancel</button>
          <button onClick={save}
            style={{ height: 32, padding: "0 16px", fontSize: 11, fontWeight: 700, backgroundColor: "#6366f1", color: "white", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)" }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none" }}>
            <VscSave size={13} /> Save
          </button>
        </div>
      </div>
    </div>
  )
}
