// 과제 모드 상태 (Zustand): 채점 결과, 채점 재생, 과제 만들기(조작 기록)
//
// 채점은 엔진(gradeTask)이 한 번에 끝내고, 화면에는 같은 시나리오를 실행 화면으로 다시 돌려 보여 준다.
// 재생 중에는 simStore를 driven 상태로 두어 시간은 재생기만 진행한다 (채점과 같은 20ms 간격이라 결과가 같다).
import { create } from 'zustand'
import {
  gradeTask,
  makeTask,
  partsSummary,
  scriptFromRecording,
  TASK_STEP_MS,
  type Grade,
  type ScriptItem,
  type Task,
  type TaskAction,
} from '../engine'
import { useEditor } from './editorStore'
import { liveResult, setActionListener, useSim } from './simStore'

/** 재생할 때 조작·확인점 하나를 보여 주는 실제 시간(ms) */
const HOLD_MS = 400

export type Phase = 'idle' | 'playing' | 'done'

export interface TaskStore {
  grade: Grade | null
  phase: Phase
  /** 재생 중 지금 단계 번호 (없으면 -1) */
  cursor: number
  /** 결과를 공개한 확인점 수 (재생하면서 하나씩 늘어난다) */
  revealed: number
  /** 캔버스가 보여 주는 확인점 (틀린 출력 표시용), 없으면 null */
  viewCheck: number | null
  /** 과제 만들기: 기록 중인 조작 */
  recording: { time: number; action: TaskAction }[] | null
  /** 기록을 마치고 제목·설명 입력을 기다리는 시나리오 */
  draft: ScriptItem[] | null

  /** 채점하고 처음부터 화면으로 재생 (틀린 곳에서 멈춤) */
  startGrading: () => void
  /** 재생 없이 결과만 보기 (처음 틀린 곳 또는 끝으로 이동) */
  gradeNow: () => void
  /** 확인점 k의 순간으로 캔버스를 옮긴다 */
  jumpTo: (k: number) => void
  stop: () => void
  startRecording: () => void
  finishRecording: () => void
  cancelRecording: () => void
  saveDraft: (title: string, description: string) => void
  discardDraft: () => void
}

let raf = 0

const currentTask = (): Task | undefined => useEditor.getState().circuit.task

/** 채점 화면을 새 시뮬레이션 상태에서 시작 */
function freshSim() {
  const sim = useSim.getState()
  if (sim.mode !== 'task') sim.setMode('task')
  sim.reset()
}

export const useTask = create<TaskStore>((set, get) => {
  /** 재생 끝: 시간은 멈춘 채로 둬서 그 순간을 살펴볼 수 있게 */
  const finish = (viewCheck: number | null) => {
    cancelAnimationFrame(raf)
    const sim = useSim.getState()
    sim.setDriven(false)
    sim.setPaused(true)
    const g = get().grade
    set({ phase: 'done', cursor: -1, viewCheck, revealed: g ? (viewCheck ?? g.checks.length - 1) + 1 : 0 })
  }

  const play = (task: Task, grade: Grade) => {
    let i = 0
    let waitLeft = -1
    let hold = 0
    let carry = 0
    let checkNo = 0
    let last = performance.now()
    const frame = (now: number) => {
      const dt = Math.min(now - last, 100)
      last = now
      const sim = useSim.getState()
      if (hold > 0) {
        hold -= dt
        raf = requestAnimationFrame(frame)
        return
      }
      let budget = dt * sim.speed + carry
      carry = 0
      while (i < task.steps.length) {
        const s = task.steps[i]!
        if (s.kind === 'action') {
          set({ cursor: i })
          sim.act(s.action)
          i++
          hold = HOLD_MS
          break
        }
        if (s.kind === 'check') {
          const c = grade.checks[checkNo]!
          set({ cursor: i, revealed: checkNo + 1, viewCheck: checkNo })
          i++
          checkNo++
          if (!c.ok) {
            finish(checkNo - 1)
            return
          }
          hold = HOLD_MS / 2
          break
        }
        // 기다림: 배속만큼 시뮬레이션 시간을 20ms 단위로 진행
        if (waitLeft < 0) {
          waitLeft = s.ms
          set({ cursor: i })
        }
        const n = Math.floor(Math.min(budget, waitLeft) / TASK_STEP_MS) * TASK_STEP_MS
        if (n > 0) {
          sim.advanceExact(n)
          waitLeft -= n
          budget -= n
        }
        if (waitLeft > 0) {
          carry = budget
          break
        }
        waitLeft = -1
        i++
      }
      if (i >= task.steps.length) finish(grade.checks.length ? grade.checks.length - 1 : null)
      else raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
  }

  return {
    grade: null,
    phase: 'idle',
    cursor: -1,
    revealed: 0,
    viewCheck: null,
    recording: null,
    draft: null,

    startGrading: () => {
      const task = currentTask()
      if (!task) return
      cancelAnimationFrame(raf)
      const grade = gradeTask(useEditor.getState().circuit, task)
      freshSim()
      useSim.getState().setDriven(true)
      set({ grade, phase: 'playing', cursor: -1, revealed: 0, viewCheck: null })
      play(task, grade)
    },

    gradeNow: () => {
      const task = currentTask()
      if (!task) return
      cancelAnimationFrame(raf)
      const grade = gradeTask(useEditor.getState().circuit, task)
      set({ grade })
      get().jumpTo(grade.firstFail ?? grade.checks.length - 1)
    },

    jumpTo: (k) => {
      const task = currentTask()
      const target = get().grade?.checks[k]
      if (!task || !target) return
      cancelAnimationFrame(raf)
      // 처음부터 그 확인점까지 한 번에 진행
      freshSim()
      const sim = useSim.getState()
      sim.setDriven(true)
      for (let i = 0; i <= target.step; i++) {
        const s = task.steps[i]!
        if (s.kind === 'action') sim.act(s.action)
        else if (s.kind === 'wait') sim.advanceExact(s.ms)
      }
      set({ phase: 'done', cursor: -1, revealed: Math.max(get().revealed, k + 1), viewCheck: k })
      sim.setDriven(false)
      sim.setPaused(true)
    },

    stop: () => {
      if (get().phase !== 'playing') return
      cancelAnimationFrame(raf)
      finish(get().viewCheck)
    },

    startRecording: () => {
      cancelAnimationFrame(raf)
      freshSim()
      useSim.getState().setDriven(false)
      set({ recording: [], draft: null, grade: null, phase: 'idle', viewCheck: null })
      setActionListener((time, a) => {
        if (a.type === 'fuseReplace') return
        const rec = get().recording
        if (rec) set({ recording: [...rec, { time, action: a }] })
      })
    },

    finishRecording: () => {
      const rec = get().recording
      if (!rec) return
      setActionListener(null)
      const end = liveResult()?.state.time ?? 0
      useSim.getState().setPaused(true)
      set({ recording: null, draft: scriptFromRecording(rec, end) })
    },

    cancelRecording: () => {
      setActionListener(null)
      set({ recording: null, draft: null })
    },

    saveDraft: (title, description) => {
      const draft = get().draft
      if (!draft) return
      const ed = useEditor.getState()
      const circuit = ed.circuit
      const body = description.trim()
      const task = makeTask(circuit, { title, description: `${body ? body + '\n\n' : ''}${partsSummary(circuit)}` }, draft)
      ed.setCircuit({ ...circuit, task })
      set({ draft: null })
      ed.showToast(`과제 "${title}"를 만들었습니다 · 채점해 보고 '학생용 파일 저장'으로 나눠 주세요`)
    },

    discardDraft: () => set({ draft: null }),
  }
})

// 회로를 고치면 이전 채점 결과는 맞지 않으므로 지운다
useEditor.subscribe((s, prev) => {
  if (s.circuit === prev.circuit) return
  const t = useTask.getState()
  if (t.phase === 'playing') return
  if (t.grade || t.viewCheck !== null) useTask.setState({ grade: null, phase: 'idle', revealed: 0, viewCheck: null })
})

// 과제 탭을 떠나면 재생·기록을 멈춘다
useSim.subscribe((s, prev) => {
  if (s.mode === prev.mode || s.mode === 'task') return
  cancelAnimationFrame(raf)
  setActionListener(null)
  useTask.setState({ phase: 'idle', cursor: -1, viewCheck: null, recording: null })
})
