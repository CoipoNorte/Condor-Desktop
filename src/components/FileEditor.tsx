import { useEffect, useState } from "react"
import { VscClose, VscSave } from "react-icons/vsc"

export default function FileEditor() {
  const [file, setFile] = useState<{ path: string; content: string } | null>(null)
  const [value, setValue] = useState("")
  const [saved, setSaved] = useState(false)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [dragOff, setDragOff] = useState({ x: 0, y: 0 })

  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type !== "condor-edit-file") return
      setFile({ path: e.data.path, content: e.data.content })
      setValue(e.data.content)
      setSaved(false)
      setPos({
        x: Math.max(0, (window.innerWidth - 600) / 2),
        y: Math.max(20, (window.innerHeight - 500) / 2),
      })
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [])

  useEffect(() => {
    if (!dragging) return
    const mv = (e: MouseEvent) => setPos({ x: e.clientX - dragOff.x, y: e.clientY - dragOff.y })
    const up = () => setDragging(false)
    window.addEventListener("mousemove", mv)
    window.addEventListener("mouseup", up)
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up) }
  }, [dragging, dragOff])

  if (!file) return null

  const fileName = file.path.split(/[\\/]/).pop() || ""

  const save = async () => {
    // Write file via executeInstruction
    const dir = file.path.substring(0, file.path.lastIndexOf("\\"))
    const name = fileName.substring(0, fileName.lastIndexOf("."))
    const ext = fileName.substring(fileName.lastIndexOf(".") + 1)
    await window.electronAPI.executeInstruction(
      { id: "edit", ubicacion: ".", nombre: "nan", extension: "cmd", accion: "EJECUTAR",
        content: `echo. > nul`, status: "pending", enabled: true },
      { dryRun: false, backup: true }
    )
    // Direct write
    await window.electronAPI.executeInstruction(
      { id: "edit-write", ubicacion: dir.replace(/\\/g, "/"), nombre: name, extension: ext,
        accion: "MODIFICAR", content: value, status: "pending", enabled: true },
      { dryRun: false, backup: true }
    )
    setSaved(true)
    setTimeout(() => setSaved(false), 1500)
  }

  const close = () => setFile(null)

  return (
    <div style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.6)", zIndex: 9999 }} onClick={close}>
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          position: "absolute", left: pos.x, top: pos.y,
          backgroundColor: "#16161a", border: "1px solid #2e2e38",
          width: 600, maxHeight: "80vh",
          display: "flex", flexDirection: "column",
          boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
        }}
      >
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "10px 16px", borderBottom: "1px solid #2e2e38",
            flexShrink: 0, cursor: "move", userSelect: "none",
          }}
          onMouseDown={(e) => { setDragging(true); setDragOff({ x: e.clientX - pos.x, y: e.clientY - pos.y }) }}
        >
          <span style={{ fontSize: 12, fontWeight: 700, color: "#e2e2ea" }}>📝 {fileName}</span>
          <button onClick={close}
            style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", color: "#5c5c6e", borderRadius: 3 }}
            onMouseEnter={(e) => { e.currentTarget.style.color = "#e2e2ea"; e.currentTarget.style.backgroundColor = "#24242c" }}
            onMouseLeave={(e) => { e.currentTarget.style.color = "#5c5c6e"; e.currentTarget.style.backgroundColor = "transparent" }}
          ><VscClose size={14} /></button>
        </div>

        <div style={{ flex: 1, overflow: "hidden", padding: 12 }}>
          <textarea
            value={value}
            onChange={(e) => { setValue(e.target.value); setSaved(false) }}
            spellCheck={false}
            style={{
              width: "100%", height: 350,
              backgroundColor: "#0a0a0c", border: "1px solid #2e2e38",
              color: "#e2e2ea", fontSize: 12, padding: 14,
              fontFamily: "Consolas, monospace", resize: "none",
              outline: "none", lineHeight: "1.6",
              userSelect: "text", WebkitUserSelect: "text",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "#6366f1" }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "#2e2e38" }}
            onKeyDown={(e) => {
              if (e.ctrlKey && e.key === "s") { e.preventDefault(); save() }
            }}
          />
        </div>

        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "10px 16px", borderTop: "1px solid #2e2e38", flexShrink: 0,
        }}>
          <span style={{ fontSize: 10, color: "#5c5c6e" }}>Ctrl+S to save</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={close}
              style={{ height: 30, padding: "0 14px", fontSize: 11, fontWeight: 600, backgroundColor: "#24242c", color: "#9494a4", borderRadius: 4 }}
              onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#2e2e38" }}
              onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#24242c" }}
            >Close</button>
            <button onClick={save}
              style={{
                height: 30, padding: "0 14px", fontSize: 11, fontWeight: 700, borderRadius: 4,
                display: "flex", alignItems: "center", gap: 5,
                backgroundColor: saved ? "#10b981" : "#6366f1", color: "white",
              }}
              onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.15)" }}
              onMouseLeave={(e) => { e.currentTarget.style.filter = "none" }}
            >
              <VscSave size={12} /> {saved ? "Saved!" : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
