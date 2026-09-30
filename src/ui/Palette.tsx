// 부품 팔레트: 톡 치면 화면 가운데에 놓고, 캔버스로 끌어다 놓으면 그 자리에 놓는다
import { useRef, useState } from 'react'
import { PALETTE, PALETTE_GROUPS, previewComponent, type PaletteItem } from '../editor/palette'
import { getCanvasRect, screenToGrid } from '../editor/viewMath'
import { useEditor } from '../store/editorStore'
import { SvgSymbol } from '../symbols/SvgSymbol'

interface Ghost {
  item: PaletteItem
  x: number
  y: number
}

export function Palette() {
  const [ghost, setGhost] = useState<Ghost | null>(null)

  return (
    <aside className="palette" aria-label="부품">
      {PALETTE_GROUPS.map((g) => (
        <section key={g}>
          <h3>{g}</h3>
          <div className="palette-grid">
            {PALETTE.filter((p) => p.group === g).map((item) => (
              <PaletteButton key={item.key} item={item} onGhost={setGhost} />
            ))}
          </div>
        </section>
      ))}
      {ghost && (
        <div className="palette-ghost" style={{ left: ghost.x, top: ghost.y }}>
          <SvgSymbol comp={previewComponent(ghost.item)} size={72} />
        </div>
      )}
    </aside>
  )
}

function PaletteButton({ item, onGhost }: { item: PaletteItem; onGhost: (g: Ghost | null) => void }) {
  const start = useRef<{ id: number; x: number; y: number; dragging: boolean } | null>(null)

  const place = (clientX: number, clientY: number, dropped: boolean) => {
    const rect = getCanvasRect()
    if (!rect) return
    const store = useEditor.getState()
    if (dropped) {
      const inside = clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom
      if (!inside) return
      store.addFromPalette(item.key, screenToGrid(store.view, clientX - rect.left, clientY - rect.top))
    } else {
      // 톡 치기: 화면 가운데. 같은 자리에 이미 부품이 있으면 옆으로 비켜 놓는다
      const center = screenToGrid(store.view, rect.width / 2, rect.height / 2)
      const taken = (x: number) =>
        store.circuit.components.some((c) => Math.abs(c.x - Math.round(x)) < 2 && Math.abs(c.y - Math.round(center.y)) < 2)
      let x = center.x
      for (let i = 0; i < 12 && taken(x); i++) x += 4
      store.addFromPalette(item.key, { x, y: center.y })
    }
  }

  return (
    <button
      className="palette-item"
      title={item.name}
      onPointerDown={(e) => {
        e.currentTarget.setPointerCapture(e.pointerId)
        start.current = { id: e.pointerId, x: e.clientX, y: e.clientY, dragging: false }
      }}
      onPointerMove={(e) => {
        const s = start.current
        if (!s || s.id !== e.pointerId) return
        const dx = e.clientX - s.x
        const dy = e.clientY - s.y
        if (!s.dragging && Math.hypot(dx, dy) > 8) {
          // 손가락은 목록 방향으로 밀면 스크롤, 캔버스 쪽으로 끌면 부품 끌기
          // (태블릿: 세로 목록 / 스마트폰: 아래쪽 가로 목록)
          const listIsHorizontal = window.matchMedia('(max-width: 700px)').matches
          const alongList = listIsHorizontal ? Math.abs(dx) > Math.abs(dy) : Math.abs(dy) > Math.abs(dx)
          if (e.pointerType === 'touch' && alongList) return
          s.dragging = true
        }
        if (s.dragging) onGhost({ item, x: e.clientX, y: e.clientY })
      }}
      onPointerUp={(e) => {
        const s = start.current
        start.current = null
        onGhost(null)
        if (!s) return
        place(e.clientX, e.clientY, s.dragging)
      }}
      onPointerCancel={() => {
        start.current = null
        onGhost(null)
      }}
    >
      <SvgSymbol comp={previewComponent(item)} size={40} />
      <span>{item.name}</span>
    </button>
  )
}
