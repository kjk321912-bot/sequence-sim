// 상단 툴바: 모드 전환, 편집 도구, 화면 배율
import { emptyCircuit } from '../engine'
import { fitView, getCanvasRect, zoomAt } from '../editor/viewMath'
import { showcaseCircuit } from '../examples/showcase'
import { useEditor } from '../store/editorStore'
import { Icon } from './Icon'

const MODES = [
  { key: 'edit', label: '편집', ready: true },
  { key: 'run', label: '실행', ready: false },
  { key: 'task', label: '과제', ready: false },
  { key: 'fault', label: '고장진단', ready: false },
] as const

function fit() {
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
  const selection = useEditor((s) => s.selection)
  const scale = useEditor((s) => s.view.scale)
  const circuitName = useEditor((s) => s.circuit.name)
  const { rotateSelected, deleteSelected, setCircuit } = useEditor.getState()

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
          <button key={m.key} className={m.key === 'edit' ? 'on' : ''} disabled={!m.ready} title={m.ready ? m.label : `${m.label} (준비 중)`}>
            {m.label}
          </button>
        ))}
      </nav>

      <div className="tools">
        <button onClick={rotateSelected} disabled={!selection} title="회전 (R)">
          <Icon name="rotate" />
          <span>회전</span>
        </button>
        <button onClick={deleteSelected} disabled={!selection} title="삭제 (Delete)" className="danger">
          <Icon name="trash" />
          <span>삭제</span>
        </button>
        <span className="sep" />
        <button onClick={() => zoomBy(1 / 1.25)} title="축소" aria-label="축소">
          <Icon name="zoomOut" />
        </button>
        <span className="zoom">{Math.round(scale * 100)}%</span>
        <button onClick={() => zoomBy(1.25)} title="확대" aria-label="확대">
          <Icon name="zoomIn" />
        </button>
        <button onClick={fit} title="화면 맞춤" aria-label="화면 맞춤">
          <Icon name="fit" />
        </button>
        <span className="sep" />
        <button
          onClick={() => {
            if (confirm('지금 회로를 지우고 새 회로를 만들까요?')) setCircuit(emptyCircuit())
          }}
          title="새 회로"
        >
          <Icon name="file" />
          <span>새 회로</span>
        </button>
        <button
          onClick={() => {
            if (confirm('기호 모음 예제를 불러올까요? 지금 회로는 지워집니다.')) {
              setCircuit(showcaseCircuit())
              requestAnimationFrame(fit)
            }
          }}
          title="기호 모음 예제"
        >
          <Icon name="sample" />
          <span>예제</span>
        </button>
      </div>
    </header>
  )
}
