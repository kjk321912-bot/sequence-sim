// 이중 연결 성분(블록) 분해 — Tarjan 알고리즘
//
// "전류가 흐르는 배선"을 찾는 데 쓴다. 전원(S)과 부하 단자(K) 사이의 어떤 단순 경로 위에 있는
// 간선들은, S-K 사이에 가상 간선을 하나 더했을 때 그 가상 간선과 같은 블록에 속한다.
// 이렇게 하면 한쪽 끝이 막힌 곁가지 배선은 통전 표시에서 빠진다.

/** 각 간선의 블록 번호를 돌려준다. edges[i] = [a, b] */
export function edgeBlocks(nodeCount: number, edges: readonly (readonly [number, number])[]): number[] {
  const adj: { to: number; e: number }[][] = Array.from({ length: nodeCount }, () => [])
  edges.forEach(([a, b], e) => {
    adj[a]!.push({ to: b, e })
    if (a !== b) adj[b]!.push({ to: a, e })
  })

  const disc = new Array<number>(nodeCount).fill(-1)
  const low = new Array<number>(nodeCount).fill(0)
  const block = new Array<number>(edges.length).fill(-1)
  const edgeStack: number[] = []
  let time = 0
  let blockCount = 0

  const popBlock = (until: number) => {
    for (;;) {
      const e = edgeStack.pop()
      if (e === undefined) break
      block[e] = blockCount
      if (e === until) break
    }
    blockCount++
  }

  // 재귀 대신 명시적 스택 (큰 회로에서 호출 스택 초과 방지)
  type Frame = { u: number; parentEdge: number; i: number; viaEdge: number }
  for (let root = 0; root < nodeCount; root++) {
    if (disc[root] !== -1) continue
    disc[root] = low[root] = time++
    const stack: Frame[] = [{ u: root, parentEdge: -1, i: 0, viaEdge: -1 }]
    while (stack.length) {
      const f = stack[stack.length - 1]!
      const nbrs = adj[f.u]!
      if (f.i < nbrs.length) {
        const { to: v, e } = nbrs[f.i++]!
        if (e === f.parentEdge) continue
        if (v === f.u) continue // 자기 루프는 아래에서 따로 처리
        if (disc[v] === -1) {
          edgeStack.push(e)
          disc[v] = low[v] = time++
          stack.push({ u: v, parentEdge: e, i: 0, viaEdge: e })
        } else if (disc[v]! < disc[f.u]!) {
          edgeStack.push(e)
          low[f.u] = Math.min(low[f.u]!, disc[v]!)
        }
      } else {
        stack.pop()
        const parent = stack[stack.length - 1]
        if (parent) {
          low[parent.u] = Math.min(low[parent.u]!, low[f.u]!)
          if (low[f.u]! >= disc[parent.u]!) popBlock(f.viaEdge)
        }
      }
    }
  }

  // 자기 루프 간선은 각자 독립 블록
  for (let e = 0; e < edges.length; e++) if (block[e] === -1) block[e] = blockCount++
  return block
}
