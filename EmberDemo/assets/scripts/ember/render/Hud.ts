import { Graphics, Label, Node } from 'cc';
import type { ControlMode } from '../input/InputController';
import { skill,SKILL_SLOTS,SKILL_DESCRIPTIONS,DEFAULT_LOADOUT,type SkillSlot } from '../content/skills';
import { MAPS,mapDefinition,type MapId } from '../content/maps';
import { perk } from '../content/perks';
import type { GameCommand } from '../platform/protocol';
import type { WorldSnapshot } from '../simulation/GameWorld';
import type { Vec2 } from '../utils/math';
import { ArtLibrary } from './ArtLibrary';
import { drawShop,drawEquipmentDetails } from './ShopPanel';
import { DeveloperPanel } from './DeveloperPanel';
import { equipment,EQUIPMENT_SLOTS,type EquipmentId } from '../content/equipment';
import { box,color,graphics,setText,text,uiNode } from './Primitives';
interface HitRegion {x:number;y:number;width:number;height:number;action:()=>void}
export class Hud {
  private readonly hp:Label;private readonly wave:Label;private readonly meter:Graphics;
  private readonly boonList:Label;private readonly equipmentEffects:Label;private readonly debugLabel:Label;
  private readonly skills:{id:SkillSlot;g:Graphics;cd:Label;key:Label;name:Label}[]=[];
  private readonly hint:Label;private mode:ControlMode='classic';
  onControlMode?:(mode:ControlMode)=>void;
  private readonly overlay:Node;private signature='';private regions:HitRegion[]=[];
  private shopPage=0;private shopItem?:EquipmentId;private debug=false;private state?:WorldSnapshot;private inspectPerks=false;private perkPage=0;
  private readonly developerPanel:DeveloperPanel;private readonly developerBadge:Label;
  constructor(root:Node,private readonly send:(c:GameCommand)=>void,private readonly art:ArtLibrary) {
    const hud=uiNode('HUD',root),bg=graphics('HUD panels',hud);
    box(bg,-616,256,292,82,'#20373DEE',12);box(bg,354,170,262,168,'#20373DEE',12);
    box(bg,-235,296,470,40,'#20373DEE',10);
    box(bg,-616,207,292,37,'#20373DEE',8);this.developerBadge=text('Developer mode entry',hud,'开发者模式 · F2',14,-470,225,275,35,'#D6C293');
    text('Title',hud,'余 烬 试 炼',17,-470,315,260,30,'#ECDBB7');
    this.hp=text('Health values',hud,'',13,-470,272,250,25,'#C9DED2');this.meter=graphics('HP meter',hud);
    this.wave=text('Wave',hud,'',14,0,316,450,38,'#E9DBBD');
    text('Perks title',hud,'试炼印记',14,475,315,220,30,'#ECDBB7');
    this.boonList=text('Perks',hud,'尚未获得增益',13,480,261,235,76,'#B7CFC6');
    this.equipmentEffects=text('Equipment passive status',hud,'',12,480,193,235,38,'#C9DCC9');
    this.hint=text('Control hint',hud,'',13,-40,-341,1000,26,'#36585B');
    for(const [i,id] of SKILL_SLOTS.entries()){
      const x=-165+i*110,node=uiNode(`Skill ${id}`,hud,100,74);node.setPosition(x,-286);
      const g=graphics('Cooldown plate',node),key=text('Key',node,id,24,-28,3,40,40,'#E7D2A5');
      const name=text('Skill name',node,skill(DEFAULT_LOADOUT[id]).name,12,8,-23,96,24,'#BFCFC8');
      const cd=text('Cooldown',node,'',17,18,5,58,30);this.skills.push({id,g,cd,key,name});
    }
    text('Debug toggle',hud,'F3 · DEBUG',11,552,-340,150,26,'#36585B');
    this.debugLabel=text('Debug details',hud,'',11,-470,-287,285,100,'#294C4D');this.debugLabel.node.active=false;
    this.overlay=uiNode('Modal overlay',root);this.developerPanel=new DeveloperPanel(send,()=>{this.signature='';});this.setControlMode('classic');
  }
  setControlMode(mode:ControlMode):void {
    this.mode=mode;this.signature='';
    setText(this.hint,mode==='wasd'?'WASD 移动 · 左键普攻 · 右键 / Q 第一技能 · 空格 第二技能 · E / R 技能 · ESC 设置':'右键移动 · 左键朝指针普攻 · Q W E R 施法   ·   ESC 暂停与操作设置');
    for(const skill of this.skills){const space=mode==='wasd'&&skill.id==='W';skill.key.fontSize=space?14:24;setText(skill.key,space?'空格':skill.id);}
  }
  private modeButtons(y:number):void {
    for(const [i,mode] of (['classic','wasd'] as const).entries()){
      this.button(`${this.mode===mode?'● ':''}${mode==='classic'?'右键移动':'WASD 移动'}`,i===0?-145:145,y,270,()=>this.onControlMode?.(mode),this.mode===mode?'#668D7C':'#344B51');
    }
  }
  toggleDebug():void {this.debug=!this.debug;this.debugLabel.node.active=this.debug;}
  get showColliders():boolean{return this.debug;}
  update(s:WorldSnapshot,fps:number):void {
    if(s.phase!=='shop')this.shopItem=undefined;
    this.state=s;setText(this.hp,`生命 ${Math.ceil(s.hero.hp)} / ${s.hero.maxHp}    护盾 ${Math.ceil(s.hero.shield)}`);
    setText(this.developerBadge,s.network?`房间 ${s.network.code} · ${s.network.playerId===s.network.hostId?'房主':'队友'}`:s.developer?.enabled?'DEV · 测试模式 · F2':'开发者模式 · F2');
    this.meter.clear();box(this.meter,-600,290,260,6,'#48615C',3);box(this.meter,-600,290,260*s.hero.hp/s.hero.maxHp,6,'#A8D3AD',3);
    setText(this.wave,s.phase==='ready'?`PROJECT EMBER  /  ${mapDefinition(s.mapId).name}`:`${s.developer?.enabled?'DEV · ':''}${mapDefinition(s.mapId).name} · ${s.wave} / ${s.totalWaves} 关 · ${s.level.exitActive?'前往出口':s.level.remainingEnemies+' 个敌人'}${s.lab?'    ·    联动实验':''}`);
    setText(this.boonList,`金币 ${s.gold}  ·  装备 ${Object.keys(s.equipment).length}/6\n${s.appearance.weapon?equipment(s.appearance.weapon).name:'中性武器'}\n${s.perks.map(id=>perk(id).name).join(' · ')||'每关选择增益或替换技能'}`);
    setText(this.equipmentEffects,(s.equipmentPassives??[]).map(p=>`${p.kind==='spellblade'?'符击':'石息'} · ${p.readyIn>0?`冷却 ${p.readyIn.toFixed(1)}秒`:p.lockedAttackId!==undefined?'等待普攻命中':p.armedFor>0?`蓄能 ${p.armedFor.toFixed(1)}秒`:'就绪'}`).join('\n'));
    for(const {id,g,cd,name} of this.skills){const definition=skill(s.loadout[id]);setText(name,definition.name);const remaining=s.cooldowns[id],ratio=Math.min(1,remaining/(definition.cooldown*s.stats.cooldownMultiplier)),primed=s.primed&&definition.behavior.kind==='projectile';
      g.clear();box(g,-49,-37,98,74,'#243E43',10);box(g,-47,-35,94,70,remaining>0?'#30454B':'#3B5859',8);
      if(remaining>0)box(g,-47,-35,94,70*ratio,'#203138BB',7);
      if(primed){g.strokeColor=color('#E8C98C');g.lineWidth=2;g.roundRect(-48,-36,96,72,9);g.stroke();}
      setText(cd,remaining>0?remaining.toFixed(1):primed?'强化':'就绪');}
    if(this.debug)setText(this.debugLabel,`FPS ${Math.round(fps)}  ·  Tick ${s.tick}\n事件 ${s.metrics.processed} / 拦截 ${s.metrics.dropped} / 深度 ${s.metrics.maxDepth}\nSeed ${s.seed}  ·  实体 ${s.units.length} / 弹体 ${s.projectiles.length+s.enemies.projectiles.length}`);
    const signature=`${s.phase}:${s.paused}:${s.choices.map(c=>c.id).join(',')}:${s.pendingSkill}:${s.lab}:${s.mapId}:${Object.values(s.loadout).join(',')}:${s.gold}:${JSON.stringify(s.equipment)}:${s.inventory.join(',')}:${this.shopPage}:${s.developer?.open}:${s.developer?.enabled}:${s.developer?.revision}:${s.party?.find(p=>p.id===s.hero.id)?.ready}:${s.network?.blocked}:${s.network?.status}`;
    if(signature!==this.signature){this.signature=signature;this.buildModal(s);}
  }
  click(point:Vec2):boolean {
    if(this.state?.developer?.open&&this.developerPanel.click(point))return true;
    if(!this.overlay.active&&Math.abs(point.x+470)<146&&Math.abs(point.y-225)<19){this.send({type:'DevOpen'});return true;}
    if(Math.abs(point.x-552)<70&&Math.abs(point.y+340)<20){this.toggleDebug();return true;}
    const r=this.regions.find(r=>Math.abs(point.x-r.x)<=r.width/2&&Math.abs(point.y-r.y)<=r.height/2);
    if(r){r.action();return true;}return this.overlay.active;
  }
  keyChoice(index:number):void {if(this.state?.pendingSkill){const slot=SKILL_SLOTS[index];if(slot)this.send({type:'ConfirmSkill',slot});return;}const choice=this.state?.choices[index];if(choice)this.send({type:'ChooseReward',choiceId:choice.id});}
  private button(title:string,x:number,y:number,width:number,action:()=>void,fill='#547B75'):void {
    const g=graphics(title,this.overlay);box(g,x-width/2,y-23,width,46,fill,9);text(`${title} label`,this.overlay,title,16,x,y,width-20,40,'#F4EAD4');
    this.regions.push({x,y,width,height:46,action});
  }
  private buildModal(s:WorldSnapshot):void {
    for(const child of [...this.overlay.children])child.destroy();this.overlay.removeAllChildren();this.regions=[];
    this.overlay.active=!!s.developer?.open||s.phase!=='fighting'||s.paused;if(!this.overlay.active)return;
    const veil=graphics('Veil',this.overlay);box(veil,-640,-360,1280,720,'#10242CEB',0);
    if(s.network?.blocked){text('Network waiting',this.overlay,s.network.status,23,0,40,1100,150,'#EFE2C1');text('Network hint',this.overlay,'打开左上角「联机房间」查看队友、重连或恢复进度。',17,0,-70,1000,60,'#B5CFC4');return;}
    if(s.party?.find(p=>p.id===s.hero.id)?.ready&&(s.phase==='shop'||s.phase==='reward')){text('Team waiting',this.overlay,'已确认，等待队友完成整备 / 奖励选择',25,0,40,1100,150,'#EFE2C1');return;}
    if(s.developer?.open){this.developerPanel.draw(this.overlay,s,this.button.bind(this));return;}
    if(!s.network&&s.phase!=='ready')this.button('开发者面板 · F2',470,312,270,()=>this.send({type:'DevOpen'}),'#586552');
    if(s.phase==='ready'){
      text('Eyebrow',this.overlay,'PROJECT EMBER   /   v0.8',13,0,222,600,30,'#9ABDB4');
      this.button('开发者模式 · F2',445,222,280,()=>this.send({type:'DevOpen'}),'#586552');
      text('Game title',this.overlay,'余 烬 试 炼',56,0,172,800,100,'#EFE2C1');
      text('Subtitle',this.overlay,`探索${mapDefinition(s.mapId).name}，穿过 ${s.totalWaves} 关试炼，清怪后抵达出口。`,19,0,109,650,40,'#B5CFC4');
      this.modeButtons(45);
      text('Instructions',this.overlay,this.mode==='wasd'?'WASD 移动，左键按住朝指针普攻，右键 / Q 施放主技能。\n空格 / E / R 使用对应槽位的技能\n准星瞄准地面位置；F3 查看碰撞体积。':'右键移动，左键按住朝指针挥击或发射。\nQ / W / E / R 使用对应槽位的技能\n准星瞄准地面位置；F3 查看碰撞体积。',15,0,-35,900,90,'#D3DDD0');
      this.button(`地图：${mapDefinition(s.mapId).name}`, -330,-106,285,()=>{const ids=Object.keys(MAPS) as MapId[];this.send({type:'SelectMap',mapId:ids[(ids.indexOf(s.mapId)+1)%ids.length]!});},'#3E5559');
      text('No class',this.overlay,'无职业限制 · 技能自由组合',15,330,-106,285,46,'#B8D4C7');
      this.button('启程整备  ↵',0,-106,256,()=>this.send({type:'Start'}));
      text('Lab title',this.overlay,'联动实验 / 预装增益组合 · 海克斯数值已适配 PvE',12,0,-169,800,30,'#97B7B0');
      this.button('燃烧弹 → 尸爆',-280,-216,245,()=>this.send({type:'Start',lab:'burn'}),'#3E5559');
      this.button('尸爆 → 电弧',0,-216,245,()=>this.send({type:'Start',lab:'arc'}),'#3E5559');
      this.button('奥能储备 → 双重施法',280,-216,245,()=>this.send({type:'Start',lab:'reserve'}),'#3E5559');
      this.button('海克斯 · 法术爆发',-280,-276,245,()=>this.send({type:'Start',lab:'hexMage'}),'#4E6074');
      this.button('海克斯 · 普攻联动',0,-276,245,()=>this.send({type:'Start',lab:'hexAttack'}),'#526B64');
      this.button('海克斯 · 冲刺续航',280,-276,245,()=>this.send({type:'Start',lab:'hexSurvive'}),'#70684F');
      text('Seed',this.overlay,`固定种子 ${s.seed}  ·  正常启程从零选择增益  ·  本轮新增 12 个海克斯`,12,0,-328,960,25,'#88A6A1');
    }else if(s.phase==='shop'){
      if(this.shopItem)drawEquipmentDetails(this.overlay,s,this.shopItem,this.button.bind(this),()=>{this.shopItem=undefined;this.signature='';},this.art);
      else drawShop(this.overlay,s,this.shopPage,p=>{this.shopPage=p;this.signature='';},this.button.bind(this),this.send,this.art,id=>{this.shopItem=id;this.signature='';});
    }else if(s.paused&&this.inspectPerks){
      text('Build title',this.overlay,'本局增益',34,0,265,850,60,'#EFE2C1');
      const pages=Math.max(1,Math.ceil(s.perks.length/4));this.perkPage=Math.min(this.perkPage,pages-1);
      for(const [i,id] of s.perks.slice(this.perkPage*4,this.perkPage*4+4).entries()){
        const p=perk(id),x=i%2===0?-265:265,y=i<2?110:-90,g=graphics(`Inspect ${id}`,this.overlay);box(g,x-245,y-85,490,170,'#2D464C',12);
        text('Name',this.overlay,p.name,22,x,y+48,450,40,p.color);text('Description',this.overlay,p.description,16,x,y-13,440,100,'#C2D6CA');
      }
      if(!s.perks.length)text('Empty build',this.overlay,'完成关卡后，可从奖励中选择增益。',20,0,30,800,80,'#C2D6CA');
      this.button('上一页',-290,-253,220,()=>{this.perkPage=(this.perkPage+pages-1)%pages;this.signature='';},'#3E5559');
      this.button(`返回暂停 · ${this.perkPage+1}/${pages}`,0,-253,280,()=>{this.inspectPerks=false;this.signature='';});
      this.button('下一页',290,-253,220,()=>{this.perkPage=(this.perkPage+1)%pages;this.signature='';},'#3E5559');
      text('Hex rules note',this.overlay,'PvE 适配数值 · 战斗已暂停 · 触发冷却和计数在每关开始时重置',13,0,-319,1100,35,'#A5C2B5');
    }else if(s.paused){
      text('Pause title',this.overlay,s.network?'操作设置 · 战斗继续':'火种暂歇',42,0,160,700,80,'#EFE2C1');
      this.modeButtons(98);
      const help=this.mode==='wasd'?'WASD：沿屏幕方向移动，松开即停\n左键按住：朝指针普攻    右键 / Q：朝指针施放主技能\n空格 / E / R：使用当前槽位技能':'右键：移动    /    左键按住：朝指针普攻\nQ / W / E / R：使用当前槽位技能';
      text('Help',this.overlay,help+'\n红色圆环 / 射线：敌人攻击预警    F3：调试信息\n增益可选主动技能；选择后用 1–4 确认替换槽位。',17,0,-28,1000,200,'#CDDCD0');
      this.button('继续试炼  ESC',-145,-164,250,()=>this.send({type:'TogglePause'}));this.button(s.network?'离开联机房间':s.developer?.enabled?'重测当前配置':'重新开始',145,-164,250,()=>this.send({type:'Restart'}),'#675B58');
      this.button(`查看本局增益 · ${s.perks.length}`,0,-230,330,()=>{this.inspectPerks=true;this.perkPage=0;this.signature='';},'#3E5559');
    }else if(s.phase==='reward'&&s.pendingSkill){
      text('Skill acquired',this.overlay,`选择技能：${skill(s.pendingSkill).name}`,32,0,225,1000,60,'#EFE2C1');
      text('Skill description',this.overlay,SKILL_DESCRIPTIONS[s.pendingSkill]+'  选择要替换的槽位。',17,0,159,1060,55,'#BED9CD');
      for(const [i,slot] of SKILL_SLOTS.entries()){
        const x=(i-1.5)*280,g=graphics(`Replace ${slot}`,this.overlay);box(g,x-128,-115,256,225,'#2D464C',12);
        text('Slot key',this.overlay,`${i+1} · ${this.mode==='wasd'&&slot==='W'?'空格':slot}`,22,x,65,220,45,'#AED7E2');
        text('Old skill',this.overlay,skill(s.loadout[slot]).name,22,x,5,220,45,'#EFE2C1');
        this.button('替换此技能',x,-66,226,()=>this.send({type:'ConfirmSkill',slot}));
      }
      this.button('返回增益选择',0,-213,280,()=>this.send({type:'CancelSkill'}),'#445F61');
      text('Replacement note',this.overlay,'只替换所选槽位；被动增益保留，缺少对应技能时暂不生效。',14,0,-280,1000,35,'#A3BEB1');
    }else if(s.phase==='reward'){
      text('Reward eyebrow',this.overlay,`第 ${s.wave} 关已完成   /   战斗已冻结`,14,0,238,700,30,'#A8C4B7');
      text('Reward title',this.overlay,'选择增益 · 组合你的技能',35,0,180,850,70,'#EFE2C1');
      for(const [i,choice] of s.choices.entries()){
        const id=choice.id,p=choice.kind==='perk'?perk(choice.perkId):{name:skill(choice.skillId).name,color:'#9CCFE8',description:SKILL_DESCRIPTIONS[choice.skillId]+' 选择后替换任意技能槽。'},x=(i-1)*324,g=graphics(`Perk ${id}`,this.overlay);
        box(g,x-148,-129,296,250,'#2D464C',14);box(g,x-148,116,296,5,p.color,2);
        text('Perk number',this.overlay,`${i+1} · ${choice.kind==='skill'?'主动技能':'被动增益'}`,13,x,85,240,30,p.color);
        text('Perk name',this.overlay,p.name,25,x,40,250,50,'#F1E4C7');
        text('Perk description',this.overlay,p.description,16,x,-43,260,145,'#C2D6CA');
        this.button(`选择  ${i+1}`,x,-174,250,()=>this.send({type:'ChooseReward',choiceId:id}));
        this.regions.push({x,y:0,width:296,height:250,action:()=>this.send({type:'ChooseReward',choiceId:id})});
      }
      text('Reward footer',this.overlay,s.wave===s.totalWaves?'选择后查看通关结果':'完成选择后继续旅程；下一关恢复 30 生命并刷新冷却。',13,0,-264,850,30,'#A5C2B5');
    }else{
      const won=s.phase==='victory';text('Result eyebrow',this.overlay,won?'TRIAL COMPLETE':'THE EMBER REMAINS',14,0,186,800,40,'#A2C6B6');
      text('Result title',this.overlay,won?'余烬长明':'火种未熄',48,0,105,800,100,'#EFE2C1');
      text('Result stats',this.overlay,`${won?`${s.totalWaves} 波试炼已通过`:'此次止步第 '+s.wave+' 波'}   ·   击杀 ${s.units.filter(u=>u.team==='hero'&&!u.alive).length?s.kills-1:s.kills}   ·   ${Math.floor(s.time)} 秒\n${s.perks.map(id=>perk(id).name).join('  /  ')||'再次尝试，寻找属于你的组合。'}`,17,0,0,940,100,'#C5D7CB');
      this.button(s.network?'返回单人首页  ↵':'再来一次  ↵',0,-130,280,()=>this.send({type:'Restart'}));
    }
  }
}
