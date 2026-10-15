import { Node, UITransform } from 'cc';
import { EQUIPMENT_SPRITES,EQUIPMENT_APPEARANCES,HERO_ARM_ATTACHMENTS } from '../content/appearances';
import { equipment,type EquipmentLoadout } from '../content/equipment';
import type { MotionPose } from '../content/animation';
import { ArtLibrary } from './ArtLibrary';
import { uiNode } from './Primitives';
/** Paper-doll rig. Equipment uses the same bones as the neutral base body. */
export class HeroRig {
  readonly node:Node;
  private readonly torso:Node;private readonly head:Node;
  private readonly leftArm:Node;private readonly rightArm:Node;private readonly leftLeg:Node;private readonly rightLeg:Node;
  private readonly gearRoot:Node;private readonly weaponRoot:Node;private bodyGear?:Node;private headGear?:Node;private weapon?:Node;
  private signature='';private weaponId='';
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
    const a=HERO_ARM_ATTACHMENTS[side],n=this.part(a.frame,a.width,a.height,...a.shoulder);
    n.name=`${side} shoulder`;n.getComponent(UITransform)!.setAnchorPoint(...a.anchor);return n;
  }
  private part(frame:number,w:number,h:number,x:number,y:number,top=false):Node{
    const n=this.art.sprite(this.node,'hero-parts',frame,w,h,`Base part ${frame}`);n.setPosition(x,y);if(top)n.getComponent(UITransform)!.setAnchorPoint(.5,1);return n;
  }
  equip(loadout:EquipmentLoadout):void{
    const key=JSON.stringify(loadout);if(key===this.signature)return;this.signature=key;
    for(const n of [this.bodyGear,this.headGear,this.weapon])n?.destroy();this.bodyGear=this.headGear=this.weapon=undefined;
    this.torso.active=!loadout.body;this.weaponId=loadout.weapon??'';
    for(const slot of ['body','head','weapon'] as const){
      const id=loadout[slot];if(!id)continue;const definition=equipment(id),frame=EQUIPMENT_SPRITES[definition.appearance];
      if(!frame)throw new Error(`Missing equipment art: ${definition.appearance}`);
      const node=this.art.sprite(slot==='weapon'?this.weaponRoot:this.gearRoot,'equipment',frame.frame,frame.width,frame.height,`${slot} equipment`);
      if(slot==='weapon'){const arm=HERO_ARM_ATTACHMENTS.right;this.weapon=node;this.weaponId=EQUIPMENT_APPEARANCES[definition.appearance]!.shape;node.getComponent(UITransform)!.setAnchorPoint(frame.anchorX??.5,frame.anchorY??.2);node.setPosition((arm.grip[0]-arm.anchor[0])*arm.width,(arm.grip[1]-arm.anchor[1])*arm.height);}
      else{node.setPosition(0,frame.y??27);if(slot==='body')this.bodyGear=node;else this.headGear=node;}
    }
    // Garments cover shoulder seams below the head; headgear covers the hair.
    if(this.bodyGear)this.bodyGear.setParent(this.node),this.bodyGear.setSiblingIndex(this.torso.getSiblingIndex()+1);
  }
  pose(pose:MotionPose):void{
    const walk=pose.state==='walk',phase=pose.age*10,swing=walk?Math.sin(phase)*19:Math.sin(pose.age*2)*2;
    const attack=pose.state==='attack'||pose.state==='cast',strike=attack?Math.sin(Math.min(1,pose.age/.42)*Math.PI):0;
    this.node.setScale(pose.facing,1,1);this.node.setPosition(0,walk?Math.abs(Math.sin(phase))*1.6:Math.sin(pose.age*2)*.35);
    this.node.angle=pose.state==='hurt'?-7:pose.state==='death'?-Math.min(1,pose.age/.45)*78:0;
    if(pose.state==='death')this.node.setPosition(0,5);
    this.leftLeg.angle=swing;this.rightLeg.angle=-swing;this.leftArm.angle=-swing*.8+(pose.state==='cast'?strike*35:0);
    this.rightArm.angle=swing*.8+strike*(this.weaponId==='bow'?20:this.weaponId==='shield'?35:85);
    this.weaponRoot.angle=this.rightArm.angle;
    // Turn the wrist around the grip, keeping the blade / staff aimed outward
    // through the strike instead of pointing back into the character's face.
    if(this.weapon)this.weapon.angle=(this.weaponId==='sword'||this.weaponId==='staff')?-strike*120:0;
    this.head.angle=pose.state==='hurt'?8:0;
  }
}
