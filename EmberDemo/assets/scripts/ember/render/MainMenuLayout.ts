import type {Node} from 'cc';
import {MAPS,mapDefinition,type MapId} from '../content/maps';
import type {WorldSnapshot} from '../simulation/GameWorld';
import type {GameCommand} from '../platform/protocol';
import type {ControlMode} from '../input/InputController';
import {ArtLibrary} from './ArtLibrary';import {HeroRig} from './HeroRig';import {graphics,box,text} from './Primitives';
type Button=(title:string,x:number,y:number,width:number,action:()=>void,fill?:string)=>void;
export function drawMainMenu(root:Node,s:WorldSnapshot,art:ArtLibrary,button:Button,send:(c:GameCommand)=>void,mode:ControlMode,setMode:(mode:ControlMode)=>void):void {
 const g=graphics('Main graphic panels',root);box(g,-616,-330,550,660,'#18191FE8',10);box(g,-42,-330,658,660,'#24232CD0',12);box(g,-600,287,70,5,'#A74936',0);
 text('Main eyebrow',root,'PROJECT EMBER / LIVING RUINS',13,-340,268,490,30,'#BDAC8C');text('Game title',root,'余 烬 试 炼',48,-340,196,510,90,'#F1E6D2');text('Main intro',root,'让火种长明，踏入遗迹深处。\n探索、战斗，自由组合你的构筑。',17,-340,119,490,70,'#CCC4B8');
 button('单人试炼 · 启程整备  ↵',-340,37,454,()=>send({type:'Start'}),'#A74936');button('创建联机房间',-340,-23,454,()=>window.dispatchEvent(new CustomEvent('ember-room-open',{detail:'create'})),'#35313B');button('加入联机房间',-340,-83,454,()=>window.dispatchEvent(new CustomEvent('ember-room-open',{detail:'join'})),'#35313B');
 button(`地图 · ${mapDefinition(s.mapId).name}`,-340,-143,454,()=>{const ids=Object.keys(MAPS)as MapId[];send({type:'SelectMap',mapId:ids[(ids.indexOf(s.mapId)+1)%ids.length]!});},'#35313B');
 button((mode==='classic'?'● ':'')+'右键移动',-455,-212,215,()=>setMode('classic'),'#35313B');button((mode==='wasd'?'● ':'')+'WASD 移动',-225,-212,215,()=>setMode('wasd'),'#35313B');button('开发者模式 · F2',-340,-278,454,()=>send({type:'DevOpen'}),'#35313B');
 if(art.hasPixel('environment')){art.pixelSprite(root,'environment',5,155,165).setPosition(280,158);art.pixelSprite(root,'environment',3,112,94).setPosition(110,93);art.pixelSprite(root,'environment',4,95,101).setPosition(455,89);}
 const hero=new HeroRig(root,art);hero.node.setPosition(280,75);hero.node.setScale(2.5,2.5,1);hero.equip(s.appearance);
 text('Main build note',root,'无职业限制 · 六格装备 · 四槽主动技能',16,285,35,600,44,'#E1D2BA');text('Lab title',root,'联 动 实 验 / 已有预设',14,285,-37,590,35,'#BDAC8C');
 const labs=[['燃烧弹 → 尸爆','burn'],['尸爆 → 电弧','arc'],['奥能 → 双重施法','reserve'],['海克斯 · 法术爆发','hexMage'],['海克斯 · 普攻联动','hexAttack'],['海克斯 · 冲刺续航','hexSurvive']]as const;
 labs.forEach(([name,lab],i)=>button(name,128+(i%2)*309,-97-Math.floor(i/2)*62,285,()=>send({type:'Start',lab}),'#35313B'));text('Main seed',root,`SEED ${s.seed} · 2–4 人好友合作 · 本地资源`,12,285,-296,590,30,'#9A948A');
}
