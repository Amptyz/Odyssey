import {equipment,EQUIPMENT_SLOTS,SHOP_CATALOG,syncEquipment,statsView,type EquipmentId,type EquipmentLoadout,type EquipmentSlot} from '../content/equipment';
import { ECONOMY } from '../content/progression';
import {AttributeSet,PLAYER_TEMPLATE} from '../combat-core/attributes/AttributeSet';
/** Six universal slots and unique owned IDs. GameWorld owns phase/player authorization. */
export class EquipmentSystem {
  constructor(readonly attributes=new AttributeSet(PLAYER_TEMPLATE)){this.synchronize();}
  gold:number=ECONOMY.startingGold;
  readonly inventory=new Set<EquipmentId>();
  readonly equipped:EquipmentLoadout={};
  private signature='';
  private synchronize():void {const signature=JSON.stringify(this.equipped);if(signature!==this.signature){syncEquipment(this.attributes,this.equipped);this.signature=signature;}}
  get stats(){this.synchronize();return statsView(this.attributes);}
  buy(id:EquipmentId,replaceSlot?:EquipmentSlot):boolean {
    if(!SHOP_CATALOG.includes(id)||this.inventory.has(id)||this.gold<equipment(id).price)return false;
    if(replaceSlot!==undefined&&!EQUIPMENT_SLOTS.includes(replaceSlot))return false;
    const slot=replaceSlot??EQUIPMENT_SLOTS.find(s=>!this.equipped[s]);if(!slot)return false;
    this.gold-=equipment(id).price;this.inventory.add(id);this.equipped[slot]=id;this.synchronize();return true;
  }
  equip(id:EquipmentId,slot?:EquipmentSlot):boolean {
    if(!SHOP_CATALOG.includes(id)||!this.inventory.has(id)||slot!==undefined&&!EQUIPMENT_SLOTS.includes(slot))return false;
    const existing=EQUIPMENT_SLOTS.find(s=>this.equipped[s]===id);if(existing)return slot===undefined||slot===existing;
    const target=slot??EQUIPMENT_SLOTS.find(s=>!this.equipped[s]);if(!target)return false;
    this.equipped[target]=id;this.synchronize();return true;
  }
  unequip(slot:EquipmentSlot):boolean {if(!EQUIPMENT_SLOTS.includes(slot)||!this.equipped[slot])return false;delete this.equipped[slot];this.synchronize();return true;}
  snapshot(){return{gold:this.gold,inventory:Array.from(this.inventory),equipment:{...this.equipped},stats:this.stats};}
}
