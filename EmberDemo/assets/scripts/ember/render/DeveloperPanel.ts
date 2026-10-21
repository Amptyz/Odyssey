import {JOURNEYS} from '../content/scenes';
import {STAT_KEYS,type Stat} from '../combat-core/attributes/AttributeSet';
import { EditBox,Label,Node,UITransform } from 'cc';
import type { Vec2 } from '../utils/math';
import { MAPS,mapDefinition,type MapId } from '../content/maps';
import { HERO_SKILLS,SKILL_SLOTS,skill,skillSlotName,type SkillSlot } from '../content/skills';
import { PERKS,perk } from '../content/perks';
import { EQUIPMENT_SLOTS,SHOP_CATALOG,SLOT_NAMES,equipment } from '../content/equipment';
import { ENEMIES,type EnemyKind } from '../content/enemies';
import type { PerkId } from '../combat-core/types';
import type { GameCommand } from '../platform/protocol';
import type { WorldSnapshot } from '../simulation/GameWorld';
import { DEV_SPEEDS,cloneDeveloperConfig,loadDeveloperPreset,parseDeveloperConfig,saveDeveloperPreset,type DeveloperConfig } from '../simulation/DeveloperConfig';
import { box,graphics,text,uiNode } from './Primitives';
type Button=(title:string,x:number,y:number,width:number,action:()=>void,fill?:string)=>void;
/** Catalog-driven tooling UI. Mutations go through the same validated command boundary as tests. */
export class DeveloperPanel {
  private attributeStat:Stat='attackDamage';private inspectIndex=0;private aiIndex=0;private tab=0;private slot:SkillSlot='Q';private skillPage=0;private perkPage=0;private selectedPerk?:PerkId;
  private enemyId:EnemyKind='melee';private spawnCount:1|5=1;private repro='';private reproBox?:EditBox;
  private fields:{x:number;y:number;w:number;h:number;edit:EditBox}[]=[];
  constructor(private readonly send:(command:GameCommand)=>void,private readonly invalidate:()=>void){}
  private notice(message:string):void {this.send({type:'DevNotice',message});}
  private attempt(action:()=>void):void {try{action();}catch(e){this.notice(e instanceof Error?e.message:'操作失败，浏览器可能禁用了本地存储。');}}
  private configure(c:DeveloperConfig):void {this.send({type:'DevConfigure',config:c});}
  click(p:Vec2):boolean {const field=this.fields.find(f=>Math.abs(p.x-f.x)<f.w/2&&Math.abs(p.y-f.y)<f.h/2);if(!field)return false;field.edit.focus();return true;}
  draw(root:Node,s:WorldSnapshot,button:Button):void {
    this.fields=[];
    const dev=s.developer!,c=cloneDeveloperConfig(dev.draft);
    const bg=graphics('Developer panel background',root);box(bg,-612,-230,1224,440,'#263E45',12);
    text('Developer title',root,'开发者模式 · 组合与关卡测试',29,0,312,1100,44,'#EDD39E');
    text('Developer subtitle',root,'面板打开时冻结战斗；修改配置后「应用并进入」将重新生成关卡。',14,0,275,1100,30,'#BBD1C7');
    ['关卡 / 工具','技能 / 装备','余烬','预设 / 复现','属性 / 来源'].forEach((name,i)=>button(name,(i-2)*232,237,220,()=>{this.tab=i;this.invalidate();},this.tab===i?'#6C806A':'#3C555C'));
    button('敌人 AI',500,312,200,()=>{this.tab=5;this.invalidate();},this.tab===5?'#6C806A':'#3C555C');
    if(this.tab===0)this.level(root,s,c,button);
    if(this.tab===1)this.build(root,c,button);
    if(this.tab===2)this.perks(root,c,button);
    if(this.tab===3)this.presets(root,c,button);
    if(this.tab===4)this.attributes(root,s,c,button);
    if(this.tab===5)this.enemyAI(root,s,button);
    text('Developer notice',root,dev.notice||'配置未自动保存。可在「预设 / 复现」保存组合，或导出文本记录 Bug 场景。',14,0,-263,1170,44,'#E6C88F');
    button('退出测试 → 普通首页',-440,-322,260,()=>this.send({type:'DevExit'}),'#685852');
    button('关闭面板 · F2 / Esc',-150,-322,270,()=>this.send({type:'DevClose'}),'#3C555C');
    button('重测已应用配置',145,-322,260,()=>{if(dev.enabled)this.send({type:'DevRestart'});else this.notice('请先应用一份测试配置。');},dev.enabled?'#516C72':'#354A50');
    button('应用并进入关卡',440,-322,260,()=>this.send({type:'DevApply'}),'#76855B');
  }
  private field(root:Node,name:string,value:string,x:number,y:number,w:number,h:number,multiline:boolean,done:(value:string)=>void):EditBox {
    const node=uiNode(name,root,w,h);node.active=false;node.setPosition(x,y);const g=graphics(`${name} background`,node);box(g,-w/2,-h/2,w,h,'#152D35',8);
    const label=text(`${name} text`,node,value,multiline?13:19,0,0,w-20,h-10,'#E0E8DC');label.horizontalAlign=Label.HorizontalAlign.LEFT;label.verticalAlign=multiline?Label.VerticalAlign.TOP:Label.VerticalAlign.CENTER;
    const placeholder=text(`${name} placeholder`,node,'',14,0,0,w-20,h-10,'#91ACA5');
    label.node.getComponent(UITransform)!.setAnchorPoint(0,1);placeholder.node.getComponent(UITransform)!.setAnchorPoint(0,1);
    const edit=node.addComponent(EditBox);edit.textLabel=label;edit.placeholderLabel=placeholder;edit.inputMode=multiline?EditBox.InputMode.ANY:EditBox.InputMode.SINGLE_LINE;
    edit.inputFlag=EditBox.InputFlag.DEFAULT;edit.maxLength=multiline?12000:10;edit.string=value;
    node.on('editing-did-ended',()=>done(edit.string));node.active=true;this.fields.push({x,y,w,h,edit});return edit;
  }
  private level(root:Node,s:WorldSnapshot,c:DeveloperConfig,button:Button):void {
    button(`地图：${mapDefinition(c.mapId).name}`,-390,165,340,()=>{const ids=Object.keys(MAPS) as MapId[];c.mapId=ids[(ids.indexOf(c.mapId)+1)%ids.length]!;c.wave=Math.min(c.wave,mapDefinition(c.mapId).waves.length);if(c.entry==='camp'&&c.wave!==1&&!JOURNEYS[c.mapId].rests[c.wave-1])c.wave=1;this.configure(c);});
    const waves=mapDefinition(c.mapId).waves.length,entries=c.entry==='camp'?[1,...Object.keys(JOURNEYS[c.mapId].rests).map(w=>Number(w)+1)]:Array.from({length:waves},(_,i)=>i+1);
    button('−',-120,165,70,()=>{c.wave=entries[(entries.indexOf(c.wave)+entries.length-1)%entries.length]!;this.configure(c);});
    text('Developer wave',root,`第 ${c.wave} / ${waves} 关`,19,5,165,170,40,'#E9DEBE');
    button('+',130,165,70,()=>{c.wave=entries[(entries.indexOf(c.wave)+1)%entries.length]!;this.configure(c);});
    text('Seed label',root,'随机种子（整数）',13,375,199,300,26,'#BBD1C7');
    this.field(root,'Developer seed',String(c.seed),375,163,300,42,false,value=>{c.seed=value.trim()===''?NaN:Number(value);this.configure(c);});
    for(const [i,key,name] of [[0,'invincible','玩家免伤'],[1,'noCooldown','技能无冷却'],[2,'freezeEnemies','停止敌人 AI']] as const)
      button(`${c.options[key]?'✓':'○'} ${name}`,(i-1)*390,93,340,()=>{c.options[key]=!c.options[key];this.configure(c);},c.options[key]?'#6E805A':'#3F5960');
    button(`时间倍率：${c.options.speed}×`,-390,31,340,()=>{c.options.speed=DEV_SPEEDS[(DEV_SPEEDS.indexOf(c.options.speed)+1)%DEV_SPEEDS.length]!;this.configure(c);});
    button(`场景：${c.entry==='camp'?'营地 / 休息点':'战斗关卡'}`,185,31,700,()=>{c.entry=c.entry==='camp'?'combat':'camp';if(c.entry==='camp'&&c.wave!==1&&!JOURNEYS[c.mapId].rests[c.wave-1])c.wave=1;this.configure(c);});
    for(const [i,action,title] of [[0,'recover','满血 / 复活'],[1,'health25','生命设为 25%'],[2,'cooldowns','刷新冷却'],[3,'clearEnemies','清空敌人'],[4,'step','步进 1 帧']] as const)
      button(title,(i-2)*220,-35,200,()=>{if(!s.developer?.enabled)this.notice('先应用配置进入测试关卡，再使用即时工具。');else this.send({type:'DevAction',action});},'#4A6267');
    button(`生成：${ENEMIES[this.enemyId].name}`,-290,-105,360,()=>{const ids=Object.keys(ENEMIES) as EnemyKind[];this.enemyId=ids[(ids.indexOf(this.enemyId)+1)%ids.length]!;this.invalidate();});
    button(`数量：${this.spawnCount}`,50,-105,240,()=>{this.spawnCount=this.spawnCount===1?5:1;this.invalidate();});
    button('在周围生成',360,-105,280,()=>{if(!s.developer?.enabled)this.notice('请先应用配置进入测试关卡。');else this.send({type:'DevSpawn',enemyId:this.enemyId,count:this.spawnCount});});
    text('Tool notes',root,'即时工具作用于当前关卡；清空敌人不触发击杀奖励。测试关卡清空后继续停留，可重新刷怪。\n停止 AI 不冻结已发射弹体；步进固定推进 1/30 秒。免伤、无冷却等开关在应用后生效。',14,0,-183,1140,65,'#A9C2B8');
  }
  private build(root:Node,c:DeveloperConfig,button:Button):void {
    for(const [i,slot] of SKILL_SLOTS.entries())button(`${slot} · ${skillSlotName(c.loadout[slot])}`,(i-1.5)*280,165,260,()=>{this.slot=slot;this.invalidate();},slot===this.slot?'#7D8060':'#3C555C');
    const pages=Math.max(1,Math.ceil(HERO_SKILLS.length/6));this.skillPage=Math.min(this.skillPage,pages-1);
    for(const [i,id] of HERO_SKILLS.slice(this.skillPage*6,this.skillPage*6+6).entries()){
      const equipped=SKILL_SLOTS.find(slot=>c.loadout[slot]===id);
      button(`${equipped?equipped+' · ':''}${skill(id).name}`,(i%3-1)*390,93-Math.floor(i/3)*58,350,()=>{const old=c.loadout[this.slot];if(equipped)c.loadout[equipped]=old;c.loadout[this.slot]=id;this.configure(c);},equipped?'#546D68':'#3D555C');
    }
    button(`← 技能 ${this.skillPage+1}/${pages}`,-390,-31,300,()=>{this.skillPage=(this.skillPage+pages-1)%pages;this.invalidate();});
    button('读取当前搭配',-120,-31,220,()=>this.send({type:'DevCapture'}),'#4C6470');
    button('清空当前技能槽',120,-31,220,()=>{c.loadout[this.slot]=null;this.configure(c);});
    button(`技能 ${this.skillPage+1}/${pages} →`,390,-31,300,()=>{this.skillPage=(this.skillPage+1)%pages;this.invalidate();});
    for(const [i,slot] of EQUIPMENT_SLOTS.entries()){
      const id=c.equipment[slot],ids=[undefined,...SHOP_CATALOG.filter(candidate=>!Object.entries(c.equipment).some(([key,value])=>key!==slot&&value===candidate))];
      button(`${SLOT_NAMES[slot]}：${id?equipment(id).name:'空'}`,(i%3-1)*390,-96-Math.floor(i/3)*55,350,()=>{const next=ids[(ids.indexOf(id)+1)%ids.length];if(next){c.equipment[slot]=next;}else delete c.equipment[slot];this.configure(c);});
    }
    text('Build notes',root,`先选 Q/W/E/R 槽，再点击技能；已选技能会交换。六个装备栏不限类型，同一物品不重复。\n点击装备栏循环选择；外观按部位显示最后加入购买顺序的当前装备。`,14,0,-202,1150,45,'#BBD1C7');
  }
  private perks(root:Node,c:DeveloperConfig,button:Button):void {
    const pages=Math.max(1,Math.ceil(PERKS.length/10));this.perkPage=Math.min(this.perkPage,pages-1);
    for(const [i,p] of PERKS.slice(this.perkPage*10,this.perkPage*10+10).entries()){
      const owned=c.perks.includes(p.id);button(`${owned?'✓':'○'} ${p.name}`,i%2===0?-295:295,165-Math.floor(i/2)*57,550,()=>{this.selectedPerk=p.id;c.perks=owned?c.perks.filter(id=>id!==p.id):[...c.perks,p.id];this.configure(c);},owned?'#647A61':'#3C555C');
    }
    button('上一页',-480,-125,180,()=>{this.perkPage=(this.perkPage+pages-1)%pages;this.invalidate();});
    button('清空余烬',-250,-125,210,()=>{c.perks=[];this.configure(c);},'#685852');
    text('Developer perk count',root,`${this.perkPage+1}/${pages} 页 · 已选 ${c.perks.length}`,15,0,-125,230,40,'#E9DEBE');
    button('全选余烬',250,-125,210,()=>{c.perks=PERKS.map(p=>p.id);this.configure(c);});
    button('下一页',480,-125,180,()=>{this.perkPage=(this.perkPage+1)%pages;this.invalidate();});
    text('Selected perk detail',root,this.selectedPerk?`${perk(this.selectedPerk).name}：${perk(this.selectedPerk).description}`:'点击余烬即可勾选或移除。此处可选择所有余烬；不满足触发条件的余烬仍保持休眠。',15,0,-188,1140,68,'#C2D6CA');
  }
  private attributes(root:Node,s:WorldSnapshot,c:DeveloperConfig,button:Button):void {
    const units=s.units;this.inspectIndex=Math.min(this.inspectIndex,Math.max(0,units.length-1));const unit=units[this.inspectIndex];
    button(`查看单位：${unit?.id??'无'}`,-350,165,450,()=>{this.inspectIndex=(this.inspectIndex+1)%Math.max(1,units.length);this.invalidate();});
    button(`测试目标：${c.attributeTarget??'players'}`,220,165,450,()=>{const targets=['players','enemies','all'] as const;c.attributeTarget=targets[(targets.indexOf(c.attributeTarget??'players')+1)%3];this.configure(c);});
    button(`属性：${this.attributeStat}`,-350,105,450,()=>{this.attributeStat=STAT_KEYS[(STAT_KEYS.indexOf(this.attributeStat)+1)%STAT_KEYS.length]!;this.invalidate();});
    const existing=c.attributeModifiers?.find(m=>m.stat===this.attributeStat);
    this.field(root,'Attribute flat modifier',String(existing?.value??0),220,105,450,40,false,value=>{const n=Number(value);c.attributeModifiers=[...(c.attributeModifiers??[]).filter(m=>m.stat!==this.attributeStat),{stat:this.attributeStat,operation:'flat',value:n}];this.configure(c);});
    button('清除测试属性',-350,45,450,()=>{c.attributeModifiers=[];this.configure(c);});
    text('Attribute help',root,'输入固定加成；百分比/倍率/分组可通过复现文本配置。应用后生效。',14,220,45,600,40,'#BBD1C7');
    const info=unit?.attributeExplanation;
    const values=unit?.attributeValues;
    const summary=values?STAT_KEYS.map(key=>`${key==='moveSpeed'?'rawMoveSpeed':key}: ${values[key].toFixed(2)}`).join('  '):'无单位';
    text('Attribute values',root,summary,13,0,-40,1120,100,'#D0DFD1');
    const sources=info?.sources.map(source=>`${source.sourceId}: ${source.modifiers.map(m=>`${m.stat} ${m.operation} ${m.value}`).join(', ')}`).join('\n')??'';
    text('Attribute sources',root,`模板 MS ${info?.template.moveSpeed??0}；最终移速 ${unit?.movementPoints.toFixed(2)??0} 点 / ${unit?.worldMoveSpeed.toFixed(2)??0} 格/秒\n${sources||'无额外属性来源'}`,13,0,-163,1120,125,'#BBD1C7');
  }
  private enemyAI(root:Node,s:WorldSnapshot,button:Button):void {
    const enemies=s.enemies.units.filter(e=>s.units.some(u=>u.id===e.id&&u.alive));
    this.aiIndex=Math.min(this.aiIndex,Math.max(0,enemies.length-1));const unit=enemies[this.aiIndex],d=unit?.decision;
    button('上一个敌人',-425,165,260,()=>{this.aiIndex=(this.aiIndex+enemies.length-1)%Math.max(1,enemies.length);this.invalidate();});
    text('Enemy AI selected',root,unit?`${ENEMIES[unit.kind].name} · ${unit.id}`:'当前没有已调度的存活敌人',18,0,165,540,40,'#E9DEBE');
    button('下一个敌人',425,165,260,()=>{this.aiIndex=(this.aiIndex+1)%Math.max(1,enemies.length);this.invalidate();});
    text('Enemy AI decision',root,d?`配置 ${d.profile}  ·  阶段 ${unit!.phase}  ·  动作 ${unit!.actionId??'无'} / ${unit!.state}\n目标 ${d.targetId??'无'}  ·  本招目标 ${d.actionTargetId??'无'}  ·  换目标来源 ${d.targetReason}\n规则 ${d.ruleId??'无'}  ·  序列 ${d.sequence?`${d.sequence.id} / 第 ${d.sequence.step+1} 步 / 等待 ${d.sequence.waitRemaining.toFixed(2)} 秒`:'无'}\n决策 ${d.reason}  ·  额外停顿剩余 ${d.pauseRemaining.toFixed(2)} 秒`:'进入战斗或生成敌人后，至少推进一帧以初始化 AI。',17,0,63,1120,140,'#D0DFD1');
    text('Enemy AI cooldowns',root,`冷却（秒）\n${d?.cooldowns.map(cd=>`${cd.key}: ${cd.remaining.toFixed(2)}`).join('\n')||'无正在计时的冷却'}`,15,0,-89,1120,150,'#BBD1C7');
    text('Enemy AI help',root,'关闭 F2 推进战斗，再打开检查；也可单帧步进。\nblocked:action / global / group / target 为冷却；range / line-of-sight 为距离或遮挡。',13,-160,-199,800,46,'#A9C2B8');
    button('AI 步进一帧',425,-192,250,()=>{if(s.developer?.enabled)this.send({type:'DevAction',action:'step'});else this.notice('先应用测试配置，再使用步进。');});
  }
  private presets(root:Node,c:DeveloperConfig,button:Button):void {
    for(let slot=1;slot<=3;slot++){
      const x=(slot-2)*390;
      button(`保存 ${slot}`,x-92,165,176,()=>this.attempt(()=>{saveDeveloperPreset(localStorage,slot,c);this.notice(`已保存到本机预设 ${slot}。`);}));
      button(`载入 ${slot}`,x+92,165,176,()=>this.attempt(()=>{this.configure(loadDeveloperPreset(localStorage,slot));this.notice(`已载入预设 ${slot}，点击应用进入测试。`);}), '#4C6470');
    }
    text('Repro help',root,'复现文本可手动复制粘贴到其他电脑。保存初始配置与种子，不包含战斗中途存档或操作录像。',14,0,110,1130,35,'#BBD1C7');
    if(!this.repro)this.repro=JSON.stringify(c);
    this.reproBox=this.field(root,'Developer reproduction',this.repro,0,-20,1120,210,true,value=>{this.repro=value;});
    button('导出当前待应用配置',-290,-177,380,()=>{this.repro=JSON.stringify(c);this.notice('已生成配置文本，可在文本框中全选复制。');});
    button('导入文本为待应用配置',290,-177,380,()=>this.attempt(()=>{this.repro=this.reproBox?.string??this.repro;this.configure(parseDeveloperConfig(this.repro));this.notice('文本校验通过。点击应用进入关卡。');}));
  }
}
