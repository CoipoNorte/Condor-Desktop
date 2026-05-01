import { useState } from "react"
import {
  VscCheck, VscError, VscCircleFilled, VscLoading,
  VscDebugStepOver, VscChevronDown, VscChevronRight, VscEdit,
  VscCopy, VscPlay, VscTrash,
} from "react-icons/vsc"
import { useStore } from "../store"

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "success":  return <VscCheck size={14} className="shrink-0 text-ok" />
    case "error":    return <VscError size={14} className="shrink-0 text-err" />
    case "running":  return <VscLoading size={14} className="shrink-0 text-info anim-spin" />
    case "skipped":  return <VscDebugStepOver size={14} className="shrink-0 text-txt-3" />
    default:         return <VscCircleFilled size={6} className="shrink-0 text-txt-3" />
  }
}

const BADGE: Record<string, { bg: string; color: string }> = {
  CREAR:      { bg: "#10b98118", color: "#34d399" },
  MODIFICAR:  { bg: "#f59e0b18", color: "#fbbf24" },
  EJECUTAR:   { bg: "#6366f118", color: "#818cf8" },
  ELIMINAR:   { bg: "#f43f5e18", color: "#fb7185" },
  REEMPLAZAR: { bg: "#8b5cf618", color: "#a78bfa" },
}

function Card({ inst, idx }: { inst: CondorInstruction; idx: number }) {
  const { toggleInst, updateInst, currentIndex, set, storedConfig } = useStore()
  const instBtns = (storedConfig as any).instructionButtons || { copy: true, run: true, remove: true }
  const [open, setOpen] = useState(false)
  const [edit, setEdit] = useState(false)
  const [val, setVal] = useState(inst.content)
  const [copied, setCopied] = useState(false)
  const active = currentIndex === idx
  const badge = BADGE[inst.accion] ?? { bg: "#24242c", color: "#9494a4" }

  const path =
    inst.accion === "EJECUTAR"
      ? inst.content.split("\n")[0].substring(0, 80)
      : `${inst.ubicacion}/${inst.nombre}${inst.nombre !== "nan" ? "." + inst.extension : ""}`

  const save = () => {
    updateInst(inst.id, { content: val })
    setEdit(false)
  }

  const copyContent = () => {
    navigator.clipboard?.writeText(inst.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 1500)
  }

  const runSingle = async () => {
    updateInst(inst.id, { status: "running" })
    try {
      const r = await window.electronAPI.executeInstruction(inst, {
        dryRun: useStore.getState().dryRun,
        backup: useStore.getState().backup,
      })
      updateInst(inst.id, { status: r.success ? "success" : "error", message: r.message })
    } catch (e: any) {
      updateInst(inst.id, { status: "error", message: e.message })
    }
    // Refresh tree
    const pp = useStore.getState().projectPath
    if (pp) {
      const tree = await window.electronAPI.getFileTree()
      set({ fileTree: tree })
    }
  }

  const removeInst = () => {
    const insts = useStore.getState().instructions.filter((i) => i.id !== inst.id)
    set({ instructions: insts })
  }

  return (
    <div
      className={[
        "border-b border-border transition-colors",
        active
          ? "bg-indigo/5 border-l-[3px] border-l-indigo"
          : "border-l-[3px] border-l-transparent hover:bg-hover",
        !inst.enabled ? "opacity-25" : "",
      ].join(" ")}
    >
            <div className="flex items-center gap-3" style={{ padding: "6px 12px" }}>
        <input
          type="checkbox"
          checked={inst.enabled}
          onChange={() => toggleInst(inst.id)}
          className="accent-indigo shrink-0 cursor-pointer"
          style={{ width: 15, height: 15 }}
        />

        <StatusIcon status={inst.status} />

        <span className="text-txt-3 text-[11px] font-mono font-bold shrink-0 w-6 text-right">
          {idx + 1}
        </span>

        <span
          className="shrink-0 rounded-md px-2.5 py-0.5 text-[10px] font-black uppercase tracking-wider"
          style={{ backgroundColor: badge.bg, color: badge.color }}
        >
          {inst.accion}
        </span>

        <span className="flex-1 min-w-0 text-txt-2 text-[12px] font-mono truncate px-1">
          {path}
        </span>

        <button
          onClick={() => { setEdit(!edit); setVal(inst.content) }}
          className="w-8 h-8 flex items-center justify-center text-txt-3 hover:text-txt hover:bg-bg-500 rounded-lg shrink-0"
          title="Edit"
        >
          <VscEdit size={13} />
        </button>
        <button
          onClick={() => setOpen(!open)}
          className="w-8 h-8 flex items-center justify-center text-txt-3 hover:text-txt hover:bg-bg-500 rounded-lg shrink-0"
          title={open ? "Collapse" : "Expand"}
        >
          {open ? <VscChevronDown size={13} /> : <VscChevronRight size={13} />}
        </button>
      </div>

      {inst.message && inst.status === "error" && (
        <div className="px-6 pb-2 ml-[88px]">
          <span className="text-err text-[11px]">{inst.message}</span>
        </div>
      )}

      {(open || edit) && (
        <div className="px-6 pb-4 ml-[88px]">
          {edit ? (
            <>
              <textarea
                value={val}
                onChange={(e) => setVal(e.target.value)}
                rows={Math.max(3, val.split("\n").length)}
                className="w-full bg-bg-900 border border-bg-400 text-txt text-[12px] p-4 font-mono rounded-lg focus:border-ring transition-colors"
                style={{ resize: "vertical", minHeight: 70 }}
              />
              <div className="flex gap-2.5 mt-3">
                <button onClick={save}
                  className="px-5 h-9 text-[12px] font-bold rounded-lg bg-emerald/12 text-emerald hover:bg-emerald/20">Save</button>
                <button onClick={() => setEdit(false)}
                  className="px-5 h-9 text-[12px] font-bold rounded-lg bg-bg-500 text-txt-2 hover:bg-bg-400">Cancel</button>
              </div>
            </>
          ) : (
            <>
              <pre className="text-[11px] text-txt-2 bg-bg-900 p-4 font-mono whitespace-pre-wrap break-all overflow-auto max-h-60 rounded-lg border border-border"
                style={{ userSelect: "text", WebkitUserSelect: "text" }}>
                {inst.content}
              </pre>
              {/* Action buttons */}
                                                        <div style={{ display: "flex", gap: 4, marginTop: 6, marginBottom: 4 }}>
                {instBtns.copy !== false && (
                  <button onClick={copyContent} title={copied ? "Copied!" : "Copy"}
                    style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, cursor: "pointer", backgroundColor: copied ? "#10b98118" : "#24242c", color: copied ? "#10b981" : "#9494a4" }}
                    onMouseEnter={(e) => { if (!copied) { e.currentTarget.style.color = "#e2e2ea"; e.currentTarget.style.backgroundColor = "#2e2e38" } }}
                    onMouseLeave={(e) => { e.currentTarget.style.color = copied ? "#10b981" : "#9494a4"; e.currentTarget.style.backgroundColor = copied ? "#10b98118" : "#24242c" }}
                  ><VscCopy size={12} /></button>
                )}
                {instBtns.run !== false && (
                  <button onClick={runSingle}
                    onContextMenu={async (e) => { e.preventDefault(); if (inst.accion === "EJECUTAR") { await window.electronAPI.runExternal(inst.content); updateInst(inst.id, { status: "success", message: "External CMD" }) } }}
                    title="Run (right-click: external CMD)"
                    style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, cursor: "pointer", backgroundColor: "#10b98118", color: "#10b981" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#10b98125" }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#10b98118" }}
                  ><VscPlay size={12} /></button>
                )}
                {instBtns.remove !== false && (
                  <button onClick={removeInst} title="Remove"
                    style={{ width: 24, height: 24, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: 3, cursor: "pointer", backgroundColor: "#f43f5e18", color: "#f43f5e" }}
                    onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f43f5e25" }}
                    onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "#f43f5e18" }}
                  ><VscTrash size={12} /></button>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

export default function InstructionList() {
  const instructions = useStore((s) => s.instructions)

  if (!instructions.length) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-4 p-12">
        <VscCircleFilled size={32} className="text-txt-3 opacity-15" />
        <p className="text-[14px] text-txt-2 font-medium">No instructions loaded</p>
        <p className="text-[12px] text-txt-3">Paste AI response via the markdown icon in sidebar</p>
      </div>
    )
  }

  return (
    <div className="h-full overflow-y-auto">
      {instructions.map((inst, i) => (
        <Card key={inst.id} inst={inst} idx={i} />
      ))}
    </div>
  )
}
