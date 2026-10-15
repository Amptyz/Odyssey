export interface Vec2 { x: number; y: number }
export const clamp = (v: number, min: number, max: number): number => Math.max(min, Math.min(max, v));
export const distance = (a: Vec2, b: Vec2): number => Math.hypot(a.x - b.x, a.y - b.y);
export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
export function direction(a: Vec2, b: Vec2): Vec2 {
  const d = distance(a, b);
  return d < 1e-8 ? { x: 0, y: 0 } : { x: (b.x - a.x) / d, y: (b.y - a.y) / d };
}
export function segmentDistance(p: Vec2, a: Vec2, b: Vec2): number {
  const dx = b.x - a.x, dy = b.y - a.y;
  const t = clamp(((p.x-a.x)*dx + (p.y-a.y)*dy) / (dx*dx+dy*dy || 1), 0, 1);
  return distance(p, { x: a.x+dx*t, y: a.y+dy*t });
}
