// 고장진단 탭 왼쪽 창: 문제 고르기 · 증상과 정상 동작 · 테스터 · 고장 지목 · (교사) 고장 심기
import { useState } from 'react'
import { FAULT_KIND_TEXT, faultLabel, type Fault } from '../../engine'
import { FAULT_PROBLEMS } from '../../examples/faults'
import { useEditor } from '../../store/editorStore'
import { useFault, type FaultTool } from '../../store/faultStore'
import { fitToScreen } from '../../ui/Toolbar'
import { openFromFile, saveToFile } from '../../ui/fileActions'
import { Icon } from '../../ui/Icon'

export function FaultPanel() {
  const hasFaults = useEditor((s) => (s.circuit.faults?.length ?? 0) > 0)
  const info = useEditor((s) => s.circuit.faultInfo)
  const found = useFault((s) => s.found)
  const [choosing, setChoosing] = useState(false)
  const active = hasFaults || !!info || found.length > 0
  return (
    <aside className="task-panel" aria-label="고장진단">
      {!active || choosing ? <ProblemChooser onClose={active ? () => setChoosing(false) : undefined} /> : <Diagnosis onChoose={() => setChoosing(true)} />}
    </aside>
  )
}

/** 고장진단 문제 고르기 */
function ProblemChooser({ onClose }: { onClose?: () => void }) {
  const hasControl = useEditor((s) => s.circuit.components.some((c) => c.kind === 'contact' || c.kind === 'coil'))
  const groups = [...new Set(FAULT_PROBLEMS.map((p) => p.group))]
  const start = (c: ReturnType<(typeof FAULT_PROBLEMS)[0]['make']>) => {
    const ed = useEditor.getState()
    ed.setCircuit(c)
    useFault.getState().resetProgress()
    requestAnimationFrame(fitToScreen)
    ed.showToast('고장 난 회로입니다 · 조작해서 증상을 확인하고 테스터로 고장 위치를 찾으세요')
    onClose?.()
  }
  return (
    <div className="task-scroll">
      <div className="task-head">
        <strong>고장진단 문제</strong>
        {onClose && <button onClick={onClose}>돌아가기</button>}
      </div>
      <p className="task-note">회로 어딘가에 단선·접점 불량·코일 소손이 숨어 있습니다. 증상을 보고 테스터로 재서 찾아내세요.</p>
      {groups.map((g) => (
        <section key={g}>
          <h3 className="task-group">{g}</h3>
          <div className="task-grid">
            {FAULT_PROBLEMS.filter((p) => p.group === g).map((p) => (
              <button key={p.key} onClick={() => start(p.make())}>
                {p.title}
              </button>
            ))}
          </div>
        </section>
      ))}
      <h3 className="task-group">다른 문제</h3>
      <div className="task-actions">
        <button
          disabled={!hasControl}
          onClick={() => {
            const n = useFault.getState().plantRandom(1)
            useFault.getState().resetProgress()
            const ed = useEditor.getState()
            if (n) {
              ed.setCircuit({ ...ed.circuit, faultInfo: { title: ed.circuit.name, description: '지금 회로에 무작위 고장 1개를 심었습니다. 원래 회로가 하던 동작과 비교해 보세요.' } })
              ed.showToast('무작위 고장 1개를 심었습니다')
            }
            onClose?.()
          }}
        >
          지금 회로에 무작위 고장 심기
        </button>
        <button onClick={() => openFromFile(() => requestAnimationFrame(fitToScreen))}>
          <Icon name="open" size={20} />
          고장진단 파일 열기
        </button>
      </div>
      {!hasControl && <p className="task-note">무작위 고장을 심으려면 먼저 예제 회로를 열거나 회로를 그리세요.</p>}
    </div>
  )
}

const TOOLS: { key: FaultTool; label: string; help: string }[] = [
  { key: 'operate', label: '조작', help: '버튼·스위치를 눌러 증상을 확인하세요.' },
  { key: 'volt', label: '전압', help: '두 점(단자·배선)을 차례로 누르세요. 열린 접점이나 부하 양단에는 220 V, 같은 선 위는 0 V.' },
  { key: 'ohm', label: '도통', help: 'MCCB(전원)를 끈 뒤 두 점을 누르세요. 닫힌 접점·배선은 0 Ω, 끊긴 곳은 ∞, 코일·램프는 저항 있음.' },
  { key: 'point', label: '고장 지목', help: '고장 났다고 생각하는 접점·코일·배선을 누르고 고장 종류를 고르세요.' },
]

function Diagnosis({ onChoose }: { onChoose: () => void }) {
  const info = useEditor((s) => s.circuit.faultInfo)
  const left = useEditor((s) => s.circuit.faults?.length ?? 0)
  const { tool, reading, measurements, wrongGuesses, found, target, probes } = useFault()
  const { setTool, choose, cancelTarget } = useFault.getState()
  const total = found.length + left
  const help = tool === 'plant' ? '고장을 심을 접점·코일·배선을 누르세요.' : TOOLS.find((t) => t.key === tool)!.help

  return (
    <div className="task-scroll">
      <div className="task-head">
        <strong>{info?.title ?? '고장진단'}</strong>
      </div>
      {info && (
        <details className="task-desc" open>
          <summary>증상과 정상 동작</summary>
          <p>{info.description}</p>
        </details>
      )}

      <div className={`task-summary ${total > 0 && left === 0 ? 'pass' : ''}`}>
        {total > 0 && left === 0 ? '모든 고장을 찾아 고쳤습니다! 회로를 조작해 정상으로 동작하는지 확인하세요.' : `찾은 고장 ${found.length}/${total}`}
        <div className="task-hint">
          측정 {measurements}회 · 틀린 지목 {wrongGuesses}회
        </div>
      </div>

      <div className="segmented fault-tools" role="group" aria-label="도구">
        {TOOLS.map((t) => (
          <button key={t.key} className={tool === t.key ? 'on' : ''} aria-pressed={tool === t.key} onClick={() => setTool(t.key)}>
            {t.label}
          </button>
        ))}
      </div>
      <p className="task-note">{help}</p>

      {(tool === 'volt' || tool === 'ohm') && (
        <div className={`meter ${reading?.refused ? 'refused' : ''}`} aria-live="polite">
          <span className="meter-mode">{tool === 'volt' ? '전압 (AC)' : '도통 (Ω)'}</span>
          <strong>{probes.length === 1 ? '두 번째 점을 누르세요' : reading && reading.tool === tool ? reading.text : '—'}</strong>
        </div>
      )}

      {target && (
        <div className="fault-choose">
          <div>
            <strong>{target.label}</strong>
            {tool === 'plant' ? '에 심을 고장' : '의 고장 종류는?'}
          </div>
          <div className="task-actions">
            {target.kinds.map((k) => (
              <button key={k} className="primary" onClick={() => choose(k)}>
                {FAULT_KIND_TEXT[k]}
              </button>
            ))}
            <button onClick={cancelTarget}>취소</button>
          </div>
        </div>
      )}

      {found.length > 0 && (
        <>
          <h3 className="task-group">찾아서 고친 고장</h3>
          <ul className="fault-found">
            {found.map((f) => (
              <li key={f}>✓ {f}</li>
            ))}
          </ul>
        </>
      )}

      <div className="task-actions">
        <button onClick={onChoose}>다른 문제 고르기</button>
      </div>
      <TeacherTools />
    </div>
  )
}

/** 교사용: 고장 보기·심기·지우기, 문제 파일 저장 */
function TeacherTools() {
  const faults = useEditor((s) => s.circuit.faults ?? [])
  const circuit = useEditor((s) => s.circuit)
  const tool = useFault((s) => s.tool)
  const [show, setShow] = useState(false)
  return (
    <details className="task-desc teacher">
      <summary>교사용</summary>
      <div className="task-actions">
        <button className={tool === 'plant' ? 'primary' : ''} onClick={() => useFault.getState().setTool(tool === 'plant' ? 'operate' : 'plant')}>
          고장 직접 심기
        </button>
        <button
          onClick={() => {
            const n = useFault.getState().plantRandom(1)
            useEditor.getState().showToast(n ? '무작위 고장 1개를 더 심었습니다' : '더 심을 곳이 없습니다')
          }}
        >
          무작위 고장 추가
        </button>
        <button onClick={() => setShow(!show)}>{show ? '고장 숨기기' : `심은 고장 보기 (${faults.length})`}</button>
      </div>
      {show && (
        <ul className="fault-found">
          {faults.map((f: Fault, i) => (
            <li key={i}>
              {faultLabel(circuit, f)}
              <button onClick={() => useFault.getState().removeFault(f)}>지우기</button>
            </li>
          ))}
          {!faults.length && <li>심은 고장이 없습니다</li>}
        </ul>
      )}
      <div className="task-actions">
        <button
          onClick={() => {
            const ed = useEditor.getState()
            const c = ed.circuit
            const title = c.faultInfo?.title ?? c.name
            const description = prompt('학생에게 보일 증상·정상 동작 설명', c.faultInfo?.description ?? '')
            if (description === null) return
            const withInfo = { ...c, faultInfo: { title, description } }
            ed.setCircuit(withInfo)
            saveToFile(withInfo, `${title} 고장진단`)
          }}
        >
          <Icon name="save" size={20} />
          고장진단 파일 저장
        </button>
      </div>
      <p className="task-note">학생이 파일을 열면 고장진단 탭에서 고장 위치는 보이지 않고 증상만 보입니다.</p>
    </details>
  )
}
