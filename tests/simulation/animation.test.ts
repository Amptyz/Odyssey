import {openMerchantFixture,startCombatFixture} from '../helpers/scenes';
import { describe,it,expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { animationFrame,motionPose,wholeHeroFrame } from '../../EmberDemo/assets/scripts/ember/content/animation';
import { ATLAS_FRAMES } from '../../EmberDemo/assets/scripts/ember/content/art-manifest';
import { GameWorld } from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';

describe('presentation signals and imported art',()=>{
  it('loops locomotion, clamps non-looping death and accepts per-appearance clips',()=>{
    expect(animationFrame('walk',4/9)).toBe(4);
    expect(animationFrame('death',10)).toBe(15);
    expect(animationFrame('idle',-.2)).toBe(0);
    const clips={idle:{frames:[3,1],fps:2,loop:true}};
    expect(animationFrame('idle',.5,clips as Parameters<typeof animationFrame>[2])).toBe(1);
  });
  it('selects death before hurt, hurt before action, and locomotion from velocity',()=>{
    const w=new GameWorld(),u=w.hero;
    expect(motionPose(u,0).state).toBe('idle');u.velocity={x:1,y:0};expect(motionPose(u,1).state).toBe('walk');
    u.action={id:1,kind:'cast',time:1};expect(motionPose(u,1.1).state).toBe('cast');
    u.hurtAt=1.05;expect(motionPose(u,1.1).state).toBe('hurt');
    u.alive=false;u.diedAt=1.1;u.facing={x:0,y:1};expect(motionPose(u,1.4)).toMatchObject({state:'death',age:expect.closeTo(.3),facing:-1});
  });
  it('emits cast/hit/death signals at simulation time without affecting damage or pause',()=>{
    const w=new GameWorld();openMerchantFixture(w);startCombatFixture(w);
    for(const [id,u] of w.actors)if(u.team==='enemy')w.actors.delete(id);
    const e=w.spawnEnemy('warden',{x:11.3,y:10},20);e.windup=999;
    w.command({type:'CastSlot',slot:'Q',point:e});expect(w.hero.action).toEqual({id:1,kind:'cast',time:0});
    for(let i=0;i<10;i++)w.advance(1/30);
    expect(e.alive).toBe(false);expect(e.diedAt).toBeGreaterThan(0);expect(e.hurtAt).toBe(e.diedAt);
    expect(motionPose(e,e.diedAt).state).toBe('death');
    const snap=w.snapshot();snap.hero.action.id=99;snap.hero.facing.x=99;
    expect(w.hero.action.id).toBe(1);expect(w.hero.facing.x).not.toBe(99);
    const diedAt=e.diedAt;w.advance(1);expect(e.diedAt).toBe(diedAt);
  });
  it('all atlas rectangles fit the actual RGBA PNGs and have editor metadata',()=>{
    for(const [id,frames] of Object.entries(ATLAS_FRAMES)){
      const file=`EmberDemo/assets/resources/art/living-ruins/${id}.png`,data=readFileSync(file);
      expect(data.subarray(1,4).toString()).toBe('PNG');expect(data[25]).toBe(6);
      const width=data.readUInt32BE(16),height=data.readUInt32BE(20);
      for(const {rect:[x,y,w,h],pivot:[px,py]} of frames){expect(x+w).toBeLessThanOrEqual(width);expect(y+h).toBeLessThanOrEqual(height);expect(px).toBeGreaterThanOrEqual(0);expect(px).toBeLessThanOrEqual(w);expect(py).toBe(h);}
      expect(JSON.parse(readFileSync(file+'.meta','utf8')).uuid).toBeTruthy();
    }
  });
});

describe('whole-body hero sequence frames',()=>{
  it('selects all eight directions using five complete figures and whole-image mirroring',()=>{
    const w=new GameWorld(),rows=new Set<number>();
    for(let direction=0;direction<8;direction++){
      const a=direction*Math.PI/4,x=Math.sin(a),sum=Math.cos(a);w.hero.facing={x:(sum+x)/2,y:(sum-x)/2};
      const pose=motionPose(w.hero,1),frame=wholeHeroFrame(pose);
      expect(pose.direction).toBe(direction);expect(frame.mirror).toBe(direction<=4?1:-1);rows.add(frame.row);
      expect(Math.floor(frame.frame/8)).toBe(frame.row);
    }
    expect(rows.size).toBe(5);
  });
  it('plays eight distinct run frames at 20 FPS and uses a separate walk clip',()=>{
    const sample=(age:number,speed=7)=>wholeHeroFrame({state:'walk',age,facing:1,direction:2,speed});
    expect(new Set(Array.from({length:8},(_,i)=>sample((i+.1)/20).frame)).size).toBe(8);
    expect(sample(.4)).toEqual(sample(0));expect(sample(0).atlas).toBe('hero-run');expect(sample(0,4).atlas).toBe('hero-walk');
    expect(sample(.101)).toEqual(sample(.109)); // No artificial skeletal interpolation between authored frames.
  });
  it('chooses melee or missile animation only from the action, and clamps death at its last frame',()=>{
    const sample=(basicAttack:'slash'|'missile')=>wholeHeroFrame({state:'attack',age:.2,facing:-1,direction:5,basicAttack});
    expect(sample('slash')).toMatchObject({atlas:'hero-melee',row:3,mirror:-1});expect(sample('missile').atlas).toBe('hero-ranged');
    expect(wholeHeroFrame({state:'cast',age:.2,facing:1}).atlas).toBe('hero-ranged');
    expect(wholeHeroFrame({state:'death',age:99,facing:1,direction:4}).frame).toBe(39);
  });
});
