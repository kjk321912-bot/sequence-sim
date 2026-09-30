import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './ui/theme.css'
import { applyThemeVars } from './ui/theme'
import App from './App.tsx'

applyThemeVars()

const root = document.getElementById('root')
if (!root) throw new Error('#root 요소가 없습니다')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
