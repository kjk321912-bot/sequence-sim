import { useEffect, useRef, useState } from 'react'
import './App.css'

// 0단계 임시 화면: 설치·오프라인 확인과 입력 장치(손가락/S펜) 인식 테스트
// 편집기가 완성되면 교체된다.

type PointerInfo = { id: number; type: string; x: number; y: number; pressure: number }

const TYPE_LABEL: Record<string, string> = { touch: '손가락', pen: 'S펜', mouse: '마우스' }

export default function App() {
  const online = useOnline()
  const standalone = window.matchMedia('(display-mode: standalone)').matches
  const [pointers, setPointers] = useState<Map<number, PointerInfo>>(new Map())
  const [lastType, setLastType] = useState<string>('-')
  const [trail, setTrail] = useState<{ x: number; y: number; type: string }[]>([])
  const areaRef = useRef<HTMLDivElement>(null)

  function update(e: React.PointerEvent, remove = false) {
    const rect = areaRef.current?.getBoundingClientRect()
    if (!rect) return
    const x = e.clientX - rect.left
    const y = e.clientY - rect.top
    setLastType(e.pointerType)
    setPointers((prev) => {
      const next = new Map(prev)
      if (remove) next.delete(e.pointerId)
      else next.set(e.pointerId, { id: e.pointerId, type: e.pointerType, x, y, pressure: e.pressure })
      return next
    })
    if (!remove && e.buttons) setTrail((t) => [...t.slice(-400), { x, y, type: e.pointerType }])
  }

  return (
    <div className="app">
      <header className="app-header">
        <img src={`${import.meta.env.BASE_URL}icon.svg`} alt="" width={36} height={36} />
        <h1>시퀀스 회로 시뮬레이터</h1>
        <span className="badge">v{__APP_VERSION__} · 0단계</span>
        <span className={`badge ${online ? 'ok' : 'off'}`}>{online ? '온라인' : '오프라인'}</span>
        <span className={`badge ${standalone ? 'ok' : ''}`}>{standalone ? '앱으로 실행 중' : '브라우저에서 실행 중'}</span>
      </header>

      <main className="app-main">
        <section className="panel">
          <h2>입력 장치 테스트</h2>
          <p>아래 영역을 손가락, S펜으로 각각 그어 보세요. 두 손가락도 동시에 대 보세요.</p>
          <dl>
            <dt>마지막 입력</dt>
            <dd className="big">{TYPE_LABEL[lastType] ?? lastType}</dd>
            <dt>동시 접촉 수</dt>
            <dd className="big">{pointers.size}</dd>
            {[...pointers.values()].map((p) => (
              <dd key={p.id}>
                {TYPE_LABEL[p.type] ?? p.type} · 압력 {p.pressure.toFixed(2)}
              </dd>
            ))}
          </dl>
          <button onClick={() => setTrail([])}>지우기</button>
        </section>

        <div
          ref={areaRef}
          className="touch-area"
          onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId)
            update(e)
          }}
          onPointerMove={(e) => update(e)}
          onPointerUp={(e) => update(e, true)}
          onPointerCancel={(e) => update(e, true)}
        >
          <svg width="100%" height="100%">
            {trail.map((p, i) => (
              <circle key={i} cx={p.x} cy={p.y} r={p.type === 'pen' ? 2 : 6} className={`dot-${p.type}`} />
            ))}
            {[...pointers.values()].map((p) => (
              <circle key={p.id} cx={p.x} cy={p.y} r={30} className={`ring-${p.type}`} />
            ))}
          </svg>
          {trail.length === 0 && <div className="hint">여기에 그려 보세요</div>}
        </div>
      </main>
    </div>
  )
}

function useOnline() {
  const [online, setOnline] = useState(navigator.onLine)
  useEffect(() => {
    const on = () => setOnline(true)
    const off = () => setOnline(false)
    window.addEventListener('online', on)
    window.addEventListener('offline', off)
    return () => {
      window.removeEventListener('online', on)
      window.removeEventListener('offline', off)
    }
  }, [])
  return online
}
