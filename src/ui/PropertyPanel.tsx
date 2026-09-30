// 속성 창: 부품을 선택하면 캔버스 아래에 떠서 번호·a/b·설정값을 바꾼다
import { useState } from 'react'
import { busSegment, onSegment, pinsOf, type Component, type LampColor, type Phase, type Point, type Wire } from '../engine'
import { stepTag, tagFamily } from '../editor/palette'
import { useEditor } from '../store/editorStore'
import { PHASE_LABEL } from '../symbols/defs'
import { Icon } from './Icon'

/** 부품 종류 이름 (속성 창 제목) */
export function describe(c: Component): string {
  switch (c.kind) {
    case 'bus':
      return `${PHASE_LABEL[c.phase]} 모선`
    case 'contact': {
      const dev = {
        pb: '푸시버튼',
        selector: '셀렉터 스위치',
        limit: '리밋 스위치',
        relay: '릴레이',
        mc: '전자접촉기 보조',
        timer: '타이머 한시',
        timerInst: '타이머 순시',
        counter: '카운터',
        flicker: '플리커릴레이',
        thr: '열동계전기',
        eocr: 'EOCR',
        fls: '플로트레스',
      }[c.device]
      return `${dev} ${c.type}접점`
    }
    case 'coil':
      return {
        relay: '릴레이 코일',
        mc: '전자접촉기 코일',
        timer: '타이머 코일',
        counter: '카운터 계수 코일',
        counterReset: '카운터 리셋 코일',
        flicker: '플리커릴레이 코일',
        eocr: 'EOCR 조작 전원',
      }[c.device]
    case 'lamp':
      return '표시등'
    case 'buzzer':
      return '부저'
    case 'mccb':
      return '배선용 차단기'
    case 'mcMain':
      return '전자접촉기 주접점'
    case 'thrHeater':
      return c.relay === 'eocr' ? 'EOCR (주회로)' : '열동계전기 히터'
    case 'motor':
      return '3상 유도전동기'
    case 'fls':
      return '플로트레스 스위치'
    case 'fuse':
      return '퓨즈'
    case 'terminalBlock':
      return '단자대'
    case 'ground':
      return '접지'
  }
}

/** 번호 입력 정리: 공백 제거, 영문 대문자, 최대 8자 */
const cleanTag = (s: string) => s.replace(/\s+/g, '').toUpperCase().slice(0, 8)

export function PropertyPanel() {
  const selection = useEditor((s) => s.selection)
  const comp = useEditor((s) => s.circuit.components.find((c) => c.id === s.selection))
  const wire = useEditor((s) => s.circuit.wires.find((w) => w.id === s.selection))
  if (!selection) return null
  if (wire) return <WirePanel key={wire.id} wire={wire} />
  if (!comp) return null
  // key: 다른 부품을 고르면 입력 상태를 새로 시작
  return <Panel key={comp.id} comp={comp} />
}

/** 배선 선택: 양 끝이 무엇에 연결됐는지 보여 주고 삭제 */
function WirePanel({ wire }: { wire: Wire }) {
  const circuit = useEditor((s) => s.circuit)
  const { deleteSelected, select } = useEditor.getState()
  const endName = (p: Point) => {
    for (const c of circuit.components) {
      const pin = pinsOf(c).find((q) => q.x === p.x && q.y === p.y)
      if (pin) return 'tag' in c ? `${c.tag} 단자` : describe(c)
    }
    for (const c of circuit.components) {
      if (c.kind === 'bus') {
        const [a, b] = busSegment(c)
        if (onSegment(p, a, b)) return `${PHASE_LABEL[c.phase]} 모선`
      }
    }
    for (const w of circuit.wires) {
      if (w.id === wire.id) continue
      for (let i = 0; i + 1 < w.points.length; i++) {
        if (onSegment(p, w.points[i]!, w.points[i + 1]!)) return '다른 배선 (T 접속)'
      }
    }
    return '연결 안 됨'
  }
  const ends = [endName(wire.points[0]!), endName(wire.points[wire.points.length - 1]!)]
  return (
    <div className="props" role="dialog" aria-label="배선 속성">
      <div className="props-head">
        <strong>배선</strong>
        <div className="props-actions">
          <button onClick={deleteSelected} title="삭제" className="danger">
            <Icon name="trash" size={20} />
          </button>
          <button onClick={() => select(null)} title="닫기" aria-label="닫기">
            ✕
          </button>
        </div>
      </div>
      <Row label="연결">
        <span className={ends.includes('연결 안 됨') ? 'warn-text' : ''}>
          {ends[0]} ↔ {ends[1]}
        </span>
      </Row>
    </div>
  )
}

function Panel({ comp }: { comp: Component }) {
  const { updateComponent, rotateSelected, deleteSelected, select } = useEditor.getState()
  const update = (patch: Partial<Component>) => updateComponent(comp.id, patch)
  const family = tagFamily(comp)

  return (
    <div className="props" role="dialog" aria-label="부품 속성">
      <div className="props-head">
        <strong>{describe(comp)}</strong>
        <div className="props-actions">
          <button onClick={rotateSelected} title="회전">
            <Icon name="rotate" size={20} />
          </button>
          <button onClick={deleteSelected} title="삭제" className="danger">
            <Icon name="trash" size={20} />
          </button>
          <button onClick={() => select(null)} title="닫기" aria-label="닫기">
            ✕
          </button>
        </div>
      </div>

      {'tag' in comp && family && <TagField value={comp.tag} onChange={(tag) => update({ tag })} />}

      {comp.kind === 'contact' && (
        <Row label="접점">
          <Segmented
            value={comp.type}
            options={[
              ['a', 'a접점 (평상시 열림)'],
              ['b', 'b접점 (평상시 닫힘)'],
            ]}
            onChange={(type) => update({ type })}
          />
        </Row>
      )}

      {comp.kind === 'coil' && (comp.device === 'timer' || comp.device === 'flicker') && (
        <Row label={comp.device === 'timer' ? '설정 시간' : '전환 간격'}>
          <Stepper
            value={(comp.preset ?? 1000) / 1000}
            step={0.5}
            min={0.5}
            max={60}
            unit="초"
            onChange={(v) => update({ preset: Math.round(v * 1000) })}
          />
        </Row>
      )}

      {comp.kind === 'coil' && comp.device === 'counter' && (
        <Row label="설정 횟수">
          <Stepper value={comp.preset ?? 1} step={1} min={1} max={99} unit="회" onChange={(v) => update({ preset: v })} />
        </Row>
      )}

      {comp.kind === 'thrHeater' && (
        <Row label="트립 시간">
          <Stepper
            value={comp.tripTime / 1000}
            step={1}
            min={1}
            max={30}
            unit="초"
            onChange={(v) => update({ tripTime: Math.round(v * 1000) })}
          />
        </Row>
      )}

      {comp.kind === 'lamp' && (
        <Row label="색">
          <Segmented<LampColor>
            value={comp.color}
            options={[
              ['RL', '적색 RL'],
              ['GL', '녹색 GL'],
              ['YL', '황색 YL'],
              ['WL', '백색 WL'],
            ]}
            onChange={(color) => update({ color, ...(comp.tag === comp.color ? { tag: color } : {}) })}
          />
        </Row>
      )}

      {comp.kind === 'bus' && (
        <>
          <Row label="전위">
            <Segmented<Phase>
              value={comp.phase}
              options={(['P', 'N', 'R', 'S', 'T'] as Phase[]).map((p) => [p, PHASE_LABEL[p]])}
              onChange={(phase) => update({ phase })}
            />
          </Row>
          <Row label="길이">
            <Stepper value={comp.length} step={2} min={2} max={200} unit="칸" onChange={(length) => update({ length })} />
          </Row>
        </>
      )}

      {comp.kind === 'motor' && (
        <Row label="과부하 모의">
          <Segmented
            value={comp.overload ? 'on' : 'off'}
            options={[
              ['off', '정상'],
              ['on', '과부하'],
            ]}
            onChange={(v) => update({ overload: v === 'on' })}
          />
        </Row>
      )}

      {comp.kind === 'terminalBlock' && (
        <Row label="단자 이름">
          <TextInput
            value={comp.labels.join(', ')}
            placeholder="예) L1, L2, L3, PE"
            onCommit={(v) => {
              const labels = v
                .split(/[,\s]+/)
                .map((l) => l.trim().toUpperCase())
                .filter(Boolean)
                .slice(0, 12)
              if (labels.length) update({ labels })
            }}
          />
        </Row>
      )}
    </div>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="props-row">
      <span className="props-label">{label}</span>
      <div className="props-field">{children}</div>
    </div>
  )
}

/** 번호: 직접 입력 + 오른쪽 ▲▼ 버튼으로 번호 올리기·내리기 */
function TagField({ value, onChange }: { value: string; onChange: (tag: string) => void }) {
  const [text, setText] = useState(value)
  const commit = (t: string) => {
    const tag = cleanTag(t)
    if (tag && tag !== value) onChange(tag)
    setText(tag || value)
  }
  const step = (delta: 1 | -1) => {
    const tag = stepTag(cleanTag(text) || value, delta)
    setText(tag)
    onChange(tag)
  }
  return (
    <Row label="번호">
      <div className="tag-field">
        <input
          className="props-input"
          value={text}
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          maxLength={8}
          onChange={(e) => {
            setText(e.target.value)
            const tag = cleanTag(e.target.value)
            if (tag) onChange(tag)
          }}
          onBlur={(e) => commit(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur()
            else if (e.key === 'ArrowUp') {
              e.preventDefault()
              step(1)
            } else if (e.key === 'ArrowDown') {
              e.preventDefault()
              step(-1)
            }
          }}
        />
        <button className="arrow" onClick={() => step(1)} aria-label="번호 올리기" title="번호 올리기">
          ▲
        </button>
        <button className="arrow" onClick={() => step(-1)} aria-label="번호 내리기" title="번호 내리기">
          ▼
        </button>
      </div>
    </Row>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: [T, string][]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map(([v, label]) => (
        <button key={v} className={v === value ? 'on' : ''} onClick={() => onChange(v)}>
          {label}
        </button>
      ))}
    </div>
  )
}

function Stepper({
  value,
  step,
  min,
  max,
  unit,
  onChange,
}: {
  value: number
  step: number
  min: number
  max: number
  unit: string
  onChange: (v: number) => void
}) {
  const clamp = (v: number) => Math.min(max, Math.max(min, Math.round(v / step) * step))
  return (
    <div className="stepper">
      <button onClick={() => onChange(clamp(value - step))} aria-label="줄이기">
        −
      </button>
      <input
        className="props-input num"
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        onChange={(e) => {
          const v = Number(e.target.value)
          if (Number.isFinite(v) && v >= min && v <= max) onChange(v)
        }}
      />
      <span className="unit">{unit}</span>
      <button onClick={() => onChange(clamp(value + step))} aria-label="늘리기">
        +
      </button>
    </div>
  )
}

function TextInput({ value, placeholder, onCommit }: { value: string; placeholder: string; onCommit: (v: string) => void }) {
  const [text, setText] = useState(value)
  return (
    <input
      className="props-input wide"
      value={text}
      placeholder={placeholder}
      autoComplete="off"
      spellCheck={false}
      onChange={(e) => setText(e.target.value)}
      onBlur={() => onCommit(text)}
      onKeyDown={(e) => {
        if (e.key === 'Enter') e.currentTarget.blur()
      }}
    />
  )
}
