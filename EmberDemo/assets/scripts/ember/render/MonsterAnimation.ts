import type {EnemyPose} from '../simulation/EnemySystem';

/** A sampled strike can precede the action's nominal final windup (seeds/marks).
 * Pose selection consumes simulation pulses; it never causes combat events. */
export function monsterActionStep(pose:Pick<EnemyPose,'state'|'strike'>):'windup'|'strike'|'recovery' {
 if(pose.strike>.05)return 'strike';
 return pose.state==='windup'?'windup':'recovery';
}

/** Three collapse poses finish before the existing .9s corpse fade. */
export function monsterDeathFrame(age:number):number {
 return Math.min(2,Math.max(0,Math.floor(age*4)));
}
