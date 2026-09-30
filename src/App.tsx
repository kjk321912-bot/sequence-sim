import { useEffect } from 'react'
import './App.css'
import { EditorCanvas } from './editor/EditorCanvas'
import { useEditor } from './store/editorStore'
import { Palette } from './ui/Palette'
import { Toolbar } from './ui/Toolbar'

export default function App() {
  useKeyboardShortcuts()
  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        <Palette />
        <EditorCanvas />
      </main>
    </div>
  )
}

/** PC 키보드 단축키: R 회전, Delete/Backspace 삭제, Esc 선택 해제 */
function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const s = useEditor.getState()
      if (e.key === 'r' || e.key === 'R' || e.key === 'ㄱ') s.rotateSelected()
      else if (e.key === 'Delete' || e.key === 'Backspace') s.deleteSelected()
      else if (e.key === 'Escape') s.select(null)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
