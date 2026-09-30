// 화면 위쪽에 잠깐 뜨는 알림
import { useEffect } from 'react'
import { useEditor } from '../store/editorStore'

export function Toast() {
  const toast = useEditor((s) => s.toast)
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(
      () => {
        if (useEditor.getState().toast?.id === toast.id) useEditor.setState({ toast: null })
      },
      // 긴 안내(예제 조작 방법 등)는 읽을 시간을 더 준다
      Math.max(toast.kind === 'error' ? 5000 : 3000, toast.text.length * 90),
    )
    return () => clearTimeout(t)
  }, [toast])
  if (!toast) return null
  return (
    <div className={`toast ${toast.kind}`} role={toast.kind === 'error' ? 'alert' : 'status'} key={toast.id}>
      {toast.text}
    </div>
  )
}
