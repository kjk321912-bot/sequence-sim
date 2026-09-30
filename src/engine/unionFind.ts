/** 서로소 집합(union-find). 전기적으로 연결된 노드를 한 그룹으로 묶는 데 쓴다. */
export class UnionFind {
  private parent: number[]

  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }

  find(i: number): number {
    let root = i
    while (this.parent[root] !== root) root = this.parent[root]!
    // 경로 압축
    while (this.parent[i] !== root) {
      const next = this.parent[i]!
      this.parent[i] = root
      i = next
    }
    return root
  }

  union(a: number, b: number): void {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[rb] = ra
  }
}
