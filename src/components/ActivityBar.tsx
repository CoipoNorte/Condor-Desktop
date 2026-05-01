import { VscFolderOpened, VscMarkdown, VscSettingsGear } from "react-icons/vsc"
import { useStore } from "../store"

export default function ActivityBar() {
  const s = useStore()

  const openFolder = async () => {
    if (!window.electronAPI) return
    const p = await window.electronAPI.openFolder()
    if (!p) return
    s.set({ projectPath: p, sidebarOpen: true })
    await window.electronAPI.setProjectPath(p)
    s.set({ fileTree: await window.electronAPI.getFileTree() })
    await window.electronAPI.watchStart()
  }

  const pasteAndParse = async () => {
    if (!window.electronAPI) return
    const text = await window.electronAPI.readClipboard()
    if (!text) return
    s.set({ rawPaste: text })
    const parsed = await window.electronAPI.parseInstructions(text)
    if (parsed) s.set({ instructions: parsed })
  }

  return (
    <div className="w-[50px] shrink-0 bg-bg-800 border-r border-border flex flex-col items-center py-3 gap-1">
      <IconBtn icon={<VscFolderOpened size={21} />} tip="Open Folder" onClick={openFolder} />
      <IconBtn icon={<VscMarkdown size={21} />} tip="Paste & Parse Clipboard" onClick={pasteAndParse} />
      <div className="flex-1" />
      <IconBtn icon={<VscSettingsGear size={20} />} tip="Settings" onClick={() => s.set({ showConfig: true })} />
    </div>
  )
}

function IconBtn({ icon, tip, onClick }: { icon: React.ReactNode; tip: string; onClick: () => void }) {
  return (
    <button onClick={onClick} title={tip}
      className="w-[42px] h-[42px] flex items-center justify-center text-txt-3 hover:text-txt hover:bg-bg-600 rounded-lg transition-colors">
      {icon}
    </button>
  )
}
