import { describe, expect, it } from 'vitest';
import { GameWorld, type Swing } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { startCombatFixture } from './helpers/scenes';
import { FIXED_DT } from '../EmberDemo/assets/scripts/ember/content/config';
import { sampleMelee, meleeShape, meleeArtSample, MeleeVfxTimeline } from '../EmberDemo/assets/scripts/ember/render/MeleeVfxPlan';
import { shapeContours } from '../EmberDemo/assets/scripts/ember/combat-core/ShapeContours';
import { AttributeSet } from '../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';

function fixture() {
  const world = new GameWorld(); startCombatFixture(world);
  for (const a of world.actors.values()) if (a.team === 'enemy') a.attributes = new AttributeSet({ ...a.attributes.template, canMove: false, canAttack: false });
  world.command({ type: 'Attack', point: { x: world.hero.x + 5, y: world.hero.y } });
  return world;
}
const swing: Swing = { id: 12, sourceId: 'hero', center: { x: 0, y: 0 }, facing: { x: 1, y: 0 }, radius: 5, arc: Math.PI * .65, age: .15, windup: .12, active: .12, damage: 20, appearance: 'physical' };

describe('ordinary melee visual timing and authoritative geometry', () => {
  it('interpolates settled poses and origins without showing an untested future blade', () => {
    const settled={...swing,previousAge:.12,previousCenter:{x:-.2,y:-.1}};
    expect(sampleMelee({ ...settled, age: .1,previousAge:.08 }, 1).phase).toBe('windup');
    const a = sampleMelee(settled, 0), b = sampleMelee(settled, .5);
    expect(b.progress).toBeGreaterThan(a.progress);
    expect(meleeShape(a)).not.toEqual(meleeShape(b)); // the blade moves along the approved poses
    expect(meleeArtSample(a)).not.toEqual(meleeArtSample(b));
    expect(a.age).toBe(.12);expect(b.age).toBe(.135);expect(b.center).toEqual({x:-.1,y:-.05});
    expect(sampleMelee(settled,1).age).toBe(swing.age);
    expect(sampleMelee({...settled,previousAge:.1,age:2/15},.5).phase).toBe('windup');
    expect(swing.age).toBe(.15);
  });
  it('keeps the moving blade inside reach in arbitrary directions and clips debug terrain contours', () => {
    for (let d = 0; d < 16; d++) {
      const a = d * Math.PI / 8, facing = { x: Math.cos(a), y: Math.sin(a) };
      const frame = sampleMelee({ ...swing, facing }, 0);
      for (const clip of [1, .42]) {
        const contours = shapeContours(meleeShape(frame), { blocker: () => clip });
        for (const points of contours) for (const p of points) {
          const r = Math.hypot(p.x, p.y), angle = Math.atan2(p.y, p.x);
          expect(r).toBeLessThanOrEqual(swing.radius * clip + 1e-9);

        }
      }
    }
  });
  it('freezes on pause, advances on single step and retires completed trails without changing the world', () => {
    const world = fixture(), timeline = new MeleeVfxTimeline();
    for (let i = 0; i < 5; i++) world.advance(FIXED_DT);
    const before = world.snapshot(), a = timeline.update(before, .5, 'run1');
    expect(a[0]?.phase).toBe('active');
    expect(timeline.update({ ...before, paused: true }, 1, 'run1')).toEqual(a);
    world.advance(FIXED_DT);
    const stepped = timeline.update({ ...world.snapshot(), paused: true }, 1, 'run1');
    expect(stepped[0]!.age).toBeGreaterThan(a[0]!.age);
    for (let i = 0; i < 3; i++) { world.advance(FIXED_DT); timeline.update(world.snapshot(), 0, 'run1'); }
    const residue = timeline.update(world.snapshot(), .5, 'run1');
    expect(residue[0]?.phase).toBe('residue');
    expect(meleeArtSample(residue[0]!).time).toBeGreaterThanOrEqual(240);
    expect(timeline.update({ ...world.snapshot(), paused: true }, 1, 'run1')).toEqual(residue);
    for (let i = 0; i < 5; i++) world.advance(FIXED_DT);
    expect(timeline.update(world.snapshot(), 0, 'run1')).toEqual([]);
    expect(before.swings[0]!.age).toBeCloseTo(5 * FIXED_DT);
  });
  it('clears residue across restarts and transition keys and cancels unfinished attacks', () => {
    const world = fixture(), timeline = new MeleeVfxTimeline(), s = world.snapshot();
    timeline.update(s, 0, 'run1');
    expect(timeline.update({ ...s, swings: [], tick: s.tick + 1, time: s.time + FIXED_DT }, 0, 'run1')).toEqual([]);
    timeline.update({ ...s, swings: [{ ...s.swings[0]!, age: .23 }] }, 0, 'run1');
    expect(timeline.update({ ...s, swings: [] }, 0, 'run2')).toEqual([]);
    timeline.update(s, 0, 'run2');
    expect(timeline.update({ ...s, stagePhase: 'defeat' }, 0, 'run2')).toEqual([]);
  });
  it('keeps two players independent and leaves a completed tail at its last origin', () => {
    const world = fixture(), s = world.snapshot(), timeline = new MeleeVfxTimeline();
    const peer = { ...s.hero, id: 'peer', x: s.hero.x + 2 };
    const first = { ...s.swings[0]!, age: .23 };
    const second = { ...first, id: first.id + 100, sourceId: peer.id, center: { x: peer.x, y: peer.y }, facing: { x: 0, y: 1 } };
    const state = { ...s, units: [...s.units, peer], swings: [first, second] };
    const initial = timeline.update(state, 0, 'party'); expect(initial).toHaveLength(2);
    peer.x += 4;
    const completed={ ...state, time: state.time + FIXED_DT, tick: state.tick + 1, swings: [second] };
    expect(timeline.update(completed,0,'party').find(f=>f.id===first.id)?.phase).toBe('active');
    const next = timeline.update(completed,1,'party');
    expect(next.find(f => f.id === first.id)).toMatchObject({ phase: 'residue', center: first.center, facing: first.facing });
    expect(next.find(f => f.id === second.id)).toMatchObject({ phase: 'active', sourceId: 'peer', facing: { x: 0, y: 1 } });
  });
  it('carries actual hit identity for melee impact feedback while a miss emits none', () => {
    const world = fixture();
    const enemy = world.spawnEnemy('melee', { x: world.hero.x + 3, y: world.hero.y }, 1000);
    enemy.attributes = new AttributeSet({ ...enemy.attributes.template, canMove: false, canAttack: false });
    const id = world.snapshot().swings[0]!.id;
    for (let i = 0; i < 6; i++) world.advance(FIXED_DT);
    const cues = world.snapshot().cues.filter(c => c.kind === 'damage' && c.actorId === enemy.id);
    expect(cues).toHaveLength(1); expect(cues[0]).toMatchObject({ sourceId: world.hero.id, attackId: id, cause: 'basic' });
    const miss = fixture();
    for (const a of miss.actors.values()) if (a.team === 'enemy') { a.x = 0; a.y = 0; }
    for (let i = 0; i < 9; i++) miss.advance(FIXED_DT);
    expect(miss.snapshot().cues.filter(c => c.kind === 'damage' && c.cause === 'basic')).toEqual([]);
  });
});
