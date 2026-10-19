import {BASIC_ATTACKS} from '../content/attacks';
import { Node, UITransform } from 'cc';
import { EQUIPMENT_SPRITES,HERO_ARM_ATTACHMENTS,PROCEDURAL_EQUIPMENT } from '../content/appearances';
import { equipment,type EquipmentAppearanceLoadout } from '../content/equipment';
import type { MotionPose } from '../content/animation';
import { ArtLibrary } from './ArtLibrary';
import { uiNode } from './Primitives';
import { createEquipmentVisual } from './EquipmentVisuals';
// Measured on pixel-v2/hero.png after trimming: shoulder and palm are physical
// joints in each local image, not percentages copied from the legacy sheet.
const PIXEL_ARMS:typeof HERO_ARM_ATTACHMENTS={
  left:{...HERO_ARM_ATTACHMENTS.left,anchor:[.796,.903],grip:[.275,.177]},
  right:{...HERO_ARM_ATTACHMENTS.right,anchor:[.17,.887],grip:[.754,.136]},
};
const PIXEL_GEAR:Record<string,{size:[number,number];grip?:[number,number];y?:number}>={
  sword:{size:[12,42],grip:[.5,.19]},staff:{size:[10,48],grip:[.5,.18]},bow:{size:[12,42],grip:[.276,.466]},
  bulwark:{size:[17,32],grip:[.5,.56]},reaver:{size:[10,31],grip:[.5,.18]},runeblade:{size:[13,42],grip:[.5,.18]},
  helm:{size:[32,32],y:48},circlet:{size:[29,12],y:57},hood:{size:[35,35],y:47},
  keenVisor:{size:[32,19],y:55},sageMask:{size:[29,21],y:45},aegisCrown:{size:[32,25],y:60},
};
/** Paper-doll rig. Equipment uses the same bones as the neutral base body. */
export class HeroRig {
  readonly node:Node;
  private readonly torso:Node;private readonly head:Node;
  private readonly leftArm:Node;private readonly rightArm:Node;private readonly leftLeg:Node;private readonly rightLeg:Node;
  private readonly gearRoot:Node;private readonly weaponRoot:Node;private bodyGear?:Node;private headGear?:Node;private weapon?:Node;
  private signature='';
  constructor(parent:Node,private readonly art:ArtLibrary){
    this.node=uiNode('Neutral hero rig',parent,100,100);
    this.leftLeg=this.part(4,9,16,-7,18,true);this.rightLeg=this.part(5,9,16,6,18,true);
    // Both shoulder caps sit under the garment; drawing the front cap over the torso
    // exposes a second sleeve and makes the arm look disconnected when it rotates.
    this.leftArm=this.arm('left');this.rightArm=this.arm('right');
    this.torso=this.part(1,26,25,0,27);
    this.head=this.part(0,30,31,0,47);
    this.gearRoot=uiNode('Equipment layers',this.node,100,100);
    // A separate foreground layer follows the same shoulder transform, so the
    // weapon stays in the palm without disappearing behind the torso garment.
    this.weaponRoot=uiNode('Weapon shoulder',this.node,100,100);this.weaponRoot.setPosition(this.rightArm.position);
  }
  private arm(side:'left'|'right'):Node{
    const a=(this.art.hasPixel('hero')?PIXEL_ARMS:HERO_ARM_ATTACHMENTS)[side],n=this.part(a.frame,a.width,a.height,...a.shoulder);
    n.name=`${side} shoulder`;n.getComponent(UITransform)!.setAnchorPoint(...a.anchor);return n;
  }
  private part(frame:number,w:number,h:number,x:number,y:number,top=false):Node{
    const n=this.art.hasPixel('hero')?this.art.pixelSprite(this.node,'hero',frame,w,h):this.art.sprite(this.node,'hero-parts',frame,w,h,`Base part ${frame}`);n.setPosition(Math.round(x),Math.round(y));if(top)n.getComponent(UITransform)!.setAnchorPoint(.5,1);return n;
  }
  equip(loadout:EquipmentAppearanceLoadout):void{
    const key=JSON.stringify(loadout);if(key===this.signature)return;this.signature=key;
    for(const n of [this.bodyGear,this.headGear,this.weapon])n?.destroy();this.bodyGear=this.headGear=this.weapon=undefined;
    this.torso.active=!loadout.body;
    for(const slot of ['body','head','weapon'] as const){
      const id=loadout[slot];if(!id)continue;const definition=equipment(id),appearance=definition.appearance;
      const frame=EQUIPMENT_SPRITES[appearance],procedural=PROCEDURAL_EQUIPMENT[appearance];
      if(!frame&&!procedural)throw new Error(`Missing equipment art: ${appearance}`);
      if(procedural&&procedural.layer!==slot)throw new Error(`Equipment layer mismatch: ${appearance}`);
      const parent=slot==='weapon'?this.weaponRoot:this.gearRoot;
      const ids:Record<string,string[]>={weapon:['sword','staff','bow','bulwark','reaver','runeblade'],body:['plate','robe','leather','duelistVest','wardMantle','sanguineWrap'],head:['helm','circlet','hood','keenVisor','sageMask','aegisCrown']},atlas=slot==='weapon'?'weapons':slot==='body'?'bodies':'heads',index=ids[slot]!.indexOf(id),pixel=this.art.hasPixel(atlas);
      const pixelGear=PIXEL_GEAR[id],sizes=pixelGear?.size??[29,27];
      const node=pixel?this.art.pixelSprite(parent,atlas,index,sizes[0],sizes[1]):procedural?createEquipmentVisual(parent,appearance)!:this.art.sprite(parent,'equipment',frame!.frame,frame!.width,frame!.height,`${slot} equipment`);
      if(slot==='weapon'){
        const arm=(this.art.hasPixel('hero')?PIXEL_ARMS:HERO_ARM_ATTACHMENTS).right;this.weapon=node;
        // Graphics coordinates already use the real palm origin; PNGs retain their atlas anchor.
        if(pixel)node.getComponent(UITransform)!.setAnchorPoint(...pixelGear!.grip!);else if(frame)node.getComponent(UITransform)!.setAnchorPoint(frame.anchorX??.5,frame.anchorY??.2);
        node.setPosition((arm.grip[0]-arm.anchor[0])*arm.width,(arm.grip[1]-arm.anchor[1])*arm.height);
      }else{node.setPosition(0,slot==='body'?27:pixel?pixelGear!.y!:procedural?.y??frame?.y??47);if(slot==='body')this.bodyGear=node;else this.headGear=node;}

    }
    // Garments cover shoulder seams below the head; headgear covers the hair.
    if(this.bodyGear)this.bodyGear.setParent(this.node),this.bodyGear.setSiblingIndex(this.torso.getSiblingIndex()+1);
    // Headwear follows the same head pivot during recoil, preserving its face aperture.
    if(this.headGear){const y=this.headGear.position.y;this.headGear.setParent(this.head);this.headGear.setPosition(0,y-this.head.position.y);}
  }
  pose(pose:MotionPose):void{
    const walk=pose.state==='walk',phase=pose.age*10,swing=walk?Math.sin(phase)*19:Math.sin(pose.age*2)*2;
    const attack=pose.state==='attack'||pose.state==='cast',strike=attack?Math.sin(Math.min(1,pose.age/.42)*Math.PI):0;
    this.node.setScale(pose.facing,1,1);this.node.setPosition(0,Math.round(walk?Math.abs(Math.sin(phase))*1.6:Math.sin(pose.age*2)*.35));
    this.node.angle=pose.state==='hurt'?-7:pose.state==='death'?-Math.min(1,pose.age/.45)*78:0;
    if(pose.state==='death')this.node.setPosition(0,5);
    this.leftLeg.angle=swing;this.rightLeg.angle=-swing;this.leftArm.angle=-swing*.8+(pose.state==='cast'?strike*35:0);
    const projectile=pose.basicAttack!==undefined&&BASIC_ATTACKS[pose.basicAttack].kind==='projectile';
    this.rightArm.angle=swing*.8+strike*(projectile?20:85);
    this.weaponRoot.angle=this.rightArm.angle;
    // Turn the wrist around the grip, keeping the blade / staff aimed outward
    // through the strike instead of pointing back into the character's face.
    if(this.weapon)this.weapon.angle=projectile?0:-strike*120;
    this.head.angle=pose.state==='hurt'?8:0;
    // Quantize presentation only: world simulation, aim and collision stay continuous.
    for(const part of [this.leftLeg,this.rightLeg,this.leftArm,this.rightArm,this.weaponRoot,this.head])part.angle=Math.round(part.angle/15)*15;
    if(this.weapon)this.weapon.angle=Math.round(this.weapon.angle/15)*15;
  }
}
