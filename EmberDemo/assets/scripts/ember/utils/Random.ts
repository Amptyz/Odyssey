/** Mulberry32: every gameplay random choice comes through this seeded stream. */
export class Random {
  private state: number;
  constructor(readonly seed: number) { this.state = seed >>> 0; }
  next(): number {
    let t = this.state = (this.state + 0x6D2B79F5) >>> 0;
    t = Math.imul(t ^ t >>> 15, t | 1);
    t ^= t + Math.imul(t ^ t >>> 7, t | 61);
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  }
  pick<T>(items: readonly T[], count: number): T[] {
    const pool = [...items];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = Math.floor(this.next() * (i + 1));
      [pool[i], pool[j]] = [pool[j]!, pool[i]!];
    }
    return pool.slice(0, count);
  }
}
