import { deriveStats,equipment,EQUIPMENT_SLOTS,SHOP_CATALOG,type EquipmentId,type EquipmentLoadout,type EquipmentSlot } from '../content/equipment';
import { ECONOMY } from '../content/progression';
/** Owns purchases, inventory and slots. Phase authorization belongs to GameWorld. */
export class EquipmentSystem {
  gold:number=ECONOMY.startingGold;
  readonly inventory=new Set<EquipmentId>();
  readonly equipped:EquipmentLoadout={};
  get stats(){return deriveStats(this.equipped);}
  buy(id:EquipmentId):boolean {
    if(!SHOP_CATALOG.includes(id)||this.inventory.has(id)||this.gold<equipment(id).price)return false;
    this.gold-=equipment(id).price;this.inventory.add(id);this.equip(id);return true;
  }
  equip(id:EquipmentId):boolean {if(!this.inventory.has(id))return false;this.equipped[equipment(id).slot]=id;return true;}
  unequip(slot:EquipmentSlot):boolean {if(!EQUIPMENT_SLOTS.includes(slot)||!this.equipped[slot])return false;delete this.equipped[slot];return true;}
  snapshot(){return{gold:this.gold,inventory:Array.from(this.inventory),equipment:{...this.equipped},stats:this.stats};}
}
