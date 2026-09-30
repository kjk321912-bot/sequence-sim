// 실행 모드 조작판(재생·일시정지·배속·처음부터)과 경고 표시줄
import { useEffect, useState } from 'react'
import { useEditor } from '../../store/editorStore'
import { liveResult, useSim, type Speed } from '../../store/simStore'
import { PHASE_LABEL } from '../../symbols/defs'
import { Icon } from '../../ui/Icon'

const SPEEDS: Speed[] = [1, 5]

export function RunControls() {
  const paused = useSim((s) => s.paused)
  const speed = useSim((s) => s.speed)
  const { setPaused, setSpeed, reset } = useSim.getState()
  return (
    <div className="run-controls" role="toolbar" aria-label="실행 조작">
      <button className="play" onClick={() => setPaused(!paused)} title={paused ? '재생 (Space)' : '일시정지 (Space)'} aria-label={paused ? '재생' : '일시정지'}>
        <Icon name={paused ? 'play' : 'pause'} />
      </button>
      <div className="segmented" role="group" aria-label="배속">
        {SPEEDS.map((v) => (
          <button key={v} className={speed === v ? 'on' : ''} onClick={() => setSpeed(v)} aria-pressed={speed === v}>
            ×{v}
          </button>
        ))}
      </div>
      <SimClock paused={paused} />
      <button onClick={reset} title="처음부터 (모든 버튼·코일·타이머 복귀)" aria-label="처음부터">
        <Icon name="restart" />
      </button>
    </div>
  )
}

/** 시뮬레이션 경과 시간 (0.1초 간격으로 갱신) */
function SimClock({ paused }: { paused: boolean }) {
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMs(liveResult()?.state.time ?? 0), 100)
    return () => clearInterval(id)
  }, [])
  return (
    <span className={`sim-clock ${paused ? 'paused' : ''}`} aria-label="경과 시간">
      {paused ? '정지 ' : ''}
      {(ms / 1000).toFixed(1)}초
    </span>
  )
}

interface Warning {
  kind: 'danger' | 'warn'
  text: string
}

/** 단락·발진·결상·직렬 연결 경고 (조건이 사라지면 저절로 없어진다) */
export function RunBanner() {
  const result = useSim((s) => s.result)
  const paused = useSim((s) => s.paused)
  const comps = useEditor((s) => s.circuit.components)
  if (!result) return null
  const { solution: sol, oscillating } = result
  const tagOf = (id: string) => {
    const c = comps.find((k) => k.id === id)
    return c && 'tag' in c ? c.tag : '?'
  }
  const list: Warning[] = []
  for (const phases of sol.shorts) {
    const names = phases.map((p) => PHASE_LABEL[p]).join('–')
    list.push({
      kind: 'danger',
      text: `단락! ${names}가 부하 없이 바로 이어졌습니다. 빨간 경로를 확인하세요${paused ? ' · 시뮬레이션 정지 (원인을 고친 뒤 ↺ 처음부터)' : ''}`,
    })
  }
  if (oscillating.length) {
    list.push({ kind: 'warn', text: `발진: ${oscillating.join(', ')} 코일이 붙었다 떨어지기를 반복합니다 (자기 b접점으로 여자되는지 확인)` })
  }
  const single = Object.entries(sol.motors).filter(([, r]) => r === 'singlePhase')
  if (single.length) {
    list.push({ kind: 'danger', text: `결상: ${single.map(([id]) => tagOf(id)).join(', ')} — 한 상이 빠져 회전하지 못합니다. 보호계전기가 곧 트립합니다` })
  }
  if (sol.seriesLoads.length) {
    list.push({
      kind: 'warn',
      text: `${sol.seriesLoads.map(tagOf).join(', ')}: 부하가 직렬로 연결돼 동작하지 않습니다. 부하는 P와 N 사이에 하나씩 연결하세요`,
    })
  }
  if (!list.length) return null
  return (
    <div className="run-banner" role="alert">
      {list.map((w, i) => (
        <div key={i} className={`run-warning ${w.kind}`}>
          {w.text}
        </div>
      ))}
    </div>
  )
}
