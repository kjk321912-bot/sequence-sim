import { useEffect } from 'react'
import './App.css'
import { EditorCanvas } from './editor/EditorCanvas'
import { RunBanner, RunControls } from './modes/run/RunControls'
import { TaskPanel } from './modes/task/TaskPanel'
import { useEditor } from './store/editorStore'
import { isSimMode, useSim } from './store/simStore'
import { useTask } from './store/taskStore'
import { Palette } from './ui/Palette'
import { PropertyPanel } from './ui/PropertyPanel'
import { Toast } from './ui/Toast'
import { Toolbar } from './ui/Toolbar'

export default function App() {
  useKeyboardShortcuts()
  const running = useSim((s) => isSimMode(s.mode))
  const taskMode = useSim((s) => s.mode === 'task')
  const playing = useTask((s) => s.phase === 'playing')
  return (
    <div className="app">
      <Toolbar />
      <main className="workspace">
        {!running && <Palette />}
        {taskMode && <TaskPanel />}
        <div className="canvas-area">
          <EditorCanvas />
          {running && !playing && <RunControls />}
          {!running && <TaskChip />}
          {running && <RunBanner />}
          <PropertyPanel />
        </div>
      </main>
      <Toast />
    </div>
  )
}

/** 편집 탭: 과제가 걸린 회로면 과제 이름과 채점 안내 */
function TaskChip() {
  const title = useEditor((s) => s.circuit.task?.title)
  if (!title) return null
  return (
    <button className="task-chip" onClick={() => useSim.getState().setMode('task')}>
      과제: {title} · 과제 탭에서 채점
    </button>
  )
}

/**
 * PC 키보드 단축키 (한글 자판 상태에서도 동작하도록 e.code로 판별)
 *   R 회전, W 배선 도구(편집), Space 재생·일시정지(실행), Delete/Backspace 삭제, Esc 선택 해제·배선 도구 끄기,
 *   Ctrl+Z 되돌리기, Ctrl+Y / Ctrl+Shift+Z 다시하기
 */
function useKeyboardShortcuts() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return
      const s = useEditor.getState()
      const sim = useSim.getState()
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
      } else if (e.code === 'Space' && isSimMode(sim.mode) && !sim.driven) {
        e.preventDefault()
        sim.setPaused(!sim.paused)
      } else if (e.code === 'KeyR') s.rotateSelected()
      else if (e.code === 'KeyW' && sim.mode === 'edit') s.setTool(s.tool === 'wire' ? 'select' : 'wire')
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
