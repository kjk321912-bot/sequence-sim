// 예제 회로 고르기 창 (파일 메뉴 → 예제 회로)
import { useEffect } from 'react'
import { EXAMPLES, type Example } from '../examples'
import { useEditor } from '../store/editorStore'
import { useSim } from '../store/simStore'

export function ExamplePicker({ onClose, onOpened }: { onClose: () => void; onOpened: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const open = (ex: Example) => {
    const store = useEditor.getState()
    store.setCircuit(ex.make())
    // 실행 중이면 새 회로의 처음 상태에서 다시 시작
    useSim.getState().reset()
    store.showToast(`${ex.title} — ${ex.howTo}`)
    onClose()
    onOpened()
  }

  return (
    <div className="dialog-backdrop" onPointerDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="dialog" role="dialog" aria-modal="true" aria-labelledby="example-title">
        <div className="dialog-head">
          <strong id="example-title">예제 회로</strong>
          <button onClick={onClose} aria-label="닫기">
            닫기
          </button>
        </div>
        <p className="dialog-note">열면 지금 회로 대신 예제가 열립니다 · 되돌리기로 이전 회로를 되살릴 수 있습니다</p>
        <ul className="example-list">
          {EXAMPLES.map((ex, i) => (
            <li key={ex.key}>
              <button className="example-item" onClick={() => open(ex)}>
                <span className="example-num">{i + 1}</span>
                <span>
                  <strong>{ex.title}</strong>
                  <small>{ex.summary}</small>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
