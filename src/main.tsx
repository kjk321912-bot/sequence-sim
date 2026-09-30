import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { applyThemeVars } from './ui/theme'
import App from './App.tsx'
import { useEditor } from './store/editorStore'

applyThemeVars()

// 점검·디버깅용: 브라우저 콘솔에서 seqDebug.getState()로 편집 상태를 볼 수 있다
declare global {
  interface Window {
    seqDebug?: { getState: typeof useEditor.getState }
  }
}
window.seqDebug = { getState: useEditor.getState }

const root = document.getElementById('root')
if (!root) throw new Error('#root 요소가 없습니다')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
