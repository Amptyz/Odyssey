import {BASIC_ATTACKS} from '../content/attacks';
import { Graphics, Label, Node } from 'cc';
import type { ControlMode } from '../input/InputController';
import { skill,skillSlotName,SKILL_SLOTS,SKILL_DESCRIPTIONS,type SkillSlot } from '../content/skills';
import { MAPS,mapDefinition,type MapId } from '../content/maps';
import { perk } from '../content/perks';
import type { GameCommand } from '../platform/protocol';
import type { WorldSnapshot } from '../simulation/GameWorld';
import type { Vec2 } from '../utils/math';
import { ArtLibrary } from './ArtLibrary';
import {drawProductionShop as drawShop} from './ShopLayout';
import {drawMainMenu} from './MainMenuLayout';
import { DeveloperPanel } from './DeveloperPanel';
import { equipment,EQUIPMENT_SLOTS,type EquipmentId } from '../content/equipment';
import { box,color,graphics,setText,text,uiNode } from './Primitives';
interface HitRegion {x:number;y:number;width:number;height:number;title?:string;action:()=>void}
export class Hud {
  private readonly battleHud:Node;
  private readonly hp:Label;private readonly wave:Label;private readonly meter:Graphics;private readonly attributes:Label;private readonly mana:Label;private readonly teammates:Label;private readonly gearHud:Node;private gearKey='';
  private readonly boonList:Label;private readonly equipmentEffects:Label;private readonly debugLabel:Label;
  private readonly skills:{id:SkillSlot;g:Graphics;cd:Label;key:Label;name:Label;icon?:Node;skillId?:string|null}[]=[];
  private readonly hint:Label;private mode:ControlMode='classic';
  onControlMode?:(mode:ControlMode)=>void;
  private readonly overlay:Node;private signature='';private regions:HitRegion[]=[];
  private shopPage=0;private shopItem?:EquipmentId;private debug=false;private state?:WorldSnapshot;private inspectPerks=false;private perkPage=0;
  private readonly developerPanel:DeveloperPanel;private readonly developerBadge:Label;
  constructor(root:Node,private readonly send:(c:GameCommand)=>void,private readonly art:ArtLibrary) {
    const hud=uiNode('HUD',root),bg=graphics('HUD panels',hud);
    this.battleHud=hud;
    box(bg,-616,218,292,120,'#20373DEE',12);box(bg,354,170,262,168,'#20373DEE',12);
    box(bg,-235,296,470,40,'#20373DEE',10);
    box(bg,-616,176,292,32,'#20373DEE',8);this.developerBadge=text('Developer mode entry',hud,'开发者模式 · F2',12,-470,192,275,30,'#D6C293');
    text('Title',hud,'余 烬 试 炼',17,-470,315,260,30,'#ECDBB7');
    this.hp=text('Health values',hud,'',13,-470,272,250,25,'#C9DED2');this.meter=graphics('HP meter',hud);
    this.mana=text('Mana values',hud,'法力 · 无消耗',11,-470,251,250,22,'#87C4D3');
    this.attributes=text('Combat attributes',hud,'',11,-470,230,270,25,'#E6DAC7');
    this.teammates=text('Party status',hud,'',13,-482,95,250,130,'#EEE1C9');
    const gearBg=graphics('Six equipment slots',hud);box(gearBg,-616,-321,340,67,'#18191FED',8);this.gearHud=uiNode('HUD equipment icons',hud);
    this.wave=text('Wave',hud,'',14,0,316,450,38,'#E9DBBD');
    text('Perks title',hud,'试炼印记',14,475,315,220,30,'#ECDBB7');
    this.boonList=text('Perks',hud,'尚未获得余烬',13,480,261,235,76,'#B7CFC6');
    this.equipmentEffects=text('Equipment passive status',hud,'',12,480,193,235,38,'#C9DCC9');
    this.hint=text('Control hint',hud,'',13,-40,-341,1000,26,'#36585B');
    for(const [i,id] of SKILL_SLOTS.entries()){
      const x=-165+i*110,node=uiNode(`Skill ${id}`,hud,100,74);node.setPosition(x,-286);
      const g=graphics('Cooldown plate',node),key=text('Key',node,id,24,-28,3,40,40,'#E7D2A5');
      const name=text('Skill name',node,'空槽',12,8,-23,96,24,'#BFCFC8');
      const cd=text('Cooldown',node,'',17,18,5,58,30);this.skills.push({id,g,cd,key,name});
    }
    text('Debug toggle',hud,'F3 · DEBUG',11,552,-340,150,26,'#36585B');
    this.debugLabel=text('Debug details',hud,'',11,-470,-205,285,80,'#294C4D');this.debugLabel.node.active=false;
    this.overlay=uiNode('Modal overlay',root);this.developerPanel=new DeveloperPanel(send,()=>{this.signature='';});this.setControlMode('classic');
  }
  setControlMode(mode:ControlMode):void {
    this.mode=mode;this.signature='';
    setText(this.hint,mode==='wasd'?'WASD 移动 · 左键普攻 · 右键 / Q 第一技能 · 空格 第二技能 · E / R 技能 · F 互动 · ESC 设置':'右键移动 · 左键朝指针普攻 · Q W E R 施法   ·   F 互动 · ESC 设置');
    for(const skill of this.skills){const space=mode==='wasd'&&skill.id==='W';skill.key.fontSize=space?14:24;setText(skill.key,space?'空格':skill.id);}
  }
  private modeButtons(y:number):void {
    for(const [i,mode] of (['classic','wasd'] as const).entries()){
      this.button(`${this.mode===mode?'● ':''}${mode==='classic'?'右键移动':'WASD 移动'}`,i===0?-145:145,y,270,()=>this.onControlMode?.(mode),this.mode===mode?'#668D7C':'#344B51');
    }
  }
  toggleDebug():void {this.debug=!this.debug;this.debugLabel.node.active=this.debug;}
  get showColliders():boolean{return this.debug;}
  inspectUI(){return{phase:this.state?.phase,buttons:this.regions.map(({x,y,width,height,title})=>({x,y,width,height,title}))};}
  update(s:WorldSnapshot,fps:number):void {
    this.battleHud.active=['camp','cleared','fighting'].includes(s.phase)&&!s.paused;
    if(s.phase!=='shop')this.shopItem=undefined;
    this.state=s;setText(this.hp,`生命 ${Math.ceil(s.hero.hp)} / ${s.hero.maxHp}    护盾 ${Math.ceil(s.hero.shield)}`);
    setText(this.mana,'法力 · 当前技能无消耗');setText(this.attributes,`攻击 ${s.stats.attackDamage}   法强 ${s.stats.abilityPower}   护甲 ${s.stats.armor}   急速 ${s.stats.abilityHaste}`);
    setText(this.teammates,(s.party??[]).filter(p=>p.id!==s.hero.id).map(p=>{const u=s.units.find(u=>u.id===p.id);return `${p.id}  ${u?.alive?Math.ceil(u.hp)+' / '+u.maxHp:'已倒下'}${p.ready?' · 已确认':''}`;}).join('\n'));
    const gearKey=JSON.stringify(s.equipment);if(gearKey!==this.gearKey){this.gearKey=gearKey;this.gearHud.destroyAllChildren();for(const [i,slot]of EQUIPMENT_SLOTS.entries()){const id=s.equipment[slot],x=-587+i*53;const frame=graphics('Equipment slot '+slot,this.gearHud);box(frame,x-22,-306,44,44,'#292831',6);if(id){const icon=this.art.icon(this.gearHud,id,32);icon?.setPosition(x,-284);}else text('Empty '+slot,this.gearHud,'+',20,x,-284,40,40,'#716D69');text('Slot '+slot,this.gearHud,String(i+1),10,x,-312,40,16,'#B6A88E');}}
    setText(this.developerBadge,s.network?`房间 ${s.network.code} · ${s.network.playerId===s.network.hostId?'房主':'队友'}`:s.developer?.enabled?'DEV · 测试模式 · F2':'开发者模式 · F2');
    this.meter.clear();box(this.meter,-600,290,260,8,'#484047',0);box(this.meter,-600,290,260*s.hero.hp/s.hero.maxHp,8,'#E46443',0);box(this.meter,-600,260,260,4,'#345064',0);
    setText(this.wave,s.scene.kind==='camp'?s.scene.name:s.phase==='ready'?`PROJECT EMBER  /  ${mapDefinition(s.mapId).name}`:`${s.developer?.enabled?'DEV · ':''}${mapDefinition(s.mapId).name} · ${s.wave} / ${s.totalWaves} 关 · ${s.level.exitActive?'前往出口':s.level.remainingEnemies+' 个敌人'}${s.lab?'    ·    联动实验':''}`);
    setText(this.boonList,`金币 ${s.gold}  ·  装备 ${Object.keys(s.equipment).length}/6\n普攻 · ${BASIC_ATTACKS[s.basicAttack].name}\n${s.perks.map(id=>perk(id).name).join(' · ')||'靠近余烬 · F 选择效果'}`);
    setText(this.equipmentEffects,(s.equipmentPassives??[]).map(p=>`${p.kind==='spellblade'?'符击':'石息'} · ${p.readyIn>0?`冷却 ${p.readyIn.toFixed(1)}秒`:p.lockedAttackId!==undefined?'等待普攻命中':p.armedFor>0?`蓄能 ${p.armedFor.toFixed(1)}秒`:'就绪'}`).join('\n'));
    for(const entry of this.skills){const {id,g,cd,name}=entry,skillId=s.loadout[id],definition=skillId?skill(skillId):undefined;setText(name,skillSlotName(skillId));if(entry.skillId!==skillId){entry.icon?.destroy();entry.skillId=skillId;entry.icon=skillId?this.art.icon(g.node.parent!,skillId,31):undefined;entry.icon?.setPosition(-5,6);entry.key.node.setPosition(skillId?-34:-28,skillId?5:3);entry.key.fontSize=skillId?15:24;cd.node.setPosition(30,7);}
      const remaining=s.cooldowns[id],ratio=definition?Math.min(1,remaining/(definition.cooldown*s.stats.cooldownMultiplier)):0,primed=s.primed&&definition?.behavior.kind==='projectile';
      g.clear();box(g,-49,-37,98,74,'#243E43',10);box(g,-47,-35,94,70,remaining>0?'#30454B':'#3B5859',8);
      if(remaining>0)box(g,-47,-35,94,70*ratio,'#203138BB',7);
      if(primed){g.strokeColor=color('#E8C98C');g.lineWidth=2;g.roundRect(-48,-36,96,72,9);g.stroke();}
      setText(cd,remaining>0?remaining.toFixed(1):primed?'强化':'');}
    if(this.debug)setText(this.debugLabel,`FPS ${Math.round(fps)}  ·  Tick ${s.tick}\n事件 ${s.metrics.processed} / 拦截 ${s.metrics.dropped} / 深度 ${s.metrics.maxDepth}\nSeed ${s.seed}  ·  实体 ${s.units.length} / 弹体 ${s.projectiles.length+s.enemies.projectiles.length}`);
    const signature=`${s.phase}:${s.paused}:${s.choices.map(c=>c.id).join(',')}:${s.pendingSkill}:${s.lab}:${s.mapId}:${Object.values(s.loadout).join(',')}:${s.gold}:${JSON.stringify(s.equipment)}:${s.inventory.join(',')}:${this.shopPage}:${s.developer?.open}:${s.developer?.enabled}:${s.developer?.revision}:${s.party?.find(p=>p.id===s.hero.id)?.ready}:${s.network?.blocked}:${s.network?.status}:${s.localSave?.revision}`;
    if(signature!==this.signature){this.signature=signature;this.buildModal(s);}
  }
  click(point:Vec2):boolean {
    if(this.state?.developer?.open&&this.developerPanel.click(point))return true;
    if(!this.overlay.active&&Math.abs(point.x+470)<146&&Math.abs(point.y-192)<19){this.send({type:'DevOpen'});return true;}
    if(Math.abs(point.x-552)<70&&Math.abs(point.y+340)<20){this.toggleDebug();return true;}
    const r=this.regions.find(r=>Math.abs(point.x-r.x)<=r.width/2&&Math.abs(point.y-r.y)<=r.height/2);
    if(r){r.action();return true;}return this.overlay.active;
  }
  keyChoice(index:number):void {if(this.state?.pendingSkill){const slot=SKILL_SLOTS[index];if(slot)this.send({type:'ConfirmSkill',slot});return;}const choice=this.state?.choices[index];if(choice)this.send({type:'ChooseReward',choiceId:choice.id});}
  private button(title:string,x:number,y:number,width:number,action:()=>void,fill='#547B75'):void {
    const g=graphics(title,this.overlay);box(g,x-width/2,y-23,width,46,fill,9);text(`${title} label`,this.overlay,title,16,x,y,width-20,40,'#F4EAD4');
    this.regions.push({x,y,width,height:46,title,action});
  }
  private buildModal(s:WorldSnapshot):void {
    for(const child of [...this.overlay.children])child.destroy();this.overlay.removeAllChildren();this.regions=[];
    this.overlay.active=!!s.developer?.open||!['camp','cleared','fighting'].includes(s.phase)||s.paused||!!s.network?.blocked;if(!this.overlay.active)return;
    const veil=graphics('Veil',this.overlay);box(veil,-640,-360,1280,720,'#10242CEB',0);
    if(s.network?.blocked){text('Network waiting',this.overlay,s.network.status,23,0,40,1100,150,'#EFE2C1');text('Network hint',this.overlay,'打开左上角「联机房间」查看队友、重连或恢复进度。',17,0,-70,1000,60,'#B5CFC4');return;}

    if(s.developer?.open){this.developerPanel.draw(this.overlay,s,this.button.bind(this));return;}
    if(!s.network&&s.phase!=='ready'&&s.phase!=='shop')this.button('开发者面板 · F2',470,312,270,()=>this.send({type:'DevOpen'}),'#586552');
    if(s.phase==='ready'){
      drawMainMenu(this.overlay,s,this.art,this.button.bind(this),this.send,this.mode,mode=>this.onControlMode?.(mode));
    }else if(s.phase==='shop'){
      drawShop(this.overlay,s,this.shopPage,p=>{this.shopPage=p;this.shopItem=undefined;this.signature='';},this.button.bind(this),this.send,this.art,id=>{this.shopItem=id;this.signature='';},this.shopItem);
    }else if(s.paused&&this.inspectPerks){
      text('Build title',this.overlay,'本局余烬',34,0,265,850,60,'#EFE2C1');
      const pages=Math.max(1,Math.ceil(s.perks.length/4));this.perkPage=Math.min(this.perkPage,pages-1);
      for(const [i,id] of s.perks.slice(this.perkPage*4,this.perkPage*4+4).entries()){
        const p=perk(id),x=i%2===0?-265:265,y=i<2?110:-90,g=graphics(`Inspect ${id}`,this.overlay);box(g,x-245,y-85,490,170,'#2D464C',12);
        text('Name',this.overlay,p.name,22,x,y+48,450,40,p.color);text('Description',this.overlay,p.description,16,x,y-13,440,100,'#C2D6CA');
      }
      if(!s.perks.length)text('Empty build',this.overlay,'完成关卡后，可从奖励中选择余烬。',20,0,30,800,80,'#C2D6CA');
      this.button('上一页',-290,-253,220,()=>{this.perkPage=(this.perkPage+pages-1)%pages;this.signature='';},'#3E5559');
      this.button(`返回暂停 · ${this.perkPage+1}/${pages}`,0,-253,280,()=>{this.inspectPerks=false;this.signature='';});
      this.button('下一页',290,-253,220,()=>{this.perkPage=(this.perkPage+1)%pages;this.signature='';},'#3E5559');
      text('Hex rules note',this.overlay,'PvE 适配数值 · 战斗已暂停 · 触发冷却和计数在每关开始时重置',13,0,-319,1100,35,'#A5C2B5');
    }else if(s.paused){
      text('Pause title',this.overlay,s.network?'操作设置 · 战斗继续':'火种暂歇',42,0,160,700,80,'#EFE2C1');
      this.modeButtons(98);
      const help=this.mode==='wasd'?'WASD：沿屏幕方向移动，松开即停\n左键按住：朝指针普攻    右键 / Q：朝指针施放主技能\n空格 / E / R：使用当前槽位技能':'右键：移动    /    左键按住：朝指针普攻\nQ / W / E / R：使用当前槽位技能';
      text('Help',this.overlay,help+'\n红色圆环 / 射线：敌人攻击预警    F3：调试信息\n余烬可选主动技能；选择后用 1–4 确认替换槽位。',17,0,-28,1000,200,'#CDDCD0');
      this.button('继续试炼  ESC',-145,-164,250,()=>this.send({type:'TogglePause'}));this.button(s.network?'离开联机房间':s.developer?.enabled?'重测当前配置':'重新开始',145,-164,250,()=>this.send({type:'Restart'}),'#675B58');
      this.button(`查看本局余烬 · ${s.perks.length}`,0,-230,330,()=>{this.inspectPerks=true;this.perkPage=0;this.signature='';},'#3E5559');
      if(!s.network&&!s.developer?.enabled){
        this.button('保存进度',-145,-288,250,()=>this.send({type:'SaveRun'}));this.button('读取存档',145,-288,250,()=>this.send({type:'LoadRun'}),'#586552');
        this.button('导入存档文件',-145,246,250,()=>window.dispatchEvent(new Event('ember-run-import')),'#445F61');this.button('导出存档文件',145,246,250,()=>window.dispatchEvent(new Event('ember-run-export')),'#445F61');
        this.saveStatus(s);
      }
    }else if(s.phase==='reward'&&s.pendingSkill){
      text('Skill acquired',this.overlay,`选择技能：${skill(s.pendingSkill).name}`,32,0,225,1000,60,'#EFE2C1');
      text('Skill description',this.overlay,SKILL_DESCRIPTIONS[s.pendingSkill]+'  选择要装备的槽位。',17,0,159,1060,55,'#BED9CD');
      for(const [i,slot] of SKILL_SLOTS.entries()){
        const x=(i-1.5)*280,g=graphics(`Replace ${slot}`,this.overlay);box(g,x-128,-115,256,225,'#2D464C',12);
        text('Slot key',this.overlay,`${i+1} · ${this.mode==='wasd'&&slot==='W'?'空格':slot}`,22,x,85,220,45,'#AED7E2');
        text('Old skill',this.overlay,skillSlotName(s.loadout[slot]),22,x,-20,220,35,'#EFE2C1');
        const id=s.loadout[slot];if(id)this.art.icon(this.overlay,id,48)?.setPosition(x,30);
        this.button(id?'替换此技能':'装备此技能',x,-66,226,()=>this.send({type:'ConfirmSkill',slot}));
      }
      this.button('返回余烬选择',0,-213,280,()=>this.send({type:'CancelSkill'}),'#445F61');
      text('Replacement note',this.overlay,'空槽可直接装备；已有技能时替换所选槽位，被动余烬保留。',14,0,-280,1000,35,'#A3BEB1');
    }else if(s.phase==='reward'){
      text('Reward eyebrow',this.overlay,`${s.scene.name}   /   每人独立选择一次`,14,0,236,700,30,'#A8C4B7');
      text('Reward title',this.overlay,'选 择 余 烬',38,0,286,850,65,'#EFE2C1');
      for(const [i,choice] of s.choices.entries()){
        const id=choice.id,p=choice.kind==='perk'?perk(choice.perkId):{name:skill(choice.skillId).name,color:'#9CCFE8',description:SKILL_DESCRIPTIONS[choice.skillId]+' 选择后替换任意技能槽。'},x=(i-1)*324,g=graphics(`Perk ${id}`,this.overlay);
        box(g,x-148,-176,296,372,'#2D464C',14);box(g,x-148,191,296,5,p.color,2);
        text('Perk number',this.overlay,`${i+1} · ${choice.kind==='skill'?'主动技能':'被动余烬'}`,13,x,165,240,30,p.color);
        this.art.icon(this.overlay,choice.kind==='perk'?choice.perkId:choice.skillId,92)?.setPosition(x,99);
        text('Perk name',this.overlay,p.name,24,x,24,250,50,'#F1E4C7');
        text('Perk description',this.overlay,p.description,16,x,-67,260,142,'#C2D6CA');
        this.button(`选择  ${i+1}`,x,-212,250,()=>this.send({type:'ChooseReward',choiceId:id}));
        this.regions.push({x,y:8,width:296,height:372,action:()=>this.send({type:'ChooseReward',choiceId:id})});
      }
      this.button('暂时离开 · Esc',470,312,270,()=>this.send({type:'CloseInteraction'}),'#445F61');
      text('Reward footer',this.overlay,'选择后返回场景；前往出发点集合，由房主确认出发。',13,0,-271,850,30,'#A5C2B5');
      for(const [i,slot]of SKILL_SLOTS.entries()){const x=(i-1.5)*225,id=s.loadout[slot];if(id)this.art.icon(this.overlay,id,25)?.setPosition(x-65,-316);text('Reward current '+slot,this.overlay,slot+' · '+skillSlotName(id),12,x+9,-316,170,30,'#BEB6A8');}
    }else{
      const won=s.phase==='victory';text('Result eyebrow',this.overlay,won?'TRIAL COMPLETE':'THE EMBER REMAINS',14,0,186,800,40,'#A2C6B6');
      text('Result title',this.overlay,won?'余烬长明':'火种未熄',48,0,105,800,100,'#EFE2C1');
      text('Result stats',this.overlay,`${won?`${s.totalWaves} 波试炼已通过`:'此次止步第 '+s.wave+' 波'}   ·   击杀 ${s.units.filter(u=>u.team==='hero'&&!u.alive).length?s.kills-1:s.kills}   ·   ${Math.floor(s.time)} 秒\n${s.perks.map(id=>perk(id).name).join('  /  ')||'再次尝试，寻找属于你的组合。'}`,17,0,0,940,100,'#C5D7CB');
      this.button(s.network?'返回单人首页  ↵':'再来一次  ↵',0,-130,280,()=>this.send({type:'Restart'}));
      if(!s.network&&!s.developer?.enabled){
        this.button('读取存档',-145,-210,250,()=>this.send({type:'LoadRun'}));this.button('导入存档文件',145,-210,250,()=>window.dispatchEvent(new Event('ember-run-import')),'#445F61');
        this.button('导出存档文件',0,-273,280,()=>window.dispatchEvent(new Event('ember-run-export')),'#445F61');this.saveStatus(s);
      }
    }
  }
  private saveStatus(s:WorldSnapshot):void {
    text('Save status',this.overlay,s.localSave?.notice||s.localSave?.label||'暂无单人存档',12,0,-326,1180,28,'#D8C6A4');
    text('Save rules',this.overlay,'营地与清场进度自动保存；战斗中读档从本关起点恢复。',11,0,-349,1150,22,'#A5C2B5');
  }
}
