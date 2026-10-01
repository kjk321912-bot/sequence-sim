// 과제 채점: 틀린 출력(램프·부저·전동기)을 캔버스에 빨간 원과 기대값으로 표시
import { useMemo } from 'react'
import { Circle, Layer, Text } from 'react-konva'
import { outputText, type Circuit } from '../../engine'
import { componentCenter } from '../../editor/placement'
import { useTask } from '../../store/taskStore'
import { colors, GRID } from '../../ui/theme'

export function TaskMarks({ circuit }: { circuit: Circuit }) {
  const grade = useTask((s) => s.grade)
  const viewCheck = useTask((s) => s.viewCheck)
  const revealed = useTask((s) => s.revealed)

  const marks = useMemo(() => {
    if (!grade || viewCheck === null || viewCheck >= revealed) return []
    const check = grade.checks[viewCheck]
    if (!check) return []
    return check.items
      .filter((x) => !x.ok)
      .flatMap((x) =>
        circuit.components
          .filter((c) => 'tag' in c && c.tag === x.tag && c.kind === x.kind)
          .map((c) => ({ key: `${c.id}`, at: componentCenter(c), text: `기대: ${outputText(x.expected)}` })),
      )
  }, [circuit, grade, viewCheck, revealed])

  if (!marks.length) return null
  return (
    <Layer listening={false}>
      {marks.map((m) => (
        <Circle key={m.key} x={m.at.x * GRID} y={m.at.y * GRID} radius={GRID * 1.6} stroke={colors.danger} strokeWidth={4} dash={[10, 6]} />
      ))}
      {marks.map((m) => (
        <Text
          key={`t${m.key}`}
          x={m.at.x * GRID + GRID * 1.8}
          y={m.at.y * GRID - GRID * 1.8}
          text={m.text}
          fontSize={15}
          fontStyle="bold"
          fontFamily="Pretendard, 'Noto Sans KR', 'Malgun Gothic', sans-serif"
          fill={colors.danger}
        />
      ))}
    </Layer>
  )
}
