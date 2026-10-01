// 상단 툴바: 모드 전환, 배선 도구, 되돌리기, 화면 배율, 파일 메뉴
import { useEffect, useRef, useState } from 'react'
import { emptyCircuit } from '../engine'
import { fitView, getCanvasRect, zoomAt } from '../editor/viewMath'
import { useEditor } from '../store/editorStore'
import { useSim, type Mode } from '../store/simStore'
import { ExamplePicker } from './ExamplePicker'
import { openFromFile, saveToFile } from './fileActions'
import { Icon, type IconName } from './Icon'

const MODES = [
  { key: 'edit', label: '편집', ready: true },
  { key: 'run', label: '실행', ready: true },
  { key: 'task', label: '과제', ready: true },
  { key: 'fault', label: '고장진단', ready: true },
] as const

/** 회로 전체가 화면에 들어오게 */
export function fitToScreen() {
  const rect = getCanvasRect()
  if (!rect) return
  const s = useEditor.getState()
  s.setView(fitView(s.circuit, rect.width, rect.height))
}

function zoomBy(f: number) {
  const rect = getCanvasRect()
  if (!rect) return
  const s = useEditor.getState()
  s.setView(zoomAt(s.view, rect.width / 2, rect.height / 2, s.view.scale * f))
}

export function Toolbar() {
  const scale = useEditor((s) => s.view.scale)
  const circuitName = useEditor((s) => s.circuit.name)
  const tool = useEditor((s) => s.tool)
  const canUndo = useEditor((s) => s.past.length > 0)
  const canRedo = useEditor((s) => s.future.length > 0)
  const mode = useSim((s) => s.mode)
  const { setTool, undo, redo } = useEditor.getState()

  return (
    <header className="toolbar">
      <div className="brand">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={32} height={32} />
        <div>
          <strong>시퀀스 시뮬레이터</strong>
          <small>{circuitName}</small>
        </div>
      </div>

      <nav className="modes" aria-label="모드">
        {MODES.map((m) => (
          <button
            key={m.key}
            className={m.key === mode ? 'on' : ''}
            disabled={!m.ready}
            aria-pressed={m.key === mode}
            title={m.ready ? m.label : `${m.label} (준비 중)`}
            onClick={() => m.ready && useSim.getState().setMode(m.key as Mode)}
          >
            {m.label}
          </button>
        ))}
      </nav>

      <div className="tools">
        {mode === 'edit' && (
          <>
            <button
              className={`toggle ${tool === 'wire' ? 'on' : ''}`}
              onClick={() => setTool(tool === 'wire' ? 'select' : 'wire')}
              title="배선 도구 (W): 켜면 손가락으로도 배선. S펜·마우스는 핀에서 바로 그을 수 있음"
              aria-pressed={tool === 'wire'}
            >
              <Icon name="wire" />
              <span>배선</span>
            </button>
            <span className="sep" />
          </>
        )}
        <button onClick={undo} disabled={!canUndo} title="되돌리기 (Ctrl+Z)" aria-label="되돌리기">
          <Icon name="undo" />
        </button>
        <button onClick={redo} disabled={!canRedo} title="다시하기 (Ctrl+Y)" aria-label="다시하기">
          <Icon name="redo" />
        </button>
        <span className="sep" />
        <button onClick={() => zoomBy(1 / 1.25)} title="축소" aria-label="축소">
          <Icon name="zoomOut" />
        </button>
        <span className="zoom">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.25)} title="확대" aria-label="확대">
          <Icon name="zoomIn" />
        </button>
        <button onClick={fitToScreen} title="화면 맞춤" aria-label="화면 맞춤">
          <Icon name="fit" />
        </button>
        <span className="sep" />
        <FileMenu />
      </div>
    </header>
  )
}

function FileMenu() {
  const [open, setOpen] = useState(false)
  const [picking, setPicking] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  // 메뉴 밖을 누르면 닫기
  useEffect(() => {
    if (!open) return
    const close = (e: PointerEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('pointerdown', close)
    return () => document.removeEventListener('pointerdown', close)
  }, [open])

  const item = (icon: IconName, label: string, run: () => void) => (
    <button
      role="menuitem"
      onClick={() => {
        setOpen(false)
        run()
      }}
    >
      <Icon name={icon} size={20} />
      {label}
    </button>
  )

  const store = useEditor.getState()
  return (
    <div className="menu-wrap" ref={ref}>
      <button onClick={() => setOpen(!open)} aria-haspopup="menu" aria-expanded={open} title="파일">
        <Icon name="menu" />
        <span>파일</span>
      </button>
      {open && (
        <div className="menu" role="menu">
          {item('file', '새 회로', () => {
            store.setCircuit(emptyCircuit())
            store.showToast('새 회로를 만들었습니다 · 되돌리기로 이전 회로를 되살릴 수 있습니다')
          })}
          {item('sample', '예제 회로', () => setPicking(true))}
          <hr />
          {item('save', '파일로 저장', saveToFile)}
          {item('open', '파일 불러오기', () => openFromFile(() => requestAnimationFrame(fitToScreen)))}
          <hr />
          {item('edit', '회로 이름 바꾸기', () => {
            const name = prompt('회로 이름', useEditor.getState().circuit.name)
            if (name) store.renameCircuit(name)
          })}
        </div>
      )}
      {picking && <ExamplePicker onClose={() => setPicking(false)} onOpened={() => requestAnimationFrame(fitToScreen)} />}
    </div>
  )
}
