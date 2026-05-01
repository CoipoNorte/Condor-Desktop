import { useState, useEffect } from "react"
import {
  VscClose, VscSave, VscSearch, VscPlay, VscTrash, VscDiscard,
  VscClippy, VscTerminal, VscEdit, VscNote, VscGripper,
  VscEye, VscEyeClosed, VscCopy, VscListFlat, VscRefresh,
} from "react-icons/vsc"
import { useStore, DEFAULT_CONFIG } from "../store"
import type { StoredConfig, BtnCfg } from "../store"

const ICONS: Record<string, React.ComponentType<{ size?: number }>> = {
  scan: VscSearch, run: VscPlay, clean: VscTrash, undo: VscDiscard,
  paste: VscClippy, cmd: VscTerminal, prompt: VscEdit, mini: VscNote,
  reload: VscRefresh, scripts: VscListFlat, copylog: VscCopy,
}

export default function ConfigModal() {
  const applyConfig = useStore((x) => x.applyConfig)
  const currentConfig = useStore((x) => x.storedConfig)

  const [order, setOrder] = useState<string[]>([])
  const [buttons, setButtons] = useState<Record<string, BtnCfg>>({})
  const [checks, setChecks] = useState({ autoRun: false, dryRun: false, backup: true, cmdSep: true })
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })
  const [dragItem, setDragItem] = useState<string | null>(null)
  const [instCopy, setInstCopy] = useState(true)
  const [instRun, setInstRun] = useState(true)
  const [instRemove, setInstRemove] = useState(true)
  const [promptText, setPromptText] = useState("")
  const [miniText, setMiniText] = useState("")
  const [tab, setTab] = useState<"buttons" | "prompts">("buttons")

  useEffect(() => {
    setOrder([...currentConfig.buttonOrder])
    setButtons(JSON.parse(JSON.stringify(currentConfig.buttons)))
    setChecks({ ...currentConfig.checkboxes })
    const prefs = (currentConfig as any).instructionButtons
    if (prefs) { setInstCopy(prefs.copy !== false); setInstRun(prefs.run !== false); setInstRemove(prefs.remove !== false) }
    setPos({ x: Math.max(0, (window.innerWidth - 540) / 2), y: Math.max(20, (window.innerHeight - 620) / 2) })
    // Load prompts
    window.electronAPI?.loadPrompt().then((t) => setPromptText(t || ""))
    window.electronAPI?.loadMiniPrompt().then((t) => setMiniText(t || ""))
  }, [])

  useEffect(() => {
    if (!dragging) return
    const mv = (e: MouseEvent) => setPos({ x: e.clientX - dragOff.x, y: e.clientY - dragOff.y })
    const up = () => setDragging(false)
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up)
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up) }
  }, [dragging, dragOff])

  const close = () => useStore.setState({ showConfig: false })
  const save = async () => {
    const cfg: any = { buttonOrder: order, buttons, checkboxes: checks, instructionButtons: { copy: instCopy, run: instRun, remove: instRemove } }
    await window.electronAPI?.saveConfig(cfg)
    await window.electronAPI?.savePrompt(promptText)
    await window.electronAPI?.saveMiniPrompt(miniText)
    applyConfig(cfg); close()
  }
  const updateBtn = (key: string, field: keyof BtnCfg, value: any) => { setButtons((prev) => ({ ...prev, [key]: { ...prev[key], [field]: value } })) }
  const onRowDragStart = (k: string) => setDragItem(k)
  const onRowDragOver = (e: React.DragEvent, t: string) => { e.preventDefault(); if (!dragItem || dragItem === t) return; setOrder((prev) => { const a = [...prev]; const f = a.indexOf(dragItem); const to = a.indexOf(t); if (f === -1 || to === -1) return prev; a.splice(f, 1); a.splice(to, 0, dragItem); return a }) }
  const onRowDragEnd = () => setDragItem(null)

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999 }} onClick={close}>
      <div onClick={(e) => e.stopPropagation()} style={{ position: "absolute", left: pos.x, top: pos.y, backgroundColor: "#16161a", border: "1px solid #2e2e38", width: 540, maxHeight: "85vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.5)" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "12px 20px", borderBottom: "1px solid #2e2e38", flexShrink: 0, cursor: "move", userSelect: "none" }}
          onMouseDown={(e) => { setDragging(true); setDragOff({ x: e.clientX - pos.x, y: e.clientY - pos.y }) }}>
          <span style={{ fontWeight: 700, fontSize: 14 }}>⚙️ Settings</span>
          <button onClick={close} style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2ea"; e.currentTarget.style.backgroundColor = "#24242c" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e"; e.currentTarget.style.backgroundColor = "transparent" }}><VscClose size={15} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #2e2e38", flexShrink: 0 }}>
          {(["buttons", "prompts"] as const).map((t) => (
            <button key={t} onClick={() => setTab(t)}
              style={{
                flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: tab === t ? "#e2e2ea" : "#5c5c6e",
                borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
              }}
              onMouseEnter={(e) => { if (tab !== t) e.currentTarget.style.color = "#9494a4" }}
              onMouseLeave={(e) => { if (tab !== t) e.currentTarget.style.color = "#5c5c6e" }}
            >
              {t === "buttons" ? "Buttons & Options" : "Prompts"}
            </button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>

          {tab === "buttons" && (
            <>
              {/* Toolbar Buttons */}
              <p style={{ fontSize: 10, color: "#5c5c6e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Toolbar Buttons — drag ☰ to reorder</p>
              {order.map((k) => { const b = buttons[k]; if (!b) return null; const Icon = ICONS[k]; const isHidden = b.visible === false; return (
                <div key={k} draggable onDragStart={() => onRowDragStart(k)} onDragOver={(e) => onRowDragOver(e, k)} onDragEnd={onRowDragEnd}
                  style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 2, height: 34, padding: "0 4px", backgroundColor: dragItem === k ? "#1c1c22" : "transparent", borderRadius: 4, opacity: isHidden ? 0.4 : 1 }}>
                  <div style={{ cursor: "grab", color: "#3a3a46", flexShrink: 0 }}><VscGripper size={14} /></div>
                  <button onClick={() => updateBtn(k, "visible", !b.visible)} draggable={false} onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}
                    style={{ width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center", color: isHidden ? "#f43f5e" : "#34d399", flexShrink: 0, borderRadius: 3, cursor: "pointer" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#24242c" }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}>
                    {isHidden ? <VscEyeClosed size={13} /> : <VscEye size={13} />}</button>
                  <input type="color" value={b.color} onChange={(e) => updateBtn(k, "color", e.target.value)} draggable={false} onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}
                    style={{ width: 20, height: 20, border: "none", background: "transparent", cursor: "pointer", flexShrink: 0 }} />
                  <input value={b.label} onChange={(e) => updateBtn(k, "label", e.target.value)} placeholder={k} draggable={false} onMouseDown={(e) => e.stopPropagation()} onDragStart={(e) => e.stopPropagation()}
                    style={{ flex: 1, height: 26, minWidth: 0, backgroundColor: "#0a0a0c", border: "1px solid #2e2e38", color: "#e2e2ea", fontSize: 11, padding: "0 8px", outline: "none", cursor: "text", textDecoration: isHidden ? "line-through" : "none" }}
                    onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }} onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }} />
                  <div style={{ height: 26, padding: b.label ? "0 8px" : "0 6px", display: "flex", alignItems: "center", gap: 4, fontSize: 10, fontWeight: 700, backgroundColor: isHidden ? "#1e1e26" : b.color + "18", color: isHidden ? "#3a3a46" : b.color, border: `1px solid ${isHidden ? "#2e2e38" : b.color + "22"}`, borderRadius: 3, flexShrink: 0, whiteSpace: "nowrap" }}>
                    {Icon && <Icon size={12} />}{b.label && <span>{b.label}</span>}</div>
                </div>) })}

              <div style={{ borderTop: "1px solid #2e2e38", margin: "14px 0" }} />

              {/* Instruction Actions */}
              <p style={{ fontSize: 10, color: "#5c5c6e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Instruction Actions</p>
              {([
                { key: "copy", label: "Copy", desc: "Copy instruction content", icon: <VscCopy size={12} />, val: instCopy, set: setInstCopy, color: "#9494a4" },
                { key: "run", label: "Run", desc: "Execute single instruction", icon: <VscPlay size={12} />, val: instRun, set: setInstRun, color: "#10b981" },
                { key: "remove", label: "Remove", desc: "Remove from list", icon: <VscTrash size={12} />, val: instRemove, set: setInstRemove, color: "#f43f5e" },
              ]).map((item) => (
                <label key={item.key} style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 8px", cursor: "pointer", borderRadius: 4 }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1a1a22" }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}>
                  <input type="checkbox" checked={item.val} onChange={(e) => item.set(e.target.checked)} style={{ width: 14, height: 14, accentColor: "#6366f1", cursor: "pointer" }} />
                  <span style={{ color: item.color, display: "flex", alignItems: "center" }}>{item.icon}</span>
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "#e2e2ea", fontWeight: 500 }}>{item.label}</div><div style={{ fontSize: 9, color: "#5c5c6e", marginTop: 1 }}>{item.desc}</div></div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3, backgroundColor: item.val ? "#10b98118" : "#2e2e3840", color: item.val ? "#34d399" : "#5c5c6e" }}>{item.val ? "ON" : "OFF"}</span>
                </label>))}

              <div style={{ borderTop: "1px solid #2e2e38", margin: "14px 0" }} />

              {/* Default States */}
              <p style={{ fontSize: 10, color: "#5c5c6e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Default states on startup</p>
              {([
                { k: "autoRun" as const, label: "Auto-Run", desc: "Execute automatically after pasting" },
                { k: "dryRun" as const, label: "Dry-Run", desc: "Simulate without changes" },
                { k: "backup" as const, label: "Backup", desc: "Create restore points" },
                { k: "cmdSep" as const, label: "CMD Sep", desc: "CMD in external windows" },
              ]).map(({ k, label, desc }) => (
                <label key={k} style={{ display: "flex", alignItems: "center", gap: 12, padding: "8px 8px", cursor: "pointer", borderRadius: 4, borderBottom: "1px solid #1e1e26" }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1a1a22" }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}>
                  <input type="checkbox" checked={checks[k]} onChange={(e) => setChecks((prev) => ({ ...prev, [k]: e.target.checked }))} style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer", flexShrink: 0 }} />
                  <div style={{ flex: 1 }}><div style={{ fontSize: 12, color: "#e2e2ea", fontWeight: 500 }}>{label}</div><div style={{ fontSize: 9, color: "#5c5c6e", marginTop: 1 }}>{desc}</div></div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3, backgroundColor: checks[k] ? "#10b98118" : "#2e2e3840", color: checks[k] ? "#34d399" : "#5c5c6e" }}>{checks[k] ? "ON" : "OFF"}</span>
                </label>))}
            </>
          )}

          {tab === "prompts" && (
            <>
              {/* Prompt */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <VscEdit size={14} style={{ color: "#d946ef" }} />
                  <p style={{ fontSize: 12, color: "#e2e2ea", fontWeight: 700 }}>Prompt</p>
                </div>
                <p style={{ fontSize: 10, color: "#5c5c6e", marginBottom: 8 }}>
                  Text copied to clipboard when you click the Prompt button. Use it for your main AI system prompt.
                </p>
                <textarea
                  value={promptText}
                  onChange={(e) => setPromptText(e.target.value)}
                  placeholder="Paste your main prompt here..."
                  spellCheck={false}
                  style={{
                    width: "100%", height: 180,
                    backgroundColor: "#0a0a0c", border: "1px solid #2e2e38",
                    color: "#e2e2ea", fontSize: 11, padding: 12,
                    fontFamily: "Consolas, monospace", resize: "vertical",
                    outline: "none", lineHeight: "1.6",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#3a3a46" }}>{promptText.length} chars</span>
                  <span style={{ fontSize: 10, color: "#3a3a46" }}>{promptText.split("\n").length} lines</span>
                </div>
              </div>

              {/* Mini Prompt */}
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                  <VscNote size={14} style={{ color: "#14b8a6" }} />
                  <p style={{ fontSize: 12, color: "#e2e2ea", fontWeight: 700 }}>Mini Prompt</p>
                </div>
                <p style={{ fontSize: 10, color: "#5c5c6e", marginBottom: 8 }}>
                  Short text copied when you click the Mini button. Use it for quick instructions or context.
                </p>
                <textarea
                  value={miniText}
                  onChange={(e) => setMiniText(e.target.value)}
                  placeholder="Paste your mini prompt here..."
                  spellCheck={false}
                  style={{
                    width: "100%", height: 120,
                    backgroundColor: "#0a0a0c", border: "1px solid #2e2e38",
                    color: "#e2e2ea", fontSize: 11, padding: 12,
                    fontFamily: "Consolas, monospace", resize: "vertical",
                    outline: "none", lineHeight: "1.6",
                  }}
                  onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
                  onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }}
                />
                <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                  <span style={{ fontSize: 10, color: "#3a3a46" }}>{miniText.length} chars</span>
                  <span style={{ fontSize: 10, color: "#3a3a46" }}>{miniText.split("\n").length} lines</span>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid #2e2e38", flexShrink: 0 }}>
          <button onClick={close} style={{ height: 32, padding: "0 16px", fontSize: 11, fontWeight: 600, backgroundColor: "#24242c", color: "#9494a4", borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2e2e38" }} onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#24242c" }}>Cancel</button>
          <button onClick={save} style={{ height: 32, padding: "0 16px", fontSize: 11, fontWeight: 700, backgroundColor: "#6366f1", color: "white", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)" }} onMouseLeave={(e) => { e.currentTarget.style.filter = "none" }}><VscSave size={13} /> Save</button>
        </div>
      </div>
    </div>
  )
}
