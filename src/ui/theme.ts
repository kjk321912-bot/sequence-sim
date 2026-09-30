// 테마 토큰: 색·크기는 여기서만 정의한다.
// 캔버스(Konva)는 이 객체를 직접 쓰고, CSS는 applyThemeVars()가 넣어 주는 CSS 변수로 쓴다.

export const colors = {
  bg: '#0f1419',
  bgPanel: '#182029',
  bgRaised: '#222c38',
  line: '#2e3a48',
  text: '#e6edf3',
  textDim: '#8b9aab',
  accent: '#4dabf7',

  // 캔버스
  grid: '#27323f',
  gridMajor: '#364454',
  symbol: '#c5d0dc', // 부품 기호 선
  symbolLabel: '#9fb3c8', // 부품 이름표
  select: '#4dabf7',

  // 회로 상태
  wireDead: '#5b6776', // 무전압
  wireLive: '#d9a93c', // 활선: 전위만 있음
  wireFlow: '#4ade80', // 통전: 전류 흐름
  flowDash: '#e8fff0', // 통전 배선 위를 흘러가는 전류 표시
  danger: '#ff4d4f', // 단락·고장
  warn: '#fbbf24', // 발진·결상 경고

  // 모선 (전위별 구분)
  busP: '#ff6b6b',
  busN: '#4dabf7',
  busR: '#c08457',
  busS: '#a0a0a0',
  busT: '#e0e0e0',

  // 램프 점등색
  lampRL: '#ff3b30',
  lampGL: '#34d058',
  lampYL: '#ffd60a',
  lampWL: '#f5f5f5',
} as const

export type ColorToken = keyof typeof colors

/** 격자 한 칸의 화면 크기(px, 배율 1 기준) */
export const GRID = 24
/** 터치 타깃 최소 크기(px) */
export const TOUCH_MIN = 44

/** CSS에서 var(--color-xxx) 로 쓸 수 있게 문서 루트에 넣는다 */
export function applyThemeVars(root: HTMLElement = document.documentElement) {
  for (const [k, v] of Object.entries(colors)) {
    root.style.setProperty(`--${k.replace(/[A-Z]/g, (m) => '-' + m.toLowerCase())}`, v)
  }
  root.style.setProperty('--touch-min', `${TOUCH_MIN}px`)
}
