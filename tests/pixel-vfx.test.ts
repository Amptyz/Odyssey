import {openMerchantFixture,startCombatFixture} from './helpers/scenes';
import { describe,it,expect } from 'vitest';
import { GameWorld,type VisualCue } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import { planPixelVfx,PIXEL_VFX_LIMIT } from '../EmberDemo/assets/scripts/ember/render/PixelVfxPlan';
import { DEFAULT_PROJECTION,worldToScreen } from '../EmberDemo/assets/scripts/ember/render/IsoProjection';
import type { HitShape } from '../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import { LocalTransport } from '../EmberDemo/assets/scripts/ember/platform/LocalTransport';

const camera={...DEFAULT_PROJECTION,origin:{x:0,y:0}};
const cue=(id:number,extra:Partial<VisualCue>={}):VisualCue=>({id,kind:'explosion',at:{x:0,y:0},duration:.45,ttl:.3,appearance:'fire',...extra});
describe('decorative VFX scheduling under actual gameplay and danger geometry',()=>{
  it('keeps the right-facing slash for the real fire-appearance cleave skill',()=>{
    const transport=new LocalTransport(1234);transport.send({type:'DevOpen'});
    const config=transport.snapshot().developer!.draft;config.loadout.Q='cleave';
    transport.send({type:'DevConfigure',config});transport.send({type:'DevApply'});
    const s=transport.snapshot();transport.send({type:'CastSlot',slot:'Q',point:{x:s.hero.x+2,y:s.hero.y}});
    const cues=transport.snapshot().cues,slash=cues.find(c=>c.kind==='swing')!;
    expect(slash.appearance).toBe('fire');
    const projected=worldToScreen(s.hero,camera),view={...camera,origin:{x:-projected.x,y:-projected.y}};
    expect(planPixelVfx(cues,view).find(p=>p.cue.id===slash.id)?.row).toBe(2);
  });
  it('plays the shield flipbook from a real default W cast and freezes without advancing the simulation',()=>{
    const world=new GameWorld(1234);openMerchantFixture(world);startCombatFixture(world);
    world.command({type:'CastSlot',slot:'W',point:{x:world.hero.x+1,y:world.hero.y}});
    const snapshot=world.snapshot(),shield=snapshot.cues.find(c=>c.kind==='shield');expect(shield).toBeDefined();
    const view={...camera,origin:{x:0,y:0}},p=worldToScreen(snapshot.hero,view);view.origin={x:-p.x,y:-p.y};
    const first=planPixelVfx(snapshot.cues,view);expect(first.some(p=>p.row===3)).toBe(true);
    // Repainting the same paused authoritative snapshot cannot advance a pose.
    expect(planPixelVfx(snapshot.cues,view).map(p=>[p.cue.id,p.frame])).toEqual(first.map(p=>[p.cue.id,p.frame]));
    expect(planPixelVfx(snapshot.cues.map(c=>({...c,ttl:0})),view)).toEqual([]);
    expect(planPixelVfx([],view)).toEqual([]);
  });
  it('preserves a new shield amid 40 old explosions regardless of snapshot array order',()=>{
    const cues=Array.from({length:40},(_,i)=>cue(i,{ttl:.1}));cues.push(cue(100,{kind:'shield',appearance:'shield',ttl:.44}));
    const selected=planPixelVfx(cues,camera);expect(selected).toHaveLength(PIXEL_VFX_LIMIT);expect(selected[0]!.cue.id).toBe(100);
    expect(planPixelVfx([...cues].reverse(),camera).map(p=>p.cue.id)).toEqual(selected.map(p=>p.cue.id));
    expect(cues).toHaveLength(41);
  });
  it('culls offscreen and unsupported cues while distinguishing frost explosions from fire',()=>{
    const plans=planPixelVfx([cue(1,{at:{x:1000,y:0}}),cue(2,{appearance:'ice'}),cue(3,{appearance:'mist'}),cue(4,{cause:'enemy'}),cue(5,{kind:'heal'}),cue(6,{kind:'cast',appearance:undefined})],camera);
    expect(plans.map(p=>p.cue.id)).toEqual([2]);expect(plans[0]!.row).toBe(1);
  });
  it('drops 20 overlapping bursts at projected ring boundaries, while retaining bursts away from danger edges',()=>{
    const shape:HitShape={kind:'ring',center:{x:0,y:0},radius:5,innerRadius:2};
    const nearInner=Array.from({length:20},(_,id)=>cue(id,{at:{x:2,y:0}}));
    expect(planPixelVfx(nearInner,camera)).toHaveLength(20);
    expect(planPixelVfx(nearInner,camera,[{shape}])).toEqual([]);
    const far=cue(99,{at:{x:-9,y:-9}});expect(planPixelVfx([far],camera,[{shape}]).map(p=>p.cue.id)).toEqual([99]);
  });
});
