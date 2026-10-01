// 과제 탭 왼쪽 창: 과제 고르기 · 동작 조건 · 채점(재생) · 결과 · 과제 만들기
import { useEffect, useRef, useState } from 'react'
import { describeStep, outputText, type CheckResult, type Expectation, type Task } from '../../engine'
import { BUILTIN_TASKS } from '../../examples/tasks'
import { useEditor } from '../../store/editorStore'
import { liveResult, useSim, type Speed } from '../../store/simStore'
import { useTask } from '../../store/taskStore'
import { fitToScreen } from '../../ui/Toolbar'
import { openFromFile, saveStudentFile } from '../../ui/fileActions'
import { Icon } from '../../ui/Icon'

export function TaskPanel() {
  const task = useEditor((s) => s.circuit.task)
  const recording = useTask((s) => s.recording)
  const draft = useTask((s) => s.draft)
  const [choosing, setChoosing] = useState(false)

  let body
  if (recording) body = <RecordingView />
  else if (draft) body = <DraftForm />
  else if (!task || choosing) body = <TaskChooser onClose={task ? () => setChoosing(false) : undefined} />
  else body = <TaskView task={task} onChoose={() => setChoosing(true)} />
  return (
    <aside className="task-panel" aria-label="과제">
      {body}
    </aside>
  )
}

/** 과제가 없을 때: 기본 과제 고르기, 파일에서 열기, 지금 회로로 만들기 */
function TaskChooser({ onClose }: { onClose?: () => void }) {
  const hasParts = useEditor((s) => s.circuit.components.some((c) => c.kind !== 'bus'))
  const groups = [...new Set(BUILTIN_TASKS.map((t) => t.group))]
  const open = (make: () => ReturnType<(typeof BUILTIN_TASKS)[0]['make']>) => {
    const ed = useEditor.getState()
    ed.setCircuit(make())
    ed.showToast('과제를 열었습니다 · 편집 탭에서 회로를 그린 뒤 과제 탭에서 채점하세요')
    requestAnimationFrame(fitToScreen)
    onClose?.()
  }
  return (
    <div className="task-scroll">
      <div className="task-head">
        <strong>과제 고르기</strong>
        {onClose && <button onClick={onClose}>돌아가기</button>}
      </div>
      <p className="task-note">과제를 열면 지금 회로 대신 시작 회로가 열립니다 · 되돌리기로 되살릴 수 있습니다</p>
      {groups.map((g) => (
        <section key={g}>
          <h3 className="task-group">{g}</h3>
          <div className="task-grid">
            {BUILTIN_TASKS.filter((t) => t.group === g).map((t) => (
              <button key={t.key} onClick={() => open(t.make)}>
                {t.title}
              </button>
            ))}
          </div>
        </section>
      ))}
      <h3 className="task-group">다른 과제</h3>
      <div className="task-actions">
        <button
          onClick={() =>
            openFromFile(() => {
              requestAnimationFrame(fitToScreen)
              onClose?.()
            })
          }
        >
          <Icon name="open" size={20} />
          과제 파일 열기
        </button>
        <button onClick={() => useTask.getState().startRecording()} disabled={!hasParts}>
          <Icon name="edit" size={20} />
          지금 회로로 과제 만들기 (교사용)
        </button>
      </div>
      {!hasParts && <p className="task-note">과제를 만들려면 먼저 정답 회로를 그리세요.</p>}
    </div>
  )
}

const SPEEDS: Speed[] = [1, 5]

function SpeedButtons() {
  const speed = useSim((s) => s.speed)
  return (
    <div className="segmented" role="group" aria-label="재생 배속">
      {SPEEDS.map((v) => (
        <button key={v} className={speed === v ? 'on' : ''} onClick={() => useSim.getState().setSpeed(v)} aria-pressed={speed === v}>
          ×{v}
        </button>
      ))}
    </div>
  )
}

/** 과제 보기·채점 */
function TaskView({ task, onChoose }: { task: Task; onChoose: () => void }) {
  const { grade, phase, cursor, revealed, viewCheck } = useTask()
  const { startGrading, gradeNow, stop, jumpTo } = useTask.getState()
  const checkCount = task.steps.filter((s) => s.kind === 'check').length
  const listRef = useRef<HTMLOListElement>(null)

  // 재생 중인 단계가 보이도록
  useEffect(() => {
    listRef.current?.querySelector('.current')?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [cursor, viewCheck])

  let k = -1
  let prevExpect: Expectation[] = []
  return (
    <div className="task-scroll">
      <div className="task-head">
        <strong>{task.title}</strong>
      </div>
      <details className="task-desc" open>
        <summary>동작 조건</summary>
        <p>{task.description}</p>
      </details>

      <div className="task-controls">
        {phase === 'playing' ? (
          <button className="primary" onClick={stop}>
            <Icon name="pause" size={20} />
            멈춤
          </button>
        ) : (
          <button className="primary" onClick={startGrading}>
            <Icon name="play" size={20} />
            채점 시작
          </button>
        )}
        <button onClick={gradeNow} disabled={phase === 'playing'}>
          결과만 보기
        </button>
        <SpeedButtons />
      </div>

      <Summary checkCount={checkCount} />

      <ol className="task-steps" ref={listRef}>
        {task.steps.map((s, i) => {
          if (s.kind !== 'check') {
            return (
              <li key={i} className={`step ${s.kind} ${cursor === i ? 'current' : ''}`}>
                <span className="icon">{s.kind === 'wait' ? '⏱' : '▸'}</span>
                {describeStep(s)}
              </li>
            )
          }
          k++
          const no = k
          const result: CheckResult | undefined = grade && no < revealed ? grade.checks[no] : undefined
          const changed = s.expect.filter((e) => prevExpect.find((p) => p.tag === e.tag)?.value !== e.value)
          const shown = no === 0 ? s.expect.filter((e) => e.value !== 'off' && e.value !== 'stop') : changed
          prevExpect = s.expect
          const status = result ? (result.ok ? 'ok' : 'bad') : 'wait'
          return (
            <li key={i} className={`step check ${status} ${viewCheck === no || cursor === i ? 'current' : ''}`}>
              <button onClick={() => jumpTo(no)} disabled={!grade || phase === 'playing'} title="이 순간의 회로 상태 보기">
                <span className="icon">{status === 'ok' ? '✓' : status === 'bad' ? '✗' : '•'}</span>
                <span className="what">
                  {shown.length ? shown.map((e) => `${e.tag} ${outputText(e.value)}`).join(' · ') : no === 0 ? '모두 꺼짐' : '변화 없음'}
                </span>
                {grade && <span className="time">{(grade.checks[no]!.time / 1000).toFixed(1)}초</span>}
              </button>
              {result && !result.ok && (
                <div className="miss">
                  {result.items
                    .filter((x) => !x.ok)
                    .map((x) => (
                      <div key={x.tag}>
                        {x.tag}: 기대 {outputText(x.expected)} → 지금 {outputText(x.actual)}
                      </div>
                    ))}
                  {result.notes.map((n) => (
                    <div key={n}>{n}</div>
                  ))}
                </div>
              )}
            </li>
          )
        })}
      </ol>

      <div className="task-actions">
        <button onClick={() => saveStudentFile()}>
          <Icon name="save" size={20} />
          학생용 과제 파일 저장
        </button>
        <button onClick={onChoose}>다른 과제 고르기</button>
        <button
          onClick={() => {
            if (!confirm('이 회로에서 과제를 지울까요? (회로는 그대로 남습니다)')) return
            const ed = useEditor.getState()
            const { task: _drop, ...rest } = ed.circuit
            void _drop
            ed.setCircuit(rest)
          }}
        >
          과제 지우기
        </button>
      </div>
    </div>
  )
}

/** 채점 결과 요약 */
function Summary({ checkCount }: { checkCount: number }) {
  const { grade, phase, revealed } = useTask()
  if (!grade) {
    return <p className="task-note">편집 탭에서 회로를 완성한 뒤 '채점 시작'을 누르세요. 시나리오대로 조작하면서 확인점마다 램프·부저·전동기를 비교합니다.</p>
  }
  const problems = grade.problems.map((p) => (
    <div key={p} className="task-problem">
      {p}
    </div>
  ))
  if (phase === 'playing') {
    return (
      <div className="task-summary playing">
        채점 중… 확인점 {revealed}/{checkCount}
        {problems}
      </div>
    )
  }
  const okCount = grade.checks.filter((c) => c.ok).length
  if (grade.passed) {
    return <div className="task-summary pass">합격 — 확인점 {checkCount}개가 모두 맞습니다</div>
  }
  const first = grade.firstFail !== null ? grade.checks[grade.firstFail]! : null
  return (
    <div className="task-summary fail">
      불합격 — {first ? `${grade.firstFail! + 1}번째 확인점(${(first.time / 1000).toFixed(1)}초)에서 처음 틀렸습니다` : '조작할 부품이 없습니다'} · 맞은 확인점 {okCount}/
      {checkCount}
      {problems}
      {first && <div className="task-hint">틀린 출력은 회로에 빨간 원으로 표시됩니다. 확인점을 누르면 그 순간의 회로를 볼 수 있습니다.</div>}
    </div>
  )
}

/** 과제 만들기: 조작 기록 중 */
function RecordingView() {
  const rec = useTask((s) => s.recording) ?? []
  const [ms, setMs] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setMs(liveResult()?.state.time ?? 0), 100)
    return () => clearInterval(id)
  }, [])
  const { finishRecording, cancelRecording } = useTask.getState()
  return (
    <div className="task-scroll">
      <div className="task-head">
        <strong className="rec">● 조작 기록 중 {(ms / 1000).toFixed(1)}초</strong>
      </div>
      <p className="task-note">
        정답 회로를 학생이 할 순서대로 직접 조작하세요. 조작과 그 사이 시간이 기록되고, 조작할 때마다와 기다린 뒤마다 램프·부저·전동기 상태가 확인점이 됩니다. 타이머를 기다릴 때는 ×5 배속을 써도 됩니다.
      </p>
      <ol className="task-steps">
        {rec.map((r, i) => (
          <li key={i} className="step action">
            <span className="icon">▸</span>
            {describeStep({ kind: 'action', action: r.action })}
            <span className="time">{(r.time / 1000).toFixed(1)}초</span>
          </li>
        ))}
        {!rec.length && <li className="step wait">아직 조작이 없습니다</li>}
      </ol>
      <div className="task-actions">
        <button className="primary" onClick={finishRecording} disabled={!rec.length}>
          기록 끝내기
        </button>
        <button onClick={cancelRecording}>취소</button>
      </div>
    </div>
  )
}

/** 기록을 마친 뒤 제목·동작 조건 입력 */
function DraftForm() {
  const draft = useTask((s) => s.draft) ?? []
  const name = useEditor((s) => s.circuit.name)
  const [title, setTitle] = useState(name.replace(/^(예제|과제): /, ''))
  const [desc, setDesc] = useState('')
  const { saveDraft, discardDraft, startRecording } = useTask.getState()
  const actions = draft.filter((d) => 'do' in d).length
  const total = draft.reduce((t, d) => t + ('wait' in d ? d.wait : 0), 0)
  return (
    <div className="task-scroll">
      <div className="task-head">
        <strong>과제 정보</strong>
      </div>
      <p className="task-note">
        조작 {actions}개 · 전체 {(total / 1000).toFixed(1)}초를 기록했습니다. 학생에게 보일 제목과 동작 조건을 쓰세요. 부품 번호와 타이머 설정값은 자동으로 덧붙습니다.
      </p>
      <label className="task-field">
        <span>제목</span>
        <input className="props-input wide" value={title} onChange={(e) => setTitle(e.target.value)} />
      </label>
      <label className="task-field">
        <span>동작 조건</span>
        <textarea className="props-input wide" rows={8} value={desc} onChange={(e) => setDesc(e.target.value)} placeholder="(1) PB1을 누르면 …" />
      </label>
      <div className="task-actions">
        <button className="primary" onClick={() => saveDraft(title.trim() || '과제', desc)}>
          과제 만들기
        </button>
        <button onClick={startRecording}>다시 기록</button>
        <button onClick={discardDraft}>취소</button>
      </div>
    </div>
  )
}
