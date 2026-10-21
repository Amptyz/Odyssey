import type {Node} from 'cc';
import {MAPS,mapDefinition,type MapId} from '../content/maps';
import type {WorldSnapshot} from '../simulation/GameWorld';
import type {GameCommand} from '../platform/protocol';
import type {ControlMode} from '../input/InputController';
import {ArtLibrary} from './ArtLibrary';import {HeroSprite} from './HeroSprite';import {graphics,box,text} from './Primitives';
type Button=(title:string,x:number,y:number,width:number,action:()=>void,fill?:string)=>void;
export function drawMainMenu(root:Node,s:WorldSnapshot,art:ArtLibrary,button:Button,send:(c:GameCommand)=>void,mode:ControlMode,setMode:(mode:ControlMode)=>void):void {
 const g=graphics('Main graphic panels',root);box(g,-616,-330,550,660,'#18191FE8',10);box(g,-42,-330,658,660,'#24232CD0',12);box(g,-600,287,70,5,'#A74936',0);
 text('Main eyebrow',root,'PROJECT EMBER / LIVING RUINS',13,-340,268,490,30,'#BDAC8C');text('Game title',root,'余 烬 试 炼',48,-340,196,510,90,'#F1E6D2');text('Main intro',root,'让火种长明，踏入遗迹深处。\n探索、战斗，自由组合你的构筑。',17,-340,119,490,70,'#CCC4B8');
 button('单人试炼 · 进入营地  ↵',-340,37,454,()=>send({type:'Start'}),'#A74936');button('创建联机房间',-340,-23,454,()=>window.dispatchEvent(new CustomEvent('ember-room-open',{detail:'create'})),'#35313B');button('加入联机房间',-340,-83,454,()=>window.dispatchEvent(new CustomEvent('ember-room-open',{detail:'join'})),'#35313B');
 button(`地图 · ${mapDefinition(s.mapId).name}`,-340,-143,454,()=>{const ids=Object.keys(MAPS)as MapId[];send({type:'SelectMap',mapId:ids[(ids.indexOf(s.mapId)+1)%ids.length]!});},'#35313B');
 button((mode==='classic'?'● ':'')+'右键移动',-455,-212,215,()=>setMode('classic'),'#35313B');button((mode==='wasd'?'● ':'')+'WASD 移动',-225,-212,215,()=>setMode('wasd'),'#35313B');button('开发者模式 · F2',-340,-278,454,()=>send({type:'DevOpen'}),'#35313B');
 if(art.hasPixel('environment')){art.pixelSprite(root,'environment',3,112,94).setPosition(110,43);art.pixelSprite(root,'environment',4,95,101).setPosition(455,39);}
 const hero=new HeroSprite(root,art);hero.pose({state:'idle',age:0,facing:1},s.party?.find(p=>p.id===s.hero.id)?.paletteId);hero.node.setPosition(280,25);hero.node.setScale(2.5,2.5,1);
 text('Main build note',root,'无职业限制 · 六格装备 · 四槽主动技能',16,285,-5,600,44,'#E1D2BA');text('Lab title',root,'联 动 实 验 / 已有预设',14,285,-45,590,35,'#BDAC8C');
 const labs=[['燃烧弹 → 尸爆','burn'],['尸爆 → 电弧','arc'],['奥能 → 双重施法','reserve'],['余烬 · 法术爆发','hexMage'],['余烬 · 普攻联动','hexAttack'],['余烬 · 冲刺续航','hexSurvive']]as const;
 labs.forEach(([name,lab],i)=>button(name,128+(i%2)*309,-85-Math.floor(i/2)*58,285,()=>send({type:'Start',lab}),'#35313B'));
 if(s.localSave){
  button(s.localSave.available?'继续存档':'读取存档 · 暂无存档',285,271,550,()=>send({type:'LoadRun'}),'#547B75');
  text('Saved run label',root,s.localSave.notice||s.localSave.label,13,285,228,590,40,'#E1D2BA');
  button('导入存档文件',128,-266,285,()=>window.dispatchEvent(new Event('ember-run-import')),'#35313B');
  button('导出存档文件',437,-266,285,()=>window.dispatchEvent(new Event('ember-run-export')),'#35313B');
 }
 text('Main seed',root,`SEED ${s.seed} · 单人进度自动保存，新开局覆盖旧进度`,12,285,-312,600,30,'#9A948A');
}
