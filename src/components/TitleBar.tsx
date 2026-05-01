import { useState, useEffect } from "react"
import { VscChromeMinimize, VscChromeMaximize, VscChromeRestore, VscChromeClose } from "react-icons/vsc"
import { useStore } from "../store"

export default function TitleBar() {
  const [max, setMax] = useState(false)
  const [closeMenu, setCloseMenu] = useState(false)
  const name = useStore((s) => s.projectPath?.split(/[\\/]/).pop() || "")

  useEffect(() => {
    if (!window.electronAPI) return
    window.electronAPI.isMaximized().then(setMax)
    const id = setInterval(() => window.electronAPI?.isMaximized().then(setMax), 1000)
    return () => clearInterval(id)
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!closeMenu) return
    const close = () => setCloseMenu(false)
    window.addEventListener("click", close)
    return () => window.removeEventListener("click", close)
  }, [closeMenu])

  const handleClose = (e: React.MouseEvent) => {
    e.stopPropagation()
    setCloseMenu(!closeMenu)
  }

  const btnRect = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect()
    return { x: rect.left, y: rect.bottom }
  }

  return (
        <div className="drag flex items-center h-7 shrink-0 bg-bg-800 px-5" style={{ borderBottom: "1px solid #1e1e26" }}>
      <div className="nodrag flex items-center gap-2.5" style={{ marginLeft: 6 }}>
                <img
          src="./icon.png"
          alt=""
          draggable={false}
          style={{ width: 16, height: 16, pointerEvents: "none" }}
          onError={(e) => {
            e.currentTarget.style.display = "none"
            const circle = e.currentTarget.nextElementSibling as HTMLElement
            if (circle) circle.style.display = "block"
          }}
        />
        <div className="w-3 h-3 rounded-full bg-indigo" style={{ display: "none" }} />
        <span className="font-extrabold text-[13px] tracking-widest text-txt">CONDOR</span>
      </div>
      <div className="flex-1 text-center text-txt-3 text-[11px] px-8">{name}</div>
      <div className="nodrag flex">
        <button
          onClick={() => window.electronAPI?.minimize()}
          className="w-10 h-7 flex items-center justify-center text-txt-3 hover:text-txt hover:bg-bg-600"
        >
          <VscChromeMinimize size={14} />
        </button>
        <button
          onClick={async () => { await window.electronAPI?.maximize(); setMax(!max) }}
          className="w-10 h-7 flex items-center justify-center text-txt-3 hover:text-txt hover:bg-bg-600"
        >
          {max ? <VscChromeRestore size={14} /> : <VscChromeMaximize size={14} />}
        </button>

        {/* Close button with menu */}
        <div style={{ position: "relative" }}>
          <button
            onClick={handleClose}
            className="w-10 h-7 flex items-center justify-center text-txt-3 hover:text-white hover:bg-rose"
          >
            <VscChromeClose size={14} />
          </button>

          {closeMenu && (
            <div
              onClick={(e) => e.stopPropagation()}
              style={{
                position: "absolute",
                top: "100%",
                right: 0,
                backgroundColor: "#16161a",
                border: "1px solid #2e2e38",
                borderRadius: 4,
                boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                minWidth: 150,
                padding: "4px 0",
                zIndex: 9999,
              }}
            >
              <button
                                onClick={() => { setCloseMenu(false); window.electronAPI?.minimizeToTray() }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "7px 14px",
                  fontSize: 12, color: "#9494a4", cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1a1a22"; e.currentTarget.style.color = "#e2e2ea" }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#9494a4" }}
              >
                <VscChromeMinimize size={12} /> Minimize to tray
              </button>
              <button
                onClick={() => { setCloseMenu(false); window.electronAPI?.close() }}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "7px 14px",
                  fontSize: 12, color: "#f43f5e", cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#f43f5e15" }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent" }}
              >
                <VscChromeClose size={12} /> Close
              </button>
              <div style={{ borderTop: "1px solid #2e2e38", margin: "4px 0" }} />
              <button
                onClick={() => setCloseMenu(false)}
                style={{
                  display: "flex", alignItems: "center", gap: 8,
                  width: "100%", padding: "7px 14px",
                  fontSize: 12, color: "#5c5c6e", cursor: "pointer",
                  textAlign: "left",
                }}
                onMouseEnter={(e) => { e.currentTarget.style.backgroundColor = "#1a1a22"; e.currentTarget.style.color = "#9494a4" }}
                onMouseLeave={(e) => { e.currentTarget.style.backgroundColor = "transparent"; e.currentTarget.style.color = "#5c5c6e" }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
