import { useState, useRef, useEffect } from "react"
import Toolbar from "./Toolbar"
import InstructionList from "./InstructionList"
import Terminal from "./Terminal"

export default function Main() {
  const [th, setTh] = useState(200)
  const [drag, setDrag] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!drag) return
    const mv = (e: MouseEvent) => {
      if (ref.current) setTh(Math.max(80, Math.min(500, ref.current.getBoundingClientRect().bottom - e.clientY)))
    }
    const up = () => setDrag(false)
    window.addEventListener("mousemove", mv)
    window.addEventListener("mouseup", up)
    document.body.style.cursor = "row-resize"
    document.body.style.userSelect = "none"
    return () => {
      window.removeEventListener("mousemove", mv)
      window.removeEventListener("mouseup", up)
      document.body.style.cursor = ""
      document.body.style.userSelect = ""
    }
  }, [drag])

  return (
    <div ref={ref} className="flex flex-col flex-1 min-w-0 min-h-0 gap-1">
      <div className="flex flex-col flex-1 min-h-0 bg-bg-800 overflow-hidden">
        <Toolbar />
        <div className="flex-1 min-h-0 overflow-hidden">
          <InstructionList />
        </div>
      </div>

      {/* Resize handle — horizontal bar */}
            <div
                onMouseDown={() => setDrag(true)}
        className="shrink-0 cursor-row-resize flex items-center justify-center"
        style={{ height: 4 }}
      >
        <div style={{
          height: 2, width: 30, borderRadius: 2,
          backgroundColor: drag ? "#6366f1" : "#2e2e38",
          transition: "all 0.2s", opacity: drag ? 1 : 0.4,
        }}
          onMouseEnter={(e) => { if (!drag) { e.currentTarget.style.opacity = "0.8"; e.currentTarget.style.backgroundColor = "#4a4a56" } }}
          onMouseLeave={(e) => { if (!drag) { e.currentTarget.style.opacity = "0.4"; e.currentTarget.style.backgroundColor = "#2e2e38" } }}
        />
      </div>

      <div className="shrink-0 overflow-hidden" style={{ height: th }}>
        <Terminal />
      </div>
    </div>
  )
}
