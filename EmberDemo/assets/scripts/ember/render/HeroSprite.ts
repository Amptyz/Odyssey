import {Node,Sprite,UITransform} from 'cc';
import {wholeHeroFrame,type MotionPose} from '../content/animation';
import {PIXEL_ATLASES} from '../content/pixel-art';
import {ArtLibrary} from './ArtLibrary';
import {color,uiNode} from './Primitives';
import {DEFAULT_HERO_PALETTE,type HeroPaletteId} from '../content/hero-palettes';

/** One complete figure per frame. Equipment and combat rules cannot mutate this presentation. */
export class HeroSprite {
  readonly node:Node;
  private readonly image:Node;
  private readonly sprite:Sprite;
  private current=wholeHeroFrame({state:'idle',age:0,facing:1});
  private key='';
  private paletteId?:HeroPaletteId;
  constructor(parent:Node,private readonly art:ArtLibrary){
    this.node=uiNode('Whole hero',parent,90,90);
    this.image=art.pixelSprite(this.node,this.current.atlas,this.current.frame);
    this.image.name='Whole body frame';
    this.sprite=this.image.getComponent(Sprite)!;
    this.pose({state:'idle',age:0,facing:1});
  }
  pose(pose:MotionPose,paletteId:HeroPaletteId=DEFAULT_HERO_PALETTE):void{
    if(this.paletteId!==paletteId){this.sprite.customMaterial=this.art.heroMaterial(paletteId);this.paletteId=paletteId;}
    const next=wholeHeroFrame(pose),key=next.atlas+':'+next.frame;
    if(key!==this.key){
      const atlas=PIXEL_ATLASES[next.atlas]!,frame=atlas.frames[next.frame]!,ui=this.image.getComponent(UITransform)!;
      this.sprite.spriteFrame=this.art.pixelFrame(next.atlas,next.frame);
      ui.setContentSize(frame.rect[2]*atlas.scale,frame.rect[3]*atlas.scale);
      // Source cell metadata preserves the common ground plane, including airborne/death poses.
      // Do not trim to the current visible feet or fit every frame to a fixed height.
      ui.setAnchorPoint(...frame.anchor);
      this.key=key;
    }
    this.image.setScale(next.mirror,1,1);
    this.sprite.color=color(pose.state==='hurt'?'#FFD2C1':'#FFFFFF');
    this.current=next;
  }
  debug(){return{...this.current,paletteId:this.paletteId,parts:1,sourceViews:5,animation:'whole-body sequence frames'};}
}
