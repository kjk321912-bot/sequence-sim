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
      toast.kind === 'error' ? 5000 : 3000,
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
