import { Graphics, Label, Node } from 'cc';
import type { ControlMode } from '../input/InputController';
import { SKILLS, type SkillId } from '../content/config';
import { perk } from '../content/perks';
import type { GameCommand } from '../platform/protocol';
import type { WorldSnapshot } from '../simulation/GameWorld';
import type { Vec2 } from '../utils/math';
import { box,color,graphics,setText,text,uiNode } from './Primitives';
interface HitRegion {x:number;y:number;width:number;height:number;action:()=>void}
export class Hud {
  private readonly hp:Label;private readonly wave:Label;private readonly meter:Graphics;
  private readonly boonList:Label;private readonly debugLabel:Label;
  private readonly skills:{id:SkillId;g:Graphics;cd:Label;key:Label}[]=[];
  private readonly hint:Label;private mode:ControlMode='classic';
  onControlMode?:(mode:ControlMode)=>void;
  private readonly overlay:Node;private signature='';private regions:HitRegion[]=[];
  private debug=false;private state?:WorldSnapshot;
  constructor(root:Node,private readonly send:(c:GameCommand)=>void) {
    const hud=uiNode('HUD',root),bg=graphics('HUD panels',hud);
    box(bg,-616,256,292,82,'#20373DEE',12);box(bg,354,206,262,132,'#20373DEE',12);
    text('Title',hud,'余 烬 试 炼',17,-470,315,260,30,'#ECDBB7');
    this.hp=text('Health values',hud,'',13,-470,272,250,25,'#C9DED2');this.meter=graphics('HP meter',hud);
    this.wave=text('Wave',hud,'',14,0,316,450,38,'#E9DBBD');
    text('Perks title',hud,'试炼印记',14,475,315,220,30,'#ECDBB7');
    this.boonList=text('Perks',hud,'尚未获得增益',13,480,261,235,76,'#B7CFC6');
    this.hint=text('Control hint',hud,'',13,-40,-341,1000,26,'#B6C7C3');
    for(const [i,id] of (Object.keys(SKILLS) as SkillId[]).entries()){
      const x=-165+i*110,node=uiNode(`Skill ${id}`,hud,100,74);node.setPosition(x,-286);
      const g=graphics('Cooldown plate',node),key=text('Key',node,id,24,-28,3,40,40,'#E7D2A5');
      text('Skill name',node,SKILLS[id].name,12,8,-23,96,24,'#BFCFC8');
      const cd=text('Cooldown',node,'',17,18,5,58,30);this.skills.push({id,g,cd,key});
    }
    text('Debug toggle',hud,'F3 · DEBUG',11,552,-340,150,26,'#A3BDB4');
    this.debugLabel=text('Debug details',hud,'',11,-470,-287,285,100,'#B9D7CB');this.debugLabel.node.active=false;
    this.overlay=uiNode('Modal overlay',root);this.setControlMode('classic');
  }
  setControlMode(mode:ControlMode):void {
    this.mode=mode;this.signature='';
    setText(this.hint,mode==='wasd'?'WASD 移动 · 左键普攻 · 右键 / Q 火焰弹 · 空格护盾 · E 冲刺 · R 爆发 · ESC 设置':'右键移动 / 锁敌   ·   Q W E R 施法   ·   ESC 暂停与操作设置');
    for(const skill of this.skills){const space=mode==='wasd'&&skill.id==='W';skill.key.fontSize=space?14:24;setText(skill.key,space?'空格':skill.id);}
  }
  private modeButtons(y:number):void {
    for(const [i,mode] of (['classic','wasd'] as const).entries()){
      this.button(`${this.mode===mode?'● ':''}${mode==='classic'?'右键移动':'WASD 移动'}`,i===0?-145:145,y,270,()=>this.onControlMode?.(mode),this.mode===mode?'#668D7C':'#344B51');
    }
  }
  toggleDebug():void {this.debug=!this.debug;this.debugLabel.node.active=this.debug;}
  update(s:WorldSnapshot,fps:number):void {
    this.state=s;setText(this.hp,`生命 ${Math.ceil(s.hero.hp)} / ${s.hero.maxHp}    护盾 ${Math.ceil(s.hero.shield)}`);
    this.meter.clear();box(this.meter,-600,290,260,6,'#48615C',3);box(this.meter,-600,290,260*s.hero.hp/s.hero.maxHp,6,'#A8D3AD',3);
    setText(this.wave,s.phase==='ready'?'PROJECT EMBER  /  单人试炼':`第 ${String(s.wave).padStart(2,'0')} / 03 波    ·    ${s.units.filter(u=>u.alive&&u.team==='enemy').length} 个敌人${s.lab?'    ·    联动实验':''}`);
    setText(this.boonList,s.perks.length?s.perks.map(id=>perk(id).name).join('  ·  '):'击败一波敌人，选择你的印记。');
    for(const {id,g,cd} of this.skills){const remaining=s.cooldowns[id],ratio=remaining/SKILLS[id].cooldown;
      g.clear();box(g,-49,-37,98,74,'#243E43',10);box(g,-47,-35,94,70,remaining>0?'#30454B':'#3B5859',8);
      if(remaining>0)box(g,-47,-35,94,70*ratio,'#203138BB',7);
      if(id==='Q'&&s.primed){g.strokeColor=color('#E8C98C');g.lineWidth=2;g.roundRect(-48,-36,96,72,9);g.stroke();}
      setText(cd,remaining>0?remaining.toFixed(1):s.primed&&id==='Q'?'强化':'就绪');}
    if(this.debug)setText(this.debugLabel,`FPS ${Math.round(fps)}  ·  Tick ${s.tick}\n事件 ${s.metrics.processed} / 拦截 ${s.metrics.dropped} / 深度 ${s.metrics.maxDepth}\nSeed ${s.seed}  ·  实体 ${s.units.length} / 弹体 ${s.projectiles.length}`);
    const signature=`${s.phase}:${s.paused}:${s.choices.join(',')}:${s.lab}`;
    if(signature!==this.signature){this.signature=signature;this.buildModal(s);}
  }
  click(point:Vec2):boolean {
    if(Math.abs(point.x-552)<70&&Math.abs(point.y+340)<20){this.toggleDebug();return true;}
    const r=this.regions.find(r=>Math.abs(point.x-r.x)<=r.width/2&&Math.abs(point.y-r.y)<=r.height/2);
    if(r){r.action();return true;}return this.overlay.active;
  }
  keyChoice(index:number):void {const id=this.state?.choices[index];if(id)this.send({type:'ChoosePerk',perkId:id});}
  private button(title:string,x:number,y:number,width:number,action:()=>void,fill='#547B75'):void {
    const g=graphics(title,this.overlay);box(g,x-width/2,y-23,width,46,fill,9);text(`${title} label`,this.overlay,title,16,x,y,width-20,40,'#F4EAD4');
    this.regions.push({x,y,width,height:46,action});
  }
  private buildModal(s:WorldSnapshot):void {
    for(const child of [...this.overlay.children])child.destroy();this.overlay.removeAllChildren();this.regions=[];
    this.overlay.active=s.phase!=='fighting'||s.paused;if(!this.overlay.active)return;
    const veil=graphics('Veil',this.overlay);box(veil,-640,-360,1280,720,'#10242CEB',0);
    if(s.phase==='ready'){
      text('Eyebrow',this.overlay,'PROJECT EMBER   /   v0.1',13,0,222,600,30,'#9ABDB4');
      text('Game title',this.overlay,'余 烬 试 炼',56,0,172,800,100,'#EFE2C1');
      text('Subtitle',this.overlay,'唤醒火种，穿过三场试炼。',19,0,109,650,40,'#B5CFC4');
      this.modeButtons(45);
      text('Instructions',this.overlay,this.mode==='wasd'?'WASD 移动，左键按住朝指针普攻，右键 / Q 发射火焰弹。\n空格 护盾   ·   E 朝指针冲刺   ·   R 自身周围爆发\n每波结束选择印记；ESC 可随时切换操作方式。':'右键地面移动，右键敌人追击并普攻。\nQ 朝指针发射火焰弹   ·   W 护盾   ·   E 冲刺   ·   R 范围爆发\n每波结束选择印记；ESC 可随时切换操作方式。',15,0,-35,900,90,'#D3DDD0');
      this.button('开始试炼  ↵',0,-106,256,()=>this.send({type:'Start'}));
      text('Lab title',this.overlay,'联动实验  /  带预设印记进入三波战斗',12,0,-169,680,30,'#97B7B0');
      this.button('燃烧弹 → 尸爆',-280,-216,245,()=>this.send({type:'Start',lab:'burn'}),'#3E5559');
      this.button('尸爆 → 电弧',0,-216,245,()=>this.send({type:'Start',lab:'arc'}),'#3E5559');
      this.button('奥能储备 → 双重施法',280,-216,245,()=>this.send({type:'Start',lab:'reserve'}),'#3E5559');
      text('Seed',this.overlay,`固定种子 ${s.seed}  ·  URL 可使用 ?seed=1234  ·  所有素材离线生成`,12,0,-285,900,30,'#88A6A1');
    }else if(s.paused){
      text('Pause title',this.overlay,'火种暂歇',42,0,160,700,80,'#EFE2C1');
      this.modeButtons(98);
      const help=this.mode==='wasd'?'WASD：沿屏幕方向移动，松开即停\n左键按住：朝指针近距离普攻    右键 / Q：朝指针发射火焰弹\n空格：4 秒护盾    E：朝指针冲刺    R：自身周围爆发':'右键地面：移动    /    右键敌人：自动追击与普攻\nQ：朝鼠标发射火焰弹    W：获得 4 秒护盾\nE：朝鼠标冲刺，无法穿越障碍    R：自身周围范围爆发';
      text('Help',this.overlay,help+'\n红色圆环 / 射线：敌人攻击预警    F3：调试信息\n奖励界面可用鼠标或 1 / 2 / 3 选择增益。',17,0,-28,1000,200,'#CDDCD0');
      this.button('继续试炼  ESC',-145,-164,250,()=>this.send({type:'TogglePause'}));this.button('重新开始',145,-164,250,()=>this.send({type:'Restart'}),'#675B58');
    }else if(s.phase==='reward'){
      text('Reward eyebrow',this.overlay,`第 ${s.wave} 波已完成   /   战斗已冻结`,14,0,238,700,30,'#A8C4B7');
      text('Reward title',this.overlay,'选择一枚印记',35,0,180,850,70,'#EFE2C1');
      for(const [i,id] of s.choices.entries()){
        const p=perk(id),x=(i-1)*324,g=graphics(`Perk ${id}`,this.overlay);
        box(g,x-148,-129,296,250,'#2D464C',14);box(g,x-148,116,296,5,p.color,2);
        text('Perk number',this.overlay,`0${i+1}`,13,x,85,240,30,p.color);
        text('Perk name',this.overlay,p.name,25,x,40,250,50,'#F1E4C7');
        text('Perk description',this.overlay,p.description,16,x,-38,250,110,'#C2D6CA');
        this.button(`选择  ${i+1}`,x,-174,250,()=>this.send({type:'ChoosePerk',perkId:id}));
        this.regions.push({x,y:0,width:296,height:250,action:()=>this.send({type:'ChoosePerk',perkId:id})});
      }
      text('Reward footer',this.overlay,s.wave===3?'选择后查看通关结果':'进入下一波时恢复 30 生命，并刷新技能冷却。',13,0,-264,850,30,'#A5C2B5');
    }else{
      const won=s.phase==='victory';text('Result eyebrow',this.overlay,won?'TRIAL COMPLETE':'THE EMBER REMAINS',14,0,186,800,40,'#A2C6B6');
      text('Result title',this.overlay,won?'余烬长明':'火种未熄',48,0,105,800,100,'#EFE2C1');
      text('Result stats',this.overlay,`${won?'三波试炼已通过':'此次止步第 '+s.wave+' 波'}   ·   击杀 ${s.units.filter(u=>u.team==='hero'&&!u.alive).length?s.kills-1:s.kills}   ·   ${Math.floor(s.time)} 秒\n${s.perks.map(id=>perk(id).name).join('  /  ')||'再次尝试，寻找属于你的组合。'}`,17,0,0,940,100,'#C5D7CB');
      this.button('再来一次  ↵',0,-130,280,()=>this.send({type:'Restart'}));
    }
  }
}
