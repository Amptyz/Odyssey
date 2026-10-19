import type {Node} from 'cc';
import {equipment,equipmentDetails,SHOP_CATALOG,EQUIPMENT_SLOTS,CATEGORY_NAMES,appearanceLoadout,type EquipmentId} from '../content/equipment';
import type {WorldSnapshot} from '../simulation/GameWorld';
import type {GameCommand} from '../platform/protocol';
import {HeroRig} from './HeroRig';
import {ArtLibrary} from './ArtLibrary';
import {box,graphics,text,setText} from './Primitives';
type Button=(title:string,x:number,y:number,width:number,action:()=>void,fill?:string)=>void;
/** Catalog / detail / doll. Transactions retain the universal slot and purchase-order rules. */
export function drawProductionShop(root:Node,s:WorldSnapshot,page:number,setPage:(p:number)=>void,button:Button,send:(c:GameCommand)=>void,art:ArtLibrary,inspect:(id:EquipmentId)=>void,selected:EquipmentId=SHOP_CATALOG[page*6]!):void {
 text('Shop eyebrow',root,`遗迹工坊 / ${s.wave===0?'启程整备':'第 '+s.wave+' 关后'} · 固定货架`,14,-295,312,650,35,'#BEB6A8');
 text('Shop title',root,'购 置 装 备',32,-295,270,650,50,'#F1E6D2');text('Shop gold',root,`金币 ${s.gold}`,25,440,289,300,45,'#E3BB6A');
 const g=graphics('Three shop columns',root);box(g,-610,-247,350,474,'#24232CEE',9);box(g,-244,-247,420,474,'#18191FEF',9);box(g,192,-247,418,474,'#24232CEE',9);text('Catalog',root,'装 备 货 架',20,-435,199,320,34,'#F1E6D2');
 for(const [i,id]of SHOP_CATALOG.slice(page*6,page*6+6).entries()){
  const e=equipment(id),x=-520+(i%2)*171,y=121-Math.floor(i/2)*139,owned=s.inventory.includes(id),equipped=EQUIPMENT_SLOTS.some(slot=>s.equipment[slot]===id);
  const plate=graphics('Catalog '+id,root);box(plate,x-78,y-55,156,124,id===selected?'#3E4248':'#18191F',8);art.icon(root,id,47)?.setPosition(x,y+27);text('Item '+id,root,e.name,13,x,y-8,148,25,'#F1E6D2');button(equipped?'已装备':owned?'已拥有':`${e.price} 金`,x,y-48,144,()=>inspect(id),id===selected?'#705344':'#35313B');
 }
 const item=equipment(selected);art.icon(root,selected,91)?.setPosition(-35,134);text('Selected item',root,item.name,24,-35,200,380,40,'#F1E6D2');text('Selected type',root,CATEGORY_NAMES[item.category]+' · '+item.price+' 金',13,-35,67,370,28,'#D6BC83');text('Selected details',root,equipmentDetails(selected),14,-35,-32,378,174,'#CEC8BC');
 let pending:EquipmentId|undefined;const instruction=text('Shop rule',root,'六栏不限类型 · 点击已装备栏可卸下',12,400,-271,430,30,'#B7B2AB');
 const owned=s.inventory.includes(selected),equipped=EQUIPMENT_SLOTS.some(slot=>s.equipment[slot]===selected),canBuy=owned||s.gold>=item.price;
 button(equipped?'已装备':owned?'装备已拥有物品':canBuy?`购买并装备 · ${item.price} 金`:'金币不足',-35,-157,360,()=>{if(equipped||!canBuy)return;if(EQUIPMENT_SLOTS.every(slot=>!!s.equipment[slot])){pending=selected;setText(instruction,`选择要替换的栏位：${item.name}`);return;}send(owned?{type:'EquipEquipment',equipmentId:selected}:{type:'BuyEquipment',equipmentId:selected});},equipped||!canBuy?'#35313B':'#A74936');
 text('Purchase rule',root,'免费重装保留购序 · 同类最新购入项负责外观',11,-35,-215,390,32,'#A6A39B');text('Doll title',root,'我 的 构 筑',22,400,199,380,35,'#F1E6D2');
 const hero=new HeroRig(root,art);hero.node.setPosition(400,32);hero.node.setScale(2,2,1);hero.equip(appearanceLoadout(s.equipment,s.purchaseOrder));text('Current stats',root,`生命 ${s.stats.maxHp} · 攻击 ${s.stats.attackDamage} · 法强 ${s.stats.abilityPower}\n护甲 ${s.stats.armor} / 魔抗 ${s.stats.magicResist} · 急速 ${s.stats.abilityHaste}`,12,400,6,380,56,'#CEC8BC');
 for(const [i,slot]of EQUIPMENT_SLOTS.entries()){const id=s.equipment[slot],x=301+(i%2)*198,y=-83-Math.floor(i/2)*56;button(`${i+1}  ${id?equipment(id).name:'空位'}`,x,y,183,()=>{if(pending){const next=pending;pending=undefined;send(s.inventory.includes(next)?{type:'EquipEquipment',equipmentId:next,slot}:{type:'BuyEquipment',equipmentId:next,replaceSlot:slot});}else if(id)send({type:'UnequipEquipment',slot});},'#35313B');}
 const pages=Math.ceil(SHOP_CATALOG.length/6);button('上一页',-545,-312,124,()=>setPage((page+pages-1)%pages),'#35313B');text('Page',root,`${page+1} / ${pages}`,14,-435,-312,90,30,'#BEB6A8');button('下一页',-325,-312,124,()=>setPage((page+1)%pages),'#35313B');text('Team shop progress',root,s.network?`出发点集合 ${(s.party??[]).filter(p=>p.ready).length} / ${s.party?.length??1}`:'自由混搭 · 无职业限制',13,20,-312,360,35,'#BEB6A8');button('离开商店  ↵',440,-312,340,()=>send({type:'LeaveShop'}),'#A74936');
}
