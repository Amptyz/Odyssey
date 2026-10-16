import {AttributeSet,PLAYER_TEMPLATE} from '../../EmberDemo/assets/scripts/ember/combat-core/attributes/AttributeSet';
import { describe,it,expect } from 'vitest';
import { CollisionWorld,overlaps,sweepCircle } from '../../EmberDemo/assets/scripts/ember/combat-core/CollisionWorld';
import type { Actor } from '../../EmberDemo/assets/scripts/ember/combat-core/types';

const actor=(id:string,x:number,y:number,radius=.3):Actor=>({id,x,y,radius,team:'enemy',hp:100,maxHp:100,shield:0,shieldTime:0,alive:true,statuses:[],attributes:new AttributeSet({...PLAYER_TEMPLATE,stats:{...PLAYER_TEMPLATE.stats,maxHealth:100}}),mana:0,shields:[],combatEffects:[],attributeEffects:[]});
describe('combat collision geometry',()=>{
  it('includes bodies touching circle and capsule boundaries without expanding past them',()=>{
    expect(overlaps({kind:'circle',center:{x:0,y:0},radius:2},actor('edge',2.3,0))).toBe(true);
    expect(overlaps({kind:'circle',center:{x:0,y:0},radius:2},actor('outside',2.31,0))).toBe(false);
    const capsule={kind:'capsule' as const,center:{x:0,y:0},end:{x:4,y:0},radius:.1};
    expect(overlaps(capsule,actor('grazing',2,.4))).toBe(true);
    expect(overlaps(capsule,actor('past end',4.41,0))).toBe(false);
  });
  it('tests the whole sector boundary, not only the angle of the target center',()=>{
    const sector={kind:'sector' as const,center:{x:0,y:0},facing:{x:1,y:0},radius:2,arc:Math.PI/2};
    expect(overlaps(sector,actor('edge',1,1.2))).toBe(true);
    expect(overlaps(sector,actor('outside',1,1.5))).toBe(false);
    expect(overlaps(sector,actor('outer arc',2.3,0))).toBe(true);
    expect(overlaps(sector,actor('corner',1.7,1.7))).toBe(false);
    expect(overlaps(sector,actor('behind',-1,0))).toBe(false);
    expect(overlaps(sector,actor('overlapping origin',-.1,0))).toBe(true);
  });
  it('sweeps tiny targets, grazing contacts and moving targets across a projectile path',()=>{
    expect(sweepCircle({x:0,y:0},{x:10,y:0},.01,actor('tiny',5,0,.01))).toBeCloseTo(.498);
    expect(sweepCircle({x:0,y:0},{x:10,y:0},.1,actor('graze',5,.4))).toBeCloseTo(.5);
    expect(sweepCircle({x:0,y:0},{x:10,y:0},.1,actor('miss',5,.41))).toBeUndefined();
    expect(sweepCircle({x:0,y:0},{x:10,y:0},.1,actor('cross',5,2),{x:5,y:-2})).toBeLessThan(.5);
    expect(sweepCircle({x:0,y:0},{x:0,y:0},.1,actor('still',3,0))).toBeUndefined();
  });
  it('resolves nearest surface first independent of actor registration order; walls win ties',()=>{
    const space=new CollisionWorld({width:20,height:20,obstacles:[{x:8,y:10,radius:1}]}),near=actor('near',5,10),far=actor('far',6,10);
    expect(space.firstImpact([far,near],'hero',{x:2,y:10},{x:10,y:10},.1)?.actor?.id).toBe('near');
    const blocked=space.firstImpact([actor('hidden',10,10)],'hero',{x:2,y:10},{x:12,y:10},.1);
    expect(blocked?.actor).toBeUndefined();expect(blocked?.t).toBeCloseTo(.49);
    expect(space.firstImpact([actor('wall tie',8,10,1)],'hero',{x:2,y:10},{x:12,y:10},.1)?.actor).toBeUndefined();
    expect(space.blocker({x:19,y:10},{x:21,y:10},.2)).toBeCloseTo(.4);
  });
  it('filters allies, dead units and bodies occluded by terrain for area effects',()=>{
    const space=new CollisionWorld({width:20,height:20,obstacles:[{x:6,y:6,radius:.85}]}),dead=actor('dead',4,7);dead.alive=false;
    const friend=actor('friend',4,6);friend.team='hero';
    expect(space.targets([actor('clear',4,8),actor('blocked',8,6),dead,friend],'hero',{kind:'circle',center:{x:4,y:6},radius:5}).map(a=>a.id)).toEqual(['clear']);
  });
});
