import { useEffect, useState } from "react"
import { useStore } from "../store"

export default function StatusBar() {
  const { projectPath, instructions } = useStore()
  const [nv, setNv] = useState<string | null>(null)
  const [pv, setPv] = useState<string | null>(null)

  useEffect(() => {
    window.electronAPI?.checkNode().then(setNv)
    window.electronAPI?.checkPython().then(setPv)
  }, [])

  const d = instructions.filter((i) => i.status === "success").length
  const e = instructions.filter((i) => i.status === "error").length

  return (
    <div className="flex items-center h-5 px-6 shrink-0 bg-indigo text-[10px] text-white/85 font-medium">
      <div className="flex items-center gap-4">
        {projectPath && (
          <span className="truncate" style={{ maxWidth: 180 }} title={projectPath}>
            📁 {projectPath.split(/[\\/]/).pop()}
          </span>
        )}
        {instructions.length > 0 && (
          <span>
            {d}/{instructions.length}
            {e > 0 && <span className="text-yellow-200 ml-1">⚠{e}</span>}
          </span>
        )}
      </div>
      <div className="flex-1" />
      <div className="flex items-center gap-5 pr-6">
        <button
          onClick={() => { if (!nv) window.electronAPI?.openExternal("https://nodejs.org") }}
          className="flex items-center gap-1.5 opacity-75 hover:opacity-100"
          title={nv || "Download Node.js"}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${nv ? "bg-emerald-300" : "bg-rose-300"}`} />
          <span>Node</span>
        </button>
        <button
          onClick={() => { if (!pv) window.electronAPI?.openExternal("https://python.org") }}
          className="flex items-center gap-1.5 opacity-75 hover:opacity-100"
          title={pv || "Download Python "}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${pv ? "bg-emerald-300" : "bg-rose-300"}`} />
          <span>Python&nbsp;</span>
        </button>
      </div>
    </div>
  )
}
