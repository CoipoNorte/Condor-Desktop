import { useState, useEffect } from "react"
import { VscClose, VscSave, VscAdd, VscTrash } from "react-icons/vsc"
import { useStore } from "../store"

interface IgnoreData {
  ignored_folders: string[]
  ignored_files: string[]
  ignored_extensions: string[]
  image_extensions: string[]
  exceptions: { folders: string[]; files: string[]; extensions: string[] }
  max_depth: number
  show_hidden_files: boolean
}

const SECTIONS: Record<string, { title: string; desc: string; placeholder: string }> = {
  ignored_folders: { title: "Ignored Folders", desc: "Folders excluded from tree copy", placeholder: "folder name..." },
  ignored_files: { title: "Ignored Files", desc: "Files excluded from tree copy", placeholder: "file name..." },
  ignored_extensions: { title: "Ignored Extensions", desc: "File extensions to skip", placeholder: ".ext" },
  image_extensions: { title: "Image Extensions", desc: "Recognized as images", placeholder: ".ext" },
}

export default function IgnoreModal() {
  const s = useStore()
  const [data, setData] = useState<IgnoreData | null>(null)
  const [tab, setTab] = useState<"visual" | "json">("visual")
  const [jsonText, setJsonText] = useState("")
  const [jsonErr, setJsonErr] = useState("")
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })
  const [adding, setAdding] = useState<{ section: string; value: string } | null>(null)

  useEffect(() => {
    window.electronAPI?.loadIgnoreConfig().then((c: any) => {
      setData(c)
      setJsonText(JSON.stringify(c, null, 2))
    })
    setPos({
      x: Math.max(0, (window.innerWidth - 520) / 2),
      y: Math.max(20, (window.innerHeight - 560) / 2),
    })
  }, [])

  useEffect(() => {
    if (!dragging) return
    const mv = (e: MouseEvent) => setPos({ x: e.clientX - dragOff.x, y: e.clientY - dragOff.y })
    const up = () => setDragging(false)
    window.addEventListener("mousemove", mv)
    window.addEventListener("mouseup", up)
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up) }
  }, [dragging, dragOff])

  const close = () => s.set({ showIgnore: false })

  const save = async () => {
    if (tab === "json") {
      try {
        const parsed = JSON.parse(jsonText)
        await window.electronAPI?.saveIgnoreConfig(parsed)
        close()
      } catch { setJsonErr("Invalid JSON") }
    } else if (data) {
      await window.electronAPI?.saveIgnoreConfig(data)
      close()
    }
  }

  const removeItem = (section: string, index: number) => {
    if (!data) return
    const arr = [...(data as any)[section]]
    arr.splice(index, 1)
    const nd = { ...data, [section]: arr }
    setData(nd)
    setJsonText(JSON.stringify(nd, null, 2))
  }

  const addItem = (section: string, value: string) => {
    if (!data || !value.trim()) return
    const arr = [...(data as any)[section], value.trim()]
    const nd = { ...data, [section]: arr }
    setData(nd)
    setJsonText(JSON.stringify(nd, null, 2))
    setAdding(null)
  }

  if (!data) return null

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999 }} onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", left: pos.x, top: pos.y,
          backgroundColor: "#16161a", border: "1px solid #2e2e38",
          width: 520, maxHeight: "85vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "12px 20px", borderBottom: "1px solid #2e2e38",
            flexShrink: 0, cursor: "move", userSelect: "none",
          }}
          onMouseDown={(e) => { setDragging(true); setDragOff({ x: e.clientX - pos.x, y: e.clientY - pos.y }) }}
        >
          <div>
            <span style={{ fontWeight: 700, fontSize: 14 }}>📋 Ignore Config</span>
            <span style={{ fontSize: 10, color: "#5c5c6e", marginLeft: 8 }}>tree copy filter</span>
          </div>
          <button onClick={close}
            style={{ width: 28, height: 28, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2ea"; e.currentTarget.style.backgroundColor = "#24242c" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e"; e.currentTarget.style.backgroundColor = "transparent" }}
          ><VscClose size={15} /></button>
        </div>

        {/* Tabs */}
        <div style={{ display: "flex", borderBottom: "1px solid #2e2e38", flexShrink: 0 }}>
          {(["visual", "json"] as const).map((t) => (
            <button key={t} onClick={() => {
              setTab(t)
              if (t === "json" && data) setJsonText(JSON.stringify(data, null, 2))
              if (t === "visual" && jsonText) { try { setData(JSON.parse(jsonText)); setJsonErr("") } catch {} }
            }}
              style={{
                flex: 1, padding: "8px 0", fontSize: 11, fontWeight: 600,
                textTransform: "uppercase", letterSpacing: "0.08em",
                color: tab === t ? "#e2e2ea" : "#5c5c6e",
                borderBottom: tab === t ? "2px solid #6366f1" : "2px solid transparent",
              }}
              onMouseEnter={(e) => { if (tab !== t) e.currentTarget.style.color = "#9494a4" }}
              onMouseLeave={(e) => { if (tab !== t) e.currentTarget.style.color = "#5c5c6e" }}
            >{t === "visual" ? "Visual Editor" : "Raw JSON"}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: "auto" }}>
          {tab === "visual" ? (
            <div style={{ padding: "8px 0" }}>
              {(["ignored_folders", "ignored_files", "ignored_extensions", "image_extensions"] as const).map((section) => {
                const info = SECTIONS[section]
                const items: string[] = (data as any)[section] || []
                return (
                  <div key={section} style={{ marginBottom: 2 }}>
                    {/* Section header */}
                    <div style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "8px 20px", backgroundColor: "#12121590",
                    }}>
                      <div>
                        <div style={{ fontSize: 11, color: "#e2e2ea", fontWeight: 600 }}>{info.title}</div>
                        <div style={{ fontSize: 9, color: "#5c5c6e", marginTop: 1 }}>{info.desc}</div>
                      </div>
                      <button
                        onClick={() => setAdding(adding?.section === section ? null : { section, value: "" })}
                        style={{
                          width: 22, height: 22, display: "flex", alignItems: "center", justifyContent: "center",
                          color: adding?.section === section ? "#6366f1" : "#5c5c6e", borderRadius: 3, cursor: "pointer",
                        }}
                        onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#24242c" }}
                        onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
                      ><VscAdd size={14} /></button>
                    </div>

                    {/* Add input */}
                    {adding?.section === section && (
                      <div style={{ display: "flex", gap: 6, padding: "6px 20px", backgroundColor: "#14141a" }}>
                        <input
                          autoFocus
                          value={adding.value}
                          onChange={(e) => setAdding({ ...adding, value: e.target.value })}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") addItem(section, adding.value)
                            if (e.key === "Escape") setAdding(null)
                          }}
                          placeholder={info.placeholder}
                          style={{
                            flex: 1, height: 26, backgroundColor: "#0a0a0c",
                            border: "1px solid #6366f1", color: "#e2e2ea",
                            fontSize: 11, padding: "0 8px", outline: "none",
                          }}
                        />
                        <button onClick={() => addItem(section, adding.value)}
                          style={{ height: 26, padding: "0 10px", fontSize: 10, fontWeight: 700, backgroundColor: "#6366f1", color: "white", borderRadius: 3 }}>
                          Add
                        </button>
                      </div>
                    )}

                    {/* Items as chips */}
                    <div style={{ padding: "6px 20px" }}>
                      {items.length === 0 ? (
                        <div style={{ fontSize: 10, color: "#3a3a46", fontStyle: "italic", padding: "2px 0" }}>No items</div>
                      ) : (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                          {items.map((item, idx) => (
                            <div key={idx} style={{
                              display: "flex", alignItems: "center", gap: 4,
                              height: 24, padding: "0 6px 0 8px",
                              backgroundColor: "#1e1e26", borderRadius: 3,
                              fontSize: 11, color: "#9494a4",
                            }}>
                              <span>{item}</span>
                              <button onClick={() => removeItem(section, idx)}
                                style={{ width: 14, height: 14, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 2, cursor: "pointer" }}
                                onMouseEnter={(e) => { e.currentTarget.style.color = "#fb7185"; e.currentTarget.style.backgroundColor = "#f43f5e18" }}
                                onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e"; e.currentTarget.style.backgroundColor = "transparent" }}
                              ><VscClose size={10} /></button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                )
              })}

              {/* Options */}
              <div style={{ padding: "8px 20px", borderTop: "1px solid #2e2e38", marginTop: 4 }}>
                <div style={{ fontSize: 10, color: "#5c5c6e", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em", marginBottom: 10 }}>Options</div>

                <label style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px", cursor: "pointer", borderRadius: 4 }}
                  onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1a1a22" }}
                  onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}>
                  <input type="checkbox" checked={data.show_hidden_files}
                    onChange={(e) => { const nd = { ...data, show_hidden_files: e.target.checked }; setData(nd); setJsonText(JSON.stringify(nd, null, 2)) }}
                    style={{ width: 15, height: 15, accentColor: "#6366f1", cursor: "pointer" }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 12, color: "#e2e2ea" }}>Show Hidden Files</div>
                    <div style={{ fontSize: 9, color: "#5c5c6e", marginTop: 1 }}>Include files starting with dot</div>
                  </div>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 3, backgroundColor: data.show_hidden_files ? "#10b98118" : "#2e2e3840", color: data.show_hidden_files ? "#34d399" : "#5c5c6e" }}>
                    {data.show_hidden_files ? "ON" : "OFF"}
                  </span>
                </label>

                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "8px 6px" }}>
                  <span style={{ fontSize: 12, color: "#e2e2ea", flex: 1 }}>Max Depth</span>
                  <select value={data.max_depth}
                    onChange={(e) => { const nd = { ...data, max_depth: parseInt(e.target.value) }; setData(nd); setJsonText(JSON.stringify(nd, null, 2)) }}
                    style={{ height: 28, padding: "0 8px", backgroundColor: "#0a0a0c", border: "1px solid #2e2e38", color: "#e2e2ea", fontSize: 11, outline: "none", cursor: "pointer", borderRadius: 3 }}>
                    <option value={-1}>Unlimited</option>
                    {[1, 2, 3, 4, 5, 8, 10, 15, 20].map((n) => (
                      <option key={n} value={n}>{n} levels</option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ) : (
            <div style={{ padding: 16 }}>
              <textarea value={jsonText} onChange={(e) => { setJsonText(e.target.value); setJsonErr("") }} spellCheck={false}
                style={{
                  width: "100%", height: 340, backgroundColor: "#0a0a0c", border: "1px solid #2e2e38",
                  color: "#e2e2ea", fontSize: 11, padding: 14, fontFamily: "Consolas, monospace",
                  resize: "none", outline: "none", lineHeight: "1.6",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }} />
              {jsonErr && <p style={{ color: "#fb7185", fontSize: 11, marginTop: 6, fontWeight: 600 }}>{jsonErr}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", justifyContent: "flex-end", gap: 8, padding: "12px 20px", borderTop: "1px solid #2e2e38", flexShrink: 0 }}>
          <button onClick={close}
            style={{ height: 32, padding: "0 16px", fontSize: 11, fontWeight: 600, backgroundColor: "#24242c", color: "#9494a4", borderRadius: 4 }}
            onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2e2e38" }}
            onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#24242c" }}>Cancel</button>
          <button onClick={save}
            style={{ height: 32, padding: "0 16px", fontSize: 11, fontWeight: 700, backgroundColor: "#6366f1", color: "white", borderRadius: 4, display: "flex", alignItems: "center", gap: 6 }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)" }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none" }}><VscSave size={13} /> Save</button>
        </div>
      </div>
    </div>
  )
}
