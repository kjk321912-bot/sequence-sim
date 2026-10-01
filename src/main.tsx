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

// 아이패드 Safari는 user-scalable=no를 무시하고 두 손가락으로 화면 전체를 확대한다.
// Safari 전용 gesture 이벤트를 막아 앱 화면이 확대되지 않게 한다 (캔버스 핀치 줌은 Pointer Events로 따로 처리).
for (const type of ['gesturestart', 'gesturechange', 'gestureend']) {
  document.addEventListener(type, (e) => e.preventDefault(), { passive: false })
}
// 길게 누르기는 속성 창이므로 브라우저 메뉴(복사·이미지 저장 등)는 띄우지 않는다 (입력칸은 제외)
document.addEventListener('contextmenu', (e) => {
  if (!(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement)) e.preventDefault()
})

const root = document.getElementById('root')
if (!root) throw new Error('#root 요소가 없습니다')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
