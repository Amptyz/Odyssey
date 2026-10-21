import { Node, Sprite, UITransform, UIOpacity } from 'cc';
import { animationFrame,HERO_DEATH_FADE,type MotionPose } from '../content/animation';
import type { Unit } from '../simulation/GameWorld';
import { enemy } from '../content/enemies';
import { UNIT_SPRITES,type UnitSprite } from '../content/appearances';
import { HeroSprite } from './HeroSprite';
import { ArtLibrary } from './ArtLibrary';
import { color,uiNode } from './Primitives';
import type {HeroPaletteId} from '../content/hero-palettes';
export class AnimatedUnit {
  readonly node:Node;private readonly hero?:HeroSprite;private readonly sprite?:Sprite;private readonly opacity:UIOpacity;
  private frame=-1;private readonly visual?:UnitSprite;private currentPose?:MotionPose;
  constructor(parent:Node,readonly kind:Unit['kind'],private readonly art:ArtLibrary){
    this.node=uiNode('Animated '+kind,parent,100,100);this.opacity=this.node.addComponent(UIOpacity);
    if(kind==='hero')this.hero=new HeroSprite(this.node,art);
    else{this.visual=UNIT_SPRITES[enemy(kind).appearance]!;this.sprite=this.node.addComponent(Sprite);this.sprite.sizeMode=Sprite.SizeMode.CUSTOM;}
  }
  update(pose:MotionPose,paletteId?:HeroPaletteId):void{
    this.currentPose={...pose};
    const fadeStart=this.hero?HERO_DEATH_FADE.start:.35;
    this.opacity.opacity=pose.state==='death'?Math.round(255*Math.max(0,1-Math.max(0,pose.age-fadeStart)/(this.hero?HERO_DEATH_FADE.duration:.55))):255;
    if(this.hero){this.hero.pose(pose,paletteId);return;}
    const visual=this.visual!,index=animationFrame(pose.state,pose.age,visual.clips),sprite=this.sprite!;
    if(index!==this.frame){this.frame=index;const f=this.art.region(visual.atlas,index);sprite.spriteFrame=this.art.frame(visual.atlas,index);
      const ui=this.node.getComponent(UITransform)!;ui.setContentSize(f.rect[2]*visual.pixelScale,f.rect[3]*visual.pixelScale);ui.setAnchorPoint(f.pivot[0]/f.rect[2],0);}
    this.node.setScale(pose.facing,1,1);
    sprite.color=color(pose.state==='hurt'?'#FFD2C1':visual.tint);
  }
  get height():number{return this.visual?.height??74;}
  debug(){return{sprite:this.hero?.debug(),kind:this.kind,atlas:this.visual?.atlas??this.hero?.debug().atlas,frame:this.hero?.debug().frame??this.frame,opacity:this.opacity.opacity,pose:this.currentPose?{...this.currentPose}:undefined};}
}
