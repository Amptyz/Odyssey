import { FIXED_DT } from '../content/config';
import type { Swing, WorldSnapshot } from '../simulation/GameWorld';
import { clamp, lerp, type Vec2 } from '../utils/math';
import { MELEE_ART, MELEE_BLADE_KEYS } from '../content/melee-motion';
import { meleeBlade } from '../combat-core/MeleeSweep';

export const MELEE_TRAIL_SECONDS = .12;
export interface MeleeVfxFrame extends Swing {
  phase: 'windup' | 'active' | 'residue';
  progress: number;
}
interface Track { swing: Swing; alpha: number; time: number; endTime?: number; endCenter?: Vec2 }
const copySwing = (s: Swing): Swing => ({ ...s, center: { ...s.center }, previousCenter:s.previousCenter?{...s.previousCenter}:undefined, facing: { ...s.facing } });

/** Interpolate the already simulated interval, exactly like actor positions.
 * Never extrapolate age into a future blade position whose damage is untested. */
export function sampleMelee(swing: Swing, alpha: number): MeleeVfxFrame {
  const blend = clamp(alpha, 0, 1);
  const age = lerp(swing.previousAge ?? swing.age, swing.age, blend);
  const previous = swing.previousCenter ?? swing.center;
  const center = { x: lerp(previous.x, swing.center.x, blend), y: lerp(previous.y, swing.center.y, blend) };
  const phase = age < swing.windup ? 'windup' : 'active';
  const progress = phase === 'windup' ? age / Math.max(.001, swing.windup)
    : clamp((age - swing.windup) / Math.max(.001, swing.active), 0, 1);
  return { ...copySwing(swing), center, age, phase, progress };
}

/** One timeline per view, shared by every player's attack. No engine or wall clock.
 * Residues retain the last legal origin/facing and expire on simulation time. */
export class MeleeVfxTimeline {
  private readonly tracks = new Map<number, Track>();
  private key = '';
  private tick = -1;
  private time = -1;
  private presentationTime = 0;

  update(state: WorldSnapshot, alpha: number, key: string): MeleeVfxFrame[] {
    if (key !== this.key || state.tick < this.tick || state.time < this.time) this.tracks.clear();
    const sameTick = state.tick === this.tick && state.time === this.time;
    this.key = key; this.tick = state.tick; this.time = state.time;
    if (!state.paused || !sameTick) this.presentationTime = Math.max(0, state.time - (state.paused ? 0 : 1 - clamp(alpha, 0, 1)) * FIXED_DT);
    if (!['camp', 'fighting', 'cleared'].includes(state.stagePhase)) { this.tracks.clear(); return []; }
    const frames: MeleeVfxFrame[] = [], seen = new Set<number>();
    for (const swing of state.swings) {
      const actor = state.units.find(u => u.id === swing.sourceId);
      if (!actor?.alive) continue;
      seen.add(swing.id);
      const before = this.tracks.get(swing.id);
      const blend = state.paused && sameTick && before ? before.alpha : state.paused ? 1 : clamp(alpha, 0, 1);
      const frame = sampleMelee(swing, blend);
      this.tracks.set(swing.id, { swing: copySwing(swing), alpha: blend, time: state.time });
      frames.push(frame);
    }
    for (const [id, track] of this.tracks) {
      if (seen.has(id)) continue;
      const actor = state.units.find(u => u.id === track.swing.sourceId);
      // Cancellation (death, dash, transition) must not look like a completed slash.
      if (!actor?.alive || track.swing.age + Math.max(0,state.time-track.time) + 1e-6 < track.swing.windup + track.swing.active) {
        this.tracks.delete(id); continue;
      }
      track.endTime ??= track.time + Math.max(0,track.swing.windup+track.swing.active-track.swing.age);
      if (!track.endCenter) {
        const endBlend = clamp((track.endTime-track.time)/Math.max(FIXED_DT,state.time-track.time),0,1);
        track.endCenter = {x:lerp(track.swing.center.x,actor.x,endBlend),y:lerp(track.swing.center.y,actor.y,endBlend)};
      }
      // The last simulation step can retire a swing while interpolation is still
      // displaying its final active portion. Preserve that portion, then fade.
      if (this.presentationTime < track.endTime) {
        const age = track.swing.age + Math.max(0,this.presentationTime-track.time);
        const blend = clamp((age-track.swing.age)/Math.max(.001,track.endTime-track.time),0,1);
        frames.push(sampleMelee({...track.swing,previousAge:track.swing.age,age,
          previousCenter:undefined,center:{x:lerp(track.swing.center.x,track.endCenter.x,blend),y:lerp(track.swing.center.y,track.endCenter.y,blend)}},1));
        continue;
      }
      const elapsed = Math.max(0, this.presentationTime - track.endTime);
      if (elapsed >= MELEE_TRAIL_SECONDS) { this.tracks.delete(id); continue; }
      frames.push({ ...copySwing(track.swing), center:{...track.endCenter}, age: track.swing.windup + track.swing.active + elapsed,
        phase: 'residue', progress: 1 });
    }
    return frames;
  }
}

/** F3 and gameplay use the same moving blade, not the historical full sector. */
export function meleeShape(frame: MeleeVfxFrame) {
  return meleeBlade(frame,frame.phase==='windup'?0:frame.progress);
}

/** Nonuniform approved key times. Exact key instants select the original artwork;
 * in-between renders blend adjacent artworks, never substitute a different curve. */
export function meleeArtSample(frame: MeleeVfxFrame) {
  const time=frame.phase==='windup'?Math.min(80,frame.progress*120):frame.phase==='active'?120+frame.progress*120
    :240+clamp((frame.age-frame.windup-frame.active)/MELEE_TRAIL_SECONDS,0,1)*120;
  const times=MELEE_ART.times;
  let a=0;while(a<times.length-2&&time>=times[a+1]!)a++;
  const b=a+1,mix=clamp((time-times[a]!)/(times[b]!-times[a]!),0,1);
  return {a,b,mix,time};
}
/** Local head registration for motion-compensated in-between frames. Exact key
 * instants have zero warp. The old tail and the player pivot stay in place. */
export function meleeArtHead(index:number) {
  const key=MELEE_BLADE_KEYS[Math.max(0,Math.min(4,index-2))]!;
  const mean=key.points.reduce((p,q)=>({x:p.x+q[0]/key.points.length,y:p.y+q[1]/key.points.length}),{x:0,y:0});
  return{x:(MELEE_ART.pivot.x+mean.x*MELEE_ART.radius)/MELEE_ART.cellWidth,
    y:(MELEE_ART.pivot.y-mean.y*MELEE_ART.radius)/MELEE_ART.cellHeight};
}
