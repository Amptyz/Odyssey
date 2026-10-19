import {describe,expect,it} from 'vitest';
import {MAPS,type MapId} from '../../EmberDemo/assets/scripts/ember/content/maps';
import {JOURNEYS,sceneLocation} from '../../EmberDemo/assets/scripts/ember/content/scenes';
import {validateContent} from '../../EmberDemo/assets/scripts/ember/content/validate';
import {LocalTransport} from '../../EmberDemo/assets/scripts/ember/platform/LocalTransport';
import {GameWorld} from '../../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import {chooseFixture} from '../helpers/scenes';

describe('shared location metadata',()=>{
  it('resolves every configured camp, rest and level into detached per-player snapshots',()=>{
    const port=new LocalTransport();
    for(const mapId of Object.keys(MAPS) as MapId[]){
      const places=[{camp:true,wave:0},...Object.keys(JOURNEYS[mapId].rests).map(w=>({camp:true,wave:Number(w)})),...MAPS[mapId].waves.map((_,i)=>({camp:false,wave:i+1}))];
      for(const {camp,wave}of places){
        port.send({type:'DevOpen'});const draft=port.snapshot().developer!.draft;
        port.send({type:'DevConfigure',config:{...draft,mapId,entry:camp?'camp':'combat',wave:camp?wave+1:wave}});port.send({type:'DevApply'});
        port.world.addPlayer('p2');const s=port.snapshot(),other=port.world.snapshot('p2');
        expect(s.scene).toMatchObject({...sceneLocation(mapId,wave,camp),id:`${camp?'camp':'level'}:${wave}`});
        expect(other.scene.name).toBe(s.scene.name);expect(other.scene.subtitle).toBe(s.scene.subtitle);
        s.scene.name='local mutation';expect(port.snapshot().scene.name).not.toBe('local mutation');
      }
    }
  },15000); // Constructs all 16 Creator-independent worlds; allow CPU contention in the full suite.
  it('allows renaming a location without changing claims or checkpoint identity',()=>{
    const w=new GameWorld();w.command({type:'Start'});chooseFixture(w);
    const saved=w.savedRun,before=w.snapshot().scene,location=JOURNEYS.ember.camp,original={...location};
    try{
      location.name='测试庭院';location.subtitle='可编辑说明';
      const resumed=GameWorld.resume(saved),s=resumed.snapshot();
      expect(s.scene).toMatchObject({name:'测试庭院',subtitle:'可编辑说明',id:before.id});
      expect(s.scene.interactions).toEqual(before.interactions);expect(s.perks).toEqual(w.snapshot().perks);
    }finally{Object.assign(location,original);}
  });
  it.each([
    ['map',MAPS.ember],['camp',JOURNEYS.ember.camp],['rest',JOURNEYS.ember.rests[2]!],['level',MAPS.ember.waves[0]!.level!],
  ] as const)('rejects blank %s names before entering the game',(_,location)=>{
    const name=location.name;
    try{location.name='  ';expect(()=>validateContent()).toThrow(/\.name/);}finally{location.name=name;}
  });
  it('rejects unconfigured places instead of showing a made-up fallback title',()=>{
    expect(()=>sceneLocation('ember',1,true)).toThrow('Missing location');
    expect(()=>sceneLocation('frost',99,false)).toThrow('Missing location');
  });
});
