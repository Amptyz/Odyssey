import { Node, Sprite, UITransform } from 'cc';
import type { WorldSnapshot } from '../simulation/GameWorld';
import { PIXEL_ATLASES } from '../content/pixel-art';
import { ArtLibrary } from './ArtLibrary';
import { worldToScreen, type Projection } from './GroundProjection';
import { planPixelVfx, PIXEL_VFX_LIMIT } from './PixelVfxPlan';
import { color } from './Primitives';

/** Decorative flipbooks only: snapshot cue lifetime drives every frame, including pause.
 * Danger contours and real projectile cores remain in the authoritative shape view. */
export class PixelVfxView {
  private readonly pool:Node[]=[];
  private active=0;
  private readonly applied:{id:number;row:number;frame:number}[]=[];
  static readonly LIMIT=PIXEL_VFX_LIMIT;
  constructor(private readonly parent:Node,private readonly art:ArtLibrary){}
  update(state:WorldSnapshot,camera:Projection):void {
    this.active=0;
    this.applied.length=0;
    if(this.art.hasPixel('vfx-bursts-v2'))for(const plan of planPixelVfx(state.cues,camera,state.enemies.warnings)){
      const {cue,age,row,frame,size,at}=plan;
      let node=this.pool[this.active];
      if(!node){node=this.art.pixelSprite(this.parent,'vfx-bursts-v2',frame,72,72);this.pool.push(node);}
      node.active=true;node.getComponent(Sprite)!.spriteFrame=this.art.pixelFrame('vfx-bursts-v2',frame);
      // Preserve a common source scale across unequal transparent atlas cuts.
      // Trimming must never stretch a slash or change its apparent thickness.
      const region=PIXEL_ATLASES['vfx-bursts-v2']!.frames[frame]!,sourceScale=size/314;
      const transform=node.getComponent(UITransform)!;
      transform.setContentSize(region.rect[2]*sourceScale,region.rect[3]*sourceScale);
      transform.setAnchorPoint(region.anchor[0],region.anchor[1]);
      node.setPosition(Math.round(at.x),Math.round(at.y));
      node.angle=0;
      if(row===2&&cue.facing){const origin=worldToScreen(cue.at,camera),end=worldToScreen({x:cue.at.x+cue.facing.x,y:cue.at.y+cue.facing.y},camera);node.angle=Math.atan2(end.y-origin.y,end.x-origin.x)*180/Math.PI;}
      node.getComponent(Sprite)!.color=color(age<.2?'#FFFFFFFF':age<.3?'#FFFFFFAA':'#FFFFFF55');
      this.applied.push({id:cue.id,row,frame});
      this.active++;
    }
    for(let i=this.active;i<this.pool.length;i++)this.pool[i]!.active=false;
  }
  debug(){return{atlas:'vfx-bursts-v2',active:this.active,allocated:this.pool.length,limit:PixelVfxView.LIMIT,clock:'snapshot cue age',frames:this.applied.map(f=>({...f}))};}
}
