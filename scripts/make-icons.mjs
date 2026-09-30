// PWA 아이콘 생성 스크립트 (외부 라이브러리 없이 PNG 직접 인코딩)
// 실행: node scripts/make-icons.mjs → public/icon-192.png, icon-512.png, icon.svg
import { writeFileSync, mkdirSync } from 'node:fs'
import { deflateSync } from 'node:zlib'

// 아이콘 도안 (512 기준 좌표): 위 P모선, 아래 N모선, 가운데 a접점과 코일
const BG = [15, 20, 25]
const BUS = [255, 196, 64]
const WIRE = [80, 220, 140]
const COIL = [255, 90, 80]

/** 좌표(512 기준)의 색을 반환. 안티앨리어싱은 슈퍼샘플링으로 처리 */
function colorAt(x, y) {
  // 둥근 사각형 배경 (라운드 반경 96)
  const r = 96
  const cx = Math.min(Math.max(x, r), 512 - r)
  const cy = Math.min(Math.max(y, r), 512 - r)
  if (Math.hypot(x - cx, y - cy) > r) return null

  // P모선, N모선
  if (x > 88 && x < 424 && ((y > 96 && y < 124) || (y > 388 && y < 416))) return BUS
  // 세로 배선 (접점과 코일 사이 구간 제외)
  const onVert = Math.abs(x - 256) < 11
  if (onVert && ((y >= 110 && y < 176) || (y > 236 && y < 262) || (y > 346 && y <= 402))) return WIRE
  // a접점: 아래 배선에서 비스듬히 올라간 가동편 (위쪽 배선과 떨어져 있음 = 열린 상태)
  {
    // (256,240) → (214,180) 선분과의 거리
    const ax = 256, ay = 240, bx = 214, by = 180
    const t = Math.max(0, Math.min(1, ((x - ax) * (bx - ax) + (y - ay) * (by - ay)) / ((bx - ax) ** 2 + (by - ay) ** 2)))
    if (Math.hypot(x - (ax + t * (bx - ax)), y - (ay + t * (by - ay))) < 10) return WIRE
  }
  // 코일 원
  const d = Math.hypot(x - 256, y - 304)
  if (d > 30 && d < 52) return COIL
  return BG
}

function render(size) {
  const ss = 4 // 슈퍼샘플링
  const px = Buffer.alloc(size * size * 4)
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      let r = 0, g = 0, b = 0, a = 0
      for (let sy = 0; sy < ss; sy++) {
        for (let sx = 0; sx < ss; sx++) {
          const c = colorAt(((i + (sx + 0.5) / ss) * 512) / size, ((j + (sy + 0.5) / ss) * 512) / size)
          if (c) { r += c[0]; g += c[1]; b += c[2]; a++ }
        }
      }
      const o = (j * size + i) * 4
      if (a) { px[o] = r / a; px[o + 1] = g / a; px[o + 2] = b / a }
      px[o + 3] = (a / (ss * ss)) * 255
    }
  }
  return encodePng(size, size, px)
}

function crc32(buf) {
  let c, crc = 0xffffffff
  for (const byte of buf) {
    c = (crc ^ byte) & 0xff
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    crc = (crc >>> 8) ^ c
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length)
  const td = Buffer.concat([Buffer.from(type, 'ascii'), data])
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td))
  return Buffer.concat([len, td, crc])
}

function encodePng(w, h, rgba) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8; ihdr[9] = 6 // 8비트 RGBA
  const raw = Buffer.alloc((w * 4 + 1) * h)
  for (let y = 0; y < h; y++) rgba.copy(raw, y * (w * 4 + 1) + 1, y * w * 4, (y + 1) * w * 4)
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
<rect width="512" height="512" rx="96" fill="rgb(${BG})"/>
<g fill="rgb(${BUS})"><rect x="88" y="96" width="336" height="28"/><rect x="88" y="388" width="336" height="28"/></g>
<g stroke="rgb(${WIRE})" stroke-width="22" fill="none">
<path d="M256 110V176M256 236V262M256 346V402"/><path d="M256 240L214 180" stroke-width="20" stroke-linecap="round"/></g>
<circle cx="256" cy="304" r="41" fill="none" stroke="rgb(${COIL})" stroke-width="22"/>
</svg>
`

mkdirSync('public', { recursive: true })
writeFileSync('public/icon-192.png', render(192))
writeFileSync('public/icon-512.png', render(512))
writeFileSync('public/icon.svg', svg)
console.log('아이콘 생성 완료')
