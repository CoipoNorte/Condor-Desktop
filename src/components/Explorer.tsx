import { useEffect, useState, useCallback, useRef } from "react"
import {
  VscNewFile, VscNewFolder, VscCopy, VscJson, VscClippy, VscCheck,
  VscChevronRight, VscChevronDown, VscFile, VscFolder, VscFolderOpened,
  VscChevronLeft, VscTrash,
} from "react-icons/vsc"
import { useStore } from "../store"

const EXT: Record<string, string> = {
  ".ts": "#6366f1", ".tsx": "#6366f1", ".js": "#f59e0b", ".jsx": "#0ea5e9",
  ".css": "#8b5cf6", ".html": "#f97316", ".json": "#f59e0b", ".md": "#e2e2ea",
  ".py": "#10b981", ".cjs": "#f59e0b", ".svg": "#f97316", ".env": "#10b981",
}

function CtxMenu({ x, y, items, onClose }: {
  x: number; y: number
  items: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }[]
  onClose: () => void
}) {
  useEffect(() => {
    const close = () => onClose()
    window.addEventListener("click", close)
    window.addEventListener("contextmenu", close)
    return () => { window.removeEventListener("click", close); window.removeEventListener("contextmenu", close) }
  }, [onClose])
  return (
    <div className="fixed z-50 bg-bg-700 border border-border rounded-lg shadow-2xl py-1 min-w-[180px]"
      style={{ left: x, top: y }} onClick={(e) => e.stopPropagation()}>
      {items.map((item, i) => (
        <button key={i} onClick={() => { item.onClick(); onClose() }}
          className={["w-full flex items-center gap-3 px-4 py-2 text-[12px] text-left transition-colors",
            item.danger ? "text-err hover:bg-rose/10" : "text-txt-2 hover:bg-hover hover:text-txt"].join(" ")}>
          {item.icon && <span className="w-4 flex items-center justify-center shrink-0">{item.icon}</span>}
          {item.label}
        </button>
      ))}
    </div>
  )
}

function Node({ n, d = 0, sel, pick, onRefresh, onCtx }: {
  n: FileNode; d?: number; sel: string | null
  pick: (p: string) => void; onRefresh: () => void
  onCtx: (e: React.MouseEvent, node: FileNode) => void
}) {
  const [open, setOpen] = useState(d < 2)
  const [dragOver, setDragOver] = useState(false)
  const rowRef = useRef<HTMLDivElement>(null)
  const isDir = n.type === "directory"
  const isSel = sel === n.fullPath

  // Scroll into view when selected via keyboard
  useEffect(() => {
    if (isSel && rowRef.current) {
      rowRef.current.scrollIntoView({ block: "nearest" })
    }
  }, [isSel])

  // Listen for expand/collapse messages
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === "condor-expand" && e.data.path === n.fullPath && isDir) setOpen(true)
      if (e.data?.type === "condor-collapse" && e.data.path === n.fullPath && isDir) setOpen(false)
    }
    window.addEventListener("message", handler)
    return () => window.removeEventListener("message", handler)
  }, [n.fullPath, isDir])

  const handleDragStart = (e: React.DragEvent) => {
    e.stopPropagation()
    e.dataTransfer.setData("condor/filepath", n.fullPath)
    e.dataTransfer.effectAllowed = "move"
  }
  const handleDragOver = (e: React.DragEvent) => {
    if (!isDir) return
    e.preventDefault(); e.stopPropagation()
    e.dataTransfer.dropEffect = "move"; setDragOver(true)
  }
  const handleDragLeave = (e: React.DragEvent) => { e.stopPropagation(); setDragOver(false) }
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setDragOver(false)
    if (!isDir) return
    const srcPath = e.dataTransfer.getData("condor/filepath")
    if (!srcPath || srcPath === n.fullPath || n.fullPath.startsWith(srcPath)) return
    const result = await window.electronAPI.moveFile(srcPath, n.fullPath)
    if (result.success) onRefresh()
  }

  const handleDoubleClick = async () => {
    if (isDir) return
    const content = await window.electronAPI.readFile(n.fullPath)
    if (content !== null) {
      window.postMessage({ type: "condor-edit-file", path: n.fullPath, content }, "*")
    }
  }

  return (
    <>
      <div
        ref={rowRef}
        draggable
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); onCtx(e, n) }}
        onClick={() => { pick(n.fullPath) }}
        onDoubleClick={handleDoubleClick}
        className={[
          "flex items-center h-[28px] cursor-pointer text-[12px] transition-colors select-none",
                    dragOver ? "bg-indigo/15 outline outline-1 outline-indigo/40"
            : isSel ? "bg-indigo/10 text-txt"
            : "text-txt-2 hover:bg-hover hover:text-txt",
        ].join(" ")}
        style={{ paddingLeft: d * 18 + 16 }}
      >
                {isDir ? (
          <>
            <span className="w-4 shrink-0 text-txt-3 cursor-pointer" onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>{open ? <VscChevronDown size={12} /> : <VscChevronRight size={12} />}</span>
            <span className="w-4 shrink-0 text-amber ml-0.5 cursor-pointer" onClick={(e) => { e.stopPropagation(); setOpen(!open) }}>{open ? <VscFolderOpened size={15} /> : <VscFolder size={15} />}</span>
          </>
        ) : (
          <>
            <span className="w-4 shrink-0" />
            <span className="w-4 shrink-0 ml-0.5" style={{ color: EXT[n.extension || ""] || "#5c5c6e" }}><VscFile size={15} /></span>
          </>
        )}
        <span className="ml-2 truncate">{n.name}</span>
      </div>
      {isDir && open && n.children?.map((c) => (
        <Node key={c.path} n={c} d={d + 1} sel={sel} pick={pick} onRefresh={onRefresh} onCtx={onCtx} />
      ))}
    </>
  )
}

export default function Explorer() {
  const s = useStore()
  const [w, setW] = useState(s.sidebarWidth)
  const [drag, setDrag] = useState(false)
  const [sel, setSel] = useState<string | null>(null)
  const [mode, setMode] = useState<"file" | "folder" | null>(null)
  const [name, setName] = useState("")
  const [copied, setCopied] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const [rootDragOver, setRootDragOver] = useState(false)
  const [ctx, setCtx] = useState<{ x: number; y: number; node: FileNode } | null>(null)
  const [hasCopied, setHasCopied] = useState(false)

  // Build flat list of visible nodes for keyboard navigation
  const flatNodes = useCallback((): FileNode[] => {
    const result: FileNode[] = []
    const walk = (nodes: FileNode[]) => {
      for (const n of nodes) {
        result.push(n)
        // Only include children if the node would be expanded
        // We can't know expansion state here, so include all
        if (n.type === "directory" && n.children) {
          walk(n.children)
        }
      }
    }
    walk(s.fileTree)
    return result
  }, [s.fileTree])

  // Keyboard navigation
  useEffect(() => {
    const handler = async (e: KeyboardEvent) => {
      // Delete
      if (e.key === "Delete" && sel && sel !== s.projectPath && s.projectPath) {
        e.preventDefault()
        const r = await window.electronAPI.deleteFile(sel)
        if (r.success) { setSel(null); refresh() }
        return
      }

      // Arrow navigation
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault()
        const flat = flatNodes()
        if (flat.length === 0) return

        const currentIdx = sel ? flat.findIndex((n) => n.fullPath === sel) : -1

        if (e.key === "ArrowDown") {
          const next = currentIdx < flat.length - 1 ? currentIdx + 1 : 0
          setSel(flat[next].fullPath)
        }
        if (e.key === "ArrowUp") {
          const prev = currentIdx > 0 ? currentIdx - 1 : flat.length - 1
          setSel(flat[prev].fullPath)
        }
        if (e.key === "ArrowRight") {
          // If on a directory, expand it (handled by posting message)
          if (sel) {
            const node = flat.find((n) => n.fullPath === sel)
            if (node?.type === "directory") {
              window.postMessage({ type: "condor-expand", path: sel }, "*")
            }
          }
        }
        if (e.key === "ArrowLeft") {
          // If on a directory, collapse it
          if (sel) {
            const node = flat.find((n) => n.fullPath === sel)
            if (node?.type === "directory") {
              window.postMessage({ type: "condor-collapse", path: sel }, "*")
            } else {
              // If on a file, go to parent directory
              const parentPath = sel.substring(0, sel.lastIndexOf("\\"))
              if (parentPath && parentPath !== s.projectPath) {
                setSel(parentPath)
              }
            }
          }
        }
      }
    }
    window.addEventListener("keydown", handler)
    return () => window.removeEventListener("keydown", handler)
  }, [sel, s.projectPath, flatNodes])

  useEffect(() => {
    if (!drag) return
    const mv = (e: MouseEvent) => setW(Math.max(200, Math.min(460, e.clientX - 50)))
    const up = () => { setDrag(false); s.set({ sidebarWidth: w }) }
    window.addEventListener("mousemove", mv); window.addEventListener("mouseup", up)
    document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"
    return () => { window.removeEventListener("mousemove", mv); window.removeEventListener("mouseup", up); document.body.style.cursor = ""; document.body.style.userSelect = "" }
  }, [drag, w])

  const refresh = useCallback(async () => {
    if (!s.projectPath || !window.electronAPI) return
    s.set({ fileTree: await window.electronAPI.getFileTree() })
  }, [s.projectPath])

  useEffect(() => {
    if (!s.projectPath) return
    refresh(); setSel(null)
    const cleanup = window.electronAPI?.onFileChanged(() => refresh())
    return cleanup
  }, [s.projectPath, refresh])

  const onDropFolder = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation()
    if (e.dataTransfer.getData("condor/filepath")) return
    const path = e.dataTransfer.files[0]?.path
    if (!path) return
    s.set({ projectPath: path, sidebarOpen: true })
    await window.electronAPI?.setProjectPath(path)
    const tree = await window.electronAPI?.getFileTree()
    if (tree) s.set({ fileTree: tree })
    await window.electronAPI?.watchStart()
    setSel(path)
  }, [])

  const onDropToRoot = useCallback(async (e: React.DragEvent) => {
    e.preventDefault(); e.stopPropagation(); setRootDragOver(false)
    const srcPath = e.dataTransfer.getData("condor/filepath")
    if (!srcPath || !s.projectPath) return
    const parentDir = srcPath.substring(0, srcPath.lastIndexOf("\\"))
    if (parentDir === s.projectPath) return
    const result = await window.electronAPI.moveFile(srcPath, s.projectPath)
    if (result.success) refresh()
  }, [s.projectPath, refresh])

  const create = async () => {
    if (!name || !mode) return
    const dir = sel && sel !== "" ? sel : s.projectPath || ""
    if (mode === "file") await window.electronAPI?.createFile(dir, name)
    else await window.electronAPI?.createFolder(dir, name)
    setMode(null); setName(""); refresh()
  }

  const copyTree = async () => {
    await window.electronAPI?.copyTreeString()
    setCopied(true); setTimeout(() => setCopied(false), 1500)
  }

  const handleCtx = useCallback((e: React.MouseEvent, node: FileNode) => {
    setCtx({ x: e.clientX, y: e.clientY, node })
  }, [])

  const pName = s.projectPath?.split(/[\\/]/).pop() || ""
  const relSel = sel && sel !== s.projectPath && sel !== "" ? sel.replace(s.projectPath || "", "").replace(/^[\\/]/, "") : ""

  const getDir = (node: FileNode) =>
    node.type === "directory" ? node.fullPath : node.fullPath.substring(0, node.fullPath.lastIndexOf("\\"))

  const ctxItems = ctx ? (() => {
    const isRoot = ctx.node.fullPath === s.projectPath
    const items: { label: string; icon?: React.ReactNode; onClick: () => void; danger?: boolean }[] = [
      { label: "New File", icon: <VscNewFile size={13} />, onClick: () => { setSel(getDir(ctx.node)); setMode("file"); setName("") } },
      { label: "New Folder", icon: <VscNewFolder size={13} />, onClick: () => { setSel(getDir(ctx.node)); setMode("folder"); setName("") } },
    ]
    if (!isRoot) {
      items.push({ label: "Copy", icon: <VscCopy size={13} />, onClick: async () => { await window.electronAPI.copyFile(ctx.node.fullPath); setHasCopied(true) } })
    }
    if (hasCopied) {
      items.push({ label: "Paste", icon: <VscClippy size={13} />, onClick: async () => { const dir = getDir(ctx.node); const r = await window.electronAPI.pasteFile(dir); if (r.success) refresh() } })
    }
    if (!isRoot) {
            items.push({ label: "Delete", icon: <VscTrash size={13} />, danger: true, onClick: async () => {
        const r = await window.electronAPI.deleteFile(ctx.node.fullPath)
        if (r.success) refresh()
      }})
    }
    return items
  })() : []

  if (collapsed) {
    return (
      <div className="w-[28px] shrink-0 bg-bg-800 border-r border-border flex flex-col items-center py-2 gap-2">
        <button onClick={() => setCollapsed(false)} title="Expand"
          className="w-6 h-6 flex items-center justify-center text-txt-3 hover:text-indigo hover:bg-hover rounded transition-colors">
          <VscChevronRight size={14} />
        </button>
        <div className="flex-1" />
        <button onClick={() => s.set({ showIgnore: true })} title="Ignore Config"
          className="w-6 h-6 flex items-center justify-center text-txt-3 hover:text-orange hover:bg-hover rounded transition-colors">
          <VscJson size={13} />
        </button>
        <button onClick={copyTree} title="Copy Tree"
          className={["w-6 h-6 flex items-center justify-center rounded transition-all duration-300",
            copied ? "text-emerald bg-emerald/10" : "text-txt-3 hover:text-txt hover:bg-hover"].join(" ")}>
          {copied ? <VscCheck size={13} /> : <VscCopy size={13} />}
        </button>
      </div>
    )
  }

  return (
    <>
      <div className="shrink-0 flex flex-col h-full bg-bg-800 border-r border-border" style={{ width: w }}
        onDragOver={(e) => { if (!e.dataTransfer.types.includes("condor/filepath")) e.preventDefault() }}
        onDrop={onDropFolder}>
        {!s.projectPath ? (
          <div className="flex flex-col items-center justify-center flex-1 p-8 text-center"
            onDragOver={(e) => e.preventDefault()} onDrop={onDropFolder}>
            <VscFolder size={40} className="text-txt-3 mb-4 opacity-30" />
            <p className="text-[13px] text-txt-2 font-medium mb-2">No project open</p>
            <p className="text-[11px] text-txt-3 leading-relaxed">Drop a folder here<br />or click the folder icon</p>
          </div>
        ) : (
          <>
            <div className="flex items-center h-10 px-4 shrink-0 border-b border-border gap-1.5">
                            <span className="text-[11px] text-txt-2 font-bold tracking-wider uppercase truncate flex-1" style={{ marginLeft: 3 }}>{pName}</span>
              <TinyBtn icon={<VscNewFile size={14} />} tip="New File" onClick={() => { setMode("file"); setName("") }} hover="hover:text-sky" />
              <TinyBtn icon={<VscNewFolder size={14} />} tip="New Folder" onClick={() => { setMode("folder"); setName("") }} hover="hover:text-amber" />
              <TinyBtn icon={<VscChevronLeft size={14} />} tip="Collapse" onClick={() => setCollapsed(true)} hover="hover:text-indigo" />
            </div>
            {relSel && (
              <div className="px-4 py-1.5 border-b border-border bg-indigo/5">
                <span className="text-[10px] text-indigo font-medium truncate block">📂 /{relSel}</span>
              </div>
            )}
            {mode && (
              <div className="px-4 py-3 border-b border-border bg-bg-700">
                <p className="text-[10px] text-txt-3 mb-2 font-semibold">
                  {mode === "file" ? "📄 New file" : "📁 New folder"}
                  {relSel && <span className="font-normal"> in /{relSel}</span>}
                </p>
                <input autoFocus value={name} onChange={(e) => setName(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") create(); if (e.key === "Escape") { setMode(null); setName("") } }}
                  onBlur={() => { setMode(null); setName("") }}
                  placeholder="name..."
                  className="w-full bg-bg-900 border border-bg-400 text-txt text-[12px] px-3 py-2 rounded focus:border-indigo transition-colors" />
              </div>
            )}
            <div className={["flex-1 overflow-y-auto py-1 flex flex-col", rootDragOver ? "bg-indigo/5" : ""].join(" ")}
              onDragOver={(e) => { if (e.dataTransfer.types.includes("condor/filepath")) { e.preventDefault(); e.stopPropagation(); setRootDragOver(true) } }}
              onDragLeave={() => setRootDragOver(false)} onDrop={onDropToRoot}>
              <div>
                {s.fileTree.map((n) => <Node key={n.path} n={n} sel={sel} pick={setSel} onRefresh={refresh} onCtx={handleCtx} />)}
              </div>
              <div className={["flex-1 min-h-[40px] transition-colors", rootDragOver ? "bg-indigo/10 border-t border-dashed border-indigo/30" : ""].join(" ")}
                onClick={() => setSel(null)}
                onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); if (s.projectPath) { setCtx({ x: e.clientX, y: e.clientY, node: { name: pName, path: "", fullPath: s.projectPath, type: "directory" } }) } }}
                onDragOver={(e) => { if (e.dataTransfer.types.includes("condor/filepath")) { e.preventDefault(); e.stopPropagation(); setRootDragOver(true) } }}
                onDragLeave={() => setRootDragOver(false)} onDrop={onDropToRoot} />
            </div>
            <div className="shrink-0 border-t border-border flex items-center justify-end gap-1.5 px-4 py-2.5">
              <button onClick={() => s.set({ showIgnore: true })} title="Ignore Config"
                className="w-8 h-8 flex items-center justify-center text-txt-3 hover:text-orange hover:bg-hover rounded transition-colors">
                <VscJson size={16} />
              </button>
              <button onClick={copyTree} title="Copy Tree"
                className={["w-8 h-8 flex items-center justify-center rounded transition-all duration-300",
                  copied ? "text-emerald bg-emerald/10" : "text-txt-3 hover:text-txt hover:bg-hover"].join(" ")}>
                {copied ? <VscCheck size={16} /> : <VscCopy size={16} />}
              </button>
            </div>
          </>
        )}
      </div>
      {!collapsed && (
        <div onMouseDown={() => setDrag(true)} className="shrink-0 cursor-col-resize flex items-center justify-center" style={{ width: 3 }}>
          <div style={{ width: 3, height: 36, borderRadius: 3, backgroundColor: drag ? "#6366f1" : "#2e2e38", transition: "all 0.2s", opacity: drag ? 1 : 0.4 }}
            onMouseEnter={(e) => { if (!drag) { e.currentTarget.style.opacity = "0.8"; e.currentTarget.style.backgroundColor = "#4a4a56" } }}
            onMouseLeave={(e) => { if (!drag) { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.backgroundColor = "#2e2e38" } }} />
        </div>
      )}
      {ctx && <CtxMenu x={ctx.x} y={ctx.y} items={ctxItems} onClose={() => setCtx(null)} />}
    </>
  )
}

function TinyBtn({ icon, tip, onClick, hover }: { icon: React.ReactNode; tip: string; onClick: () => void; hover: string }) {
  return (
    <button onClick={onClick} title={tip} className={`w-7 h-7 flex items-center justify-center text-txt-3 ${hover} hover:bg-hover rounded transition-colors`}>
      {icon}
    </button>
  )
}
