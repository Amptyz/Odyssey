import type { Node } from 'cc';
import { equipment,SHOP_CATALOG,EQUIPMENT_SLOTS,SLOT_NAMES } from '../content/equipment';
import type { WorldSnapshot } from '../simulation/GameWorld';
import type { GameCommand } from '../platform/protocol';
import { drawHero } from './UnitVisuals';
import { box,graphics,text } from './Primitives';
type Button=(title:string,x:number,y:number,width:number,action:()=>void,fill?:string)=>void;
export function drawShop(root:Node,s:WorldSnapshot,page:number,setPage:(p:number)=>void,button:Button,send:(c:GameCommand)=>void):void {
  text('Shop title',root,'旅 人 工 坊',34,0,300,800,55,'#EFE2C1');
  text('Shop subtitle',root,`${s.wave===0?'启程整备':`第 ${s.wave} 波后的整备`}  ·  金币 ${s.gold}  ·  固定货架，自由搭配，无职业限制`,16,0,253,1120,34,'#B8D4C7');
  const panel=graphics('Equipment preview panel',root);box(panel,-595,-209,285,430,'#243F46',14);
  text('Preview title',root,'装备即外观',20,-455,186,250,40,'#ECD8AF');
  const body=graphics('Equipped hero preview',root);body.node.setPosition(-455,6);body.node.setScale(2.7,2.7,1);drawHero(body,s.equipment);
  const stats=s.stats;
  text('Build stats',root,`装备属性（不含被动增益）\n生命上限 ${stats.maxHp}    护甲 ${stats.armor}\n普攻 ${stats.attackDamage}    射程 ${stats.attackRange.toFixed(1)}\n攻速 ${(1/stats.attackInterval).toFixed(2)}/秒    移速 ${stats.speed.toFixed(1)}\n技能威力 ${Math.round(stats.skillPower*100)}%\n技能冷却 ${Math.round(stats.cooldownMultiplier*100)}%`,14,-453,-107,255,170,'#D0DFD1');
  const pages=Math.ceil(SHOP_CATALOG.length/6);
  for(const [i,id] of SHOP_CATALOG.slice(page*6,page*6+6).entries()){
    const e=equipment(id),x=i%2===0?-90:280,y=155-Math.floor(i/2)*149,owned=s.inventory.includes(id),equipped=s.equipment[e.slot]===id;
    const g=graphics(`Item ${id}`,root);box(g,x-169,y-68,338,136,equipped?'#3D5B55':'#2D464C',10);
    text('Item name',root,`${e.name} · ${SLOT_NAMES[e.slot]}`,18,x,y+43,310,30,'#F1E4C7');
    text('Item stats',root,e.description,13,x,y+8,310,44,'#C2D6CA');
    const label=equipped?'已装备':owned?'装备（已拥有）':s.gold>=e.price?`购买并装备 · ${e.price} 金`:`金币不足 · ${e.price} 金`;
    button(label,x,y-42,270,()=>{if(equipped)return;send(owned?{type:'EquipEquipment',equipmentId:id}:{type:'BuyEquipment',equipmentId:id});},equipped?'#526E61':owned||s.gold>=e.price?'#547B75':'#445057');
  }
  for(const [i,slot] of EQUIPMENT_SLOTS.entries()){
    const id=s.equipment[slot];button(`${SLOT_NAMES[slot]}：${id?equipment(id).name+' ×':'未装备'}`,-390+i*370,-250,350,()=>{if(id)send({type:'UnequipEquipment',slot});},'#344D52');
  }
  button('上一页',-440,-314,150,()=>setPage((page+pages-1)%pages),'#344D52');
  text('Page',root,`${page+1} / ${pages}` ,15,-300,-314,100,32,'#BDD3C7');
  button('下一页',-160,-314,150,()=>setPage((page+1)%pages),'#344D52');
  text('Shop rule',root,'旧装备保留；点击槽位可卸下',12,95,-314,300,35,'#A3BEB1');
  button(`进入第 ${s.wave+1} 波  ↵`,415,-314,280,()=>send({type:'LeaveShop'}));
}
