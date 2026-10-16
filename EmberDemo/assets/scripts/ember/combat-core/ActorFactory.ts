import {AttributeSet,type UnitTemplate} from './attributes/AttributeSet';
import type {Actor} from './types';
import type {Vec2} from '../utils/math';
/** The only combat-unit construction entry. Template ownership never leaks to instances. */
export function createActor(id:string,team:Actor['team'],at:Vec2,template:UnitTemplate,radius:number):Actor {
  const attributes=new AttributeSet(template),a=attributes.value;
  return{id,team,x:at.x,y:at.y,attributes,hp:a.maxHealth,maxHp:a.maxHealth,mana:a.maxMana,radius,alive:true,statuses:[],shields:[],combatEffects:[],attributeEffects:[],shield:0,shieldTime:0};
}
