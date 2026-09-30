// 회로 파일 저장·불러오기 (브라우저 다운로드 / 파일 선택)
import { FILE_EXTENSION, parseCircuit, stringifyCircuit } from '../engine'
import { useEditor } from '../store/editorStore'

/** 파일 이름에 쓸 수 없는 글자 정리 */
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || '회로'

/** 현재 회로를 파일로 내려받는다 (태블릿: 다운로드 폴더) */
export function saveToFile() {
  const { circuit, showToast } = useEditor.getState()
  const blob = new Blob([stringifyCircuit(circuit)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${safeName(circuit.name)}${FILE_EXTENSION}`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  showToast(`"${a.download}" 파일로 저장했습니다`)
}

/** 파일을 골라 회로를 불러온다 */
export function openFromFile(onLoaded?: () => void) {
  const input = document.createElement('input')
  input.type = 'file'
  input.accept = '.json,application/json'
  input.onchange = async () => {
    const file = input.files?.[0]
    if (!file) return
    const { setCircuit, showToast } = useEditor.getState()
    try {
      const result = parseCircuit(await file.text())
      if (!result.ok) {
        showToast(result.error, 'error')
        return
      }
      setCircuit(result.circuit)
      showToast(`"${result.circuit.name}" 회로를 불러왔습니다 · 되돌리기로 취소할 수 있습니다`)
      onLoaded?.()
    } catch {
      showToast('파일을 읽지 못했습니다', 'error')
    }
  }
  input.click()
}
