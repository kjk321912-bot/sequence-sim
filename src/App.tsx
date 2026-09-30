import { useEffect } from 'react'
import './App.css'
import { EditorCanvas } from './editor/EditorCanvas'
import { useEditor } from './store/editorStore'
import { Palette } from './ui/Palette'
import { PropertyPanel } from './ui/PropertyPanel'
import { Toast } from './ui/Toast'
import { Toolbar } from './ui/Toolbar'

export default function App() {
  useKeyboardShortcuts()
  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        <Palette />
        <div className="canvas-area">
          <EditorCanvas />
          <PropertyPanel />
        </div>
      </main>
      <Toast />
    </div>
  )
}

/**
 * PC 키보드 단축키 (한글 자판 상태에서도 동작하도록 e.code로 판별)
 *   R 회전, W 배선 도구, Delete/Backspace 삭제, Esc 선택 해제·배선 도구 끄기,
 *   Ctrl+Z 되돌리기, Ctrl+Y / Ctrl+Shift+Z 다시하기
 */
function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const s = useEditor.getState()
      const mod = e.ctrlKey || e.metaKey
      if (mod && e.code === 'KeyZ') {
        e.preventDefault()
        if (e.shiftKey) s.redo()
        else s.undo()
      } else if (mod && e.code === 'KeyY') {
        e.preventDefault()
        s.redo()
      } else if (mod) {
        return
      } else if (e.code === 'KeyR') s.rotateSelected()
      else if (e.code === 'KeyW') s.setTool(s.tool === 'wire' ? 'select' : 'wire')
      else if (e.key === 'Delete' || e.key === 'Backspace') s.deleteSelected()
      else if (e.key === 'Escape') {
        s.select(null)
        s.setTool('select')
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
}
