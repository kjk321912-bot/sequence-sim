// 회로 파일 저장·불러오기 (브라우저 다운로드 / 파일 선택)
import { FILE_EXTENSION, parseCircuit, stringifyCircuit } from '../engine'
import { useEditor } from '../store/editorStore'

/** 파일 이름에 쓸 수 없는 글자 정리 */
const safeName = (s: string) => s.replace(/[\\/:*?"<>|]+/g, '_').trim() || '회로'

/** 아이패드·아이폰 (최신 아이패드는 Mac처럼 보이므로 터치 지점 수로 구분) */
const isIOS = () => /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)

/** 현재 회로를 파일로 내려받는다 (갤탭: 다운로드 폴더, 아이패드: 공유 → 파일에 저장) */
export async function saveToFile() {
  const { circuit, showToast } = useEditor.getState()
  const blob = new Blob([stringifyCircuit(circuit)], { type: 'application/json' })
  const fileName = `${safeName(circuit.name)}${FILE_EXTENSION}`

  // iOS 홈 화면 앱에서는 다운로드 링크가 동작하지 않으므로 공유 시트로 저장한다
  if (isIOS()) {
    const file = new File([blob], fileName, { type: 'application/json' })
    if (navigator.canShare?.({ files: [file] })) {
      showToast("공유 메뉴에서 '파일에 저장'을 고르세요")
      try {
        await navigator.share({ files: [file] })
      } catch (e) {
        if (!(e instanceof DOMException && e.name === 'AbortError')) showToast('파일을 저장하지 못했습니다', 'error')
      }
      return
    }
  }

  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = fileName
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
