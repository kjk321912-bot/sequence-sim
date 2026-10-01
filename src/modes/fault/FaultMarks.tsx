// 고장진단: 테스터 리드(빨강·검정)와 측정값, 지목·심기 대상 표시
import { Circle, Group, Label, Layer, Line, Tag, Text } from 'react-konva'
import type { Circuit } from '../../engine'
import { componentCenter } from '../../editor/placement'
import { useFault } from '../../store/faultStore'
import { colors, GRID } from '../../ui/theme'

const FONT = "Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"
const px = (v: number) => v * GRID

export function FaultMarks({ circuit }: { circuit: Circuit }) {
  const probes = useFault((s) => s.probes)
  const reading = useFault((s) => s.reading)
  const target = useFault((s) => s.target)
  const [a, b] = probes

  const comp = target && circuit.components.find((c) => c.id === target.id)
  const wire = target && circuit.wires.find((w) => w.id === target.id)

  return (
    <Layer listening={false}>
      {comp && <Circle x={px(componentCenter(comp).x)} y={px(componentCenter(comp).y)} radius={GRID * 1.6} stroke={colors.warn} strokeWidth={4} dash={[10, 6]} />}
      {wire && (
        <Line points={wire.points.flatMap((p) => [px(p.x), px(p.y)])} stroke={colors.warn} strokeWidth={9} opacity={0.6} lineCap="round" lineJoin="round" />
      )}
      {a && b && <Line points={[px(a.x), px(a.y), px(b.x), px(b.y)]} stroke={colors.text} strokeWidth={1.5} dash={[6, 6]} opacity={0.6} />}
      {[a, b].map((p, i) =>
        p ? (
          <Group key={i} x={px(p.x)} y={px(p.y)}>
            <Circle radius={9} fill={i === 0 ? colors.danger : '#111'} stroke={colors.text} strokeWidth={2} />
            <Text text={i === 0 ? '+' : '−'} x={-5} y={-8} width={10} align="center" fontSize={15} fontStyle="bold" fontFamily={FONT} fill="#fff" />
          </Group>
        ) : null,
      )}
      {a && b && reading && (
        <Label x={px((a.x + b.x) / 2) + 14} y={px((a.y + b.y) / 2) - 14}>
          <Tag fill={colors.bgPanel} stroke={reading.refused ? colors.warn : colors.accent} cornerRadius={8} />
          <Text text={reading.refused ? '측정 불가' : reading.text.split(' (')[0]} padding={8} fontSize={16} fontStyle="bold" fontFamily={FONT} fill={reading.refused ? colors.warn : colors.accent} />
        </Label>
      )}
    </Layer>
  )
}
