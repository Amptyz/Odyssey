import type { Node } from 'cc';
import { equipment,equipmentDetails,SHOP_CATALOG,EQUIPMENT_SLOTS,SLOT_NAMES,CATEGORY_NAMES,appearanceLoadout,type EquipmentId } from '../content/equipment';
import type { WorldSnapshot } from '../simulation/GameWorld';
import type { GameCommand } from '../platform/protocol';
import { HeroRig } from './HeroRig';
import { ArtLibrary } from './ArtLibrary';
import { box,graphics,text,setText } from './Primitives';
type Button=(title:string,x:number,y:number,width:number,action:()=>void,fill?:string)=>void;
export function drawShop(root:Node,s:WorldSnapshot,page:number,setPage:(p:number)=>void,button:Button,send:(c:GameCommand)=>void,art:ArtLibrary,inspect:(id:EquipmentId)=>void):void {
  text('Shop title',root,'旅 人 工 坊',34,0,300,800,55,'#EFE2C1');
  text('Shop subtitle',root,`${s.wave===0?'启程整备':`第 ${s.wave} 波后的整备`}  ·  金币 ${s.gold}  ·  固定货架，自由搭配，无职业限制`,16,0,253,1120,34,'#B8D4C7');
  const panel=graphics('Equipment preview panel',root);box(panel,-595,-209,285,430,'#243F46',14);
  text('Preview title',root,'装备即外观',20,-455,186,250,40,'#ECD8AF');
  const body=new HeroRig(root,art);body.node.setPosition(-455,-8);body.node.setScale(2.5,2.5,1);body.equip(appearanceLoadout(s.equipment,s.purchaseOrder));
  const stats=s.stats;
  text('Build stats',root,`当前最终属性\n生命 ${stats.maxHp}    护甲 ${stats.armor} / 魔抗 ${stats.magicResist}\n攻击 ${stats.attackDamage}    射程 ${stats.attackRange.toFixed(1)}\n攻速 ${(1/stats.attackInterval).toFixed(2)}/秒    移速 ${stats.speed.toFixed(2)}格/秒\n法强 ${stats.abilityPower} / 急速 ${stats.abilityHaste}\n暴击 ${Math.round(stats.critChance*100)}% / 全能吸血 ${Math.round(stats.omnivamp*100)}%\n法术穿透 ${stats.magicPenFlat} / ${Math.round(stats.magicPenPercent*100)}%`,13,-453,-111,255,177,'#D0DFD1');
  let pending:EquipmentId|undefined;
  const instruction=text('Shop rule',root,'六栏不限类型；点击栏位可卸下',12,35,-329,470,34,'#A3BEB1');
  const pages=Math.ceil(SHOP_CATALOG.length/6);
  for(const [i,id] of SHOP_CATALOG.slice(page*6,page*6+6).entries()){
    const e=equipment(id),x=i%2===0?-90:280,y=155-Math.floor(i/2)*149,owned=s.inventory.includes(id),equipped=EQUIPMENT_SLOTS.some(slot=>s.equipment[slot]===id);
    const g=graphics(`Item ${id}`,root);box(g,x-169,y-68,338,136,equipped?'#3D5B55':'#2D464C',10);
    text('Item name',root,`${e.name} · ${CATEGORY_NAMES[e.category]}`,18,x,y+43,310,30,'#F1E4C7');
    text('Item stats',root,e.description,13,x,y+8,310,44,'#C2D6CA');
    const label=equipped?'已装备':owned?'装备（已拥有）':s.gold>=e.price?`购买并装备 · ${e.price} 金`:`金币不足 · ${e.price} 金`;
    button(label,x-40,y-42,220,()=>{
      if(equipped||!owned&&s.gold<e.price)return;
      if(EQUIPMENT_SLOTS.every(slot=>!!s.equipment[slot])){pending=id;setText(instruction,`待替换：${e.name}；点目标栏（翻页取消）`);return;}
      send(owned?{type:'EquipEquipment',equipmentId:id}:{type:'BuyEquipment',equipmentId:id});
    },equipped?'#526E61':owned||s.gold>=e.price?'#547B75':'#445057');
    button('详情',x+118,y-42,80,()=>inspect(id),'#405D62');
  }
  for(const [i,slot] of EQUIPMENT_SLOTS.entries()){
    const id=s.equipment[slot];button(`${SLOT_NAMES[slot]}：${id?equipment(id).name+' ×':'未装备'}`,-390+(i%3)*370,-237-Math.floor(i/3)*43,350,()=>{
      if(pending){const item=pending;pending=undefined;setText(instruction,'六栏不限类型；点击栏位可卸下');send(s.inventory.includes(item)?{type:'EquipEquipment',equipmentId:item,slot}:{type:'BuyEquipment',equipmentId:item,replaceSlot:slot});}
      else if(id)send({type:'UnequipEquipment',slot});
    },'#344D52');
  }
  button('上一页',-535,-329,120,()=>setPage((page+pages-1)%pages),'#344D52');
  text('Page',root,`${page+1} / ${pages}` ,15,-435,-329,80,32,'#BDD3C7');
  button('下一页',-335,-329,120,()=>setPage((page+1)%pages),'#344D52');
  button(`进入第 ${s.wave+1} 波  ↵`,455,-329,240,()=>send({type:'LeaveShop'}));
}

/** Read-only preview; viewing an item never buys it or changes the purchase order. */
export function drawEquipmentDetails(root:Node,s:WorldSnapshot,id:EquipmentId,button:Button,close:()=>void,art:ArtLibrary):void {
  const item=equipment(id),g=graphics('Equipment details background',root);box(g,-590,-290,1180,560,'#263F46',14);
  text('Equipment details title',root,`${item.name} · ${CATEGORY_NAMES[item.category]} · ${item.price} 金`,28,0,220,1080,56,'#EFE2C1');
  const preview=new HeroRig(root,art);preview.equip({...appearanceLoadout(s.equipment,s.purchaseOrder),[item.category]:id});preview.node.setPosition(-400,-100);preview.node.setScale(3,3,1);
  text('Equipment preview note',root,'装备外观预览\n查看不改变当前穿戴',14,-400,-185,280,60,'#B8D4C7');
  text('Equipment details',root,equipmentDetails(id),18,155,15,750,335,'#D2DFD2');
  text('Equipment appearance rule',root,item.category==='weapon'?'装备后：当前已装备武器中，最后购买的一件决定普攻形态与射程。':'六栏不限类型，所有已装属性生效；同部位按最后购买的当前装备显示。',14,100,-210,900,48,'#B8D4C7');
  button('返回工坊',0,-325,300,close,'#547B75');
}
