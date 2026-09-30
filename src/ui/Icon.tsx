// 툴바 아이콘 (24×24 선 아이콘)
const PATHS = {
  rotate: 'M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7',
  trash: 'M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3',
  zoomIn: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l5 5M11 8v6M8 11h6',
  zoomOut: 'M11 4a7 7 0 1 0 0 14a7 7 0 1 0 0-14zM16 16l5 5M8 11h6',
  fit: 'M4 9V4h5M15 4h5v5M20 15v5h-5M9 20H4v-5',
  file: 'M6 3h8l4 4v14H6zM14 3v4h4',
  sample: 'M4 5h16v14H4zM4 10h16M9 10v9',
  wire: 'M5 17V10h14V7M3 19a2 2 0 1 0 4 0a2 2 0 1 0-4 0M17 5a2 2 0 1 0 4 0a2 2 0 1 0-4 0',
  undo: 'M9 14L4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3',
  redo: 'M15 14l5-5l-5-5M20 9H9a5 5 0 0 0 0 10h3',
  menu: 'M4 7h16M4 12h16M4 17h16',
  save: 'M12 4v11M7 10l5 5l5-5M5 20h14',
  open: 'M12 20V9M7 14l5-5l5 5M5 4h14',
  edit: 'M4 20h4L19 9l-4-4L4 16zM13 7l4 4',
  play: 'M7 4v16l13-8z',
  pause: 'M7 4v16M17 4v16',
  restart: 'M4 12a8 8 0 1 0 2.3-5.7M4 4v5h5',
} as const

export type IconName = keyof typeof PATHS

export function Icon({ name, size = 24 }: { name: IconName; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  )
}
