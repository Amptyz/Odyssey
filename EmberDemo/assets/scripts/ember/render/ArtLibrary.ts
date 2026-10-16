import { ImageAsset, Rect, Size, SpriteFrame, Texture2D, resources, Sprite, UITransform, Node } from 'cc';
import { ATLAS_FRAMES,type AtlasId,type ArtFrame } from '../content/art-manifest';
import { uiNode } from './Primitives';
import { PIXEL_ATLASES } from '../content/pixel-art';
/** One texture per atlas; shared SpriteFrames are kept for the scene lifetime. */
export class ArtLibrary {
  private readonly frames=new Map<string,SpriteFrame>();
  private readonly textures=new Map<AtlasId,Texture2D>();
  loaded=false;
  private readonly pixelFrames=new Map<string,SpriteFrame>();
  private readonly pixelTextures:Texture2D[]=[];
  async load():Promise<void>{
    await Promise.all((Object.keys(ATLAS_FRAMES) as AtlasId[]).map(id=>new Promise<void>((resolve,reject)=>{
      resources.load(`art/living-ruins/${id}`,ImageAsset,(error,image)=>{
        if(error){reject(error);return;}
        const texture=new Texture2D();texture.image=image;texture.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);this.textures.set(id,texture);
        for(const [index,frame] of ATLAS_FRAMES[id].entries()){
          const sprite=new SpriteFrame();sprite.texture=texture;sprite.rect=new Rect(...frame.rect);sprite.originalSize=new Size(frame.rect[2],frame.rect[3]);
          this.frames.set(`${id}:${index}`,sprite);
        }
        resolve();
      });
    })));
    await Promise.all(Object.entries(PIXEL_ATLASES).map(([id,atlas])=>new Promise<void>((resolve,reject)=>{
      resources.load(`art/pixel-v1/${id}`,ImageAsset,(error,image)=>{
        if(error){reject(error);return;}const texture=new Texture2D();texture.image=image;texture.setFilters(Texture2D.Filter.NEAREST,Texture2D.Filter.NEAREST);this.pixelTextures.push(texture);
        atlas.frames.forEach((f,i)=>{const frame=new SpriteFrame();frame.texture=texture;frame.rect=new Rect(...f.rect);frame.originalSize=new Size(f.rect[2],f.rect[3]);this.pixelFrames.set(`${id}:${i}`,frame);});resolve();
      });
    })));
    this.loaded=true;
  }
  frame(atlas:AtlasId,index:number):SpriteFrame{const f=this.frames.get(`${atlas}:${index}`);if(!f)throw new Error(`Missing art frame ${atlas}:${index}`);return f;}
  region(atlas:AtlasId,index:number):ArtFrame{return ATLAS_FRAMES[atlas][index]!;}
  pixelFrame(id:string,index:number):SpriteFrame {const frame=this.pixelFrames.get(`${id}:${index}`);if(!frame)throw new Error(`Missing pixel frame ${id}:${index}`);return frame;}
  hasPixel(id:string):boolean{return!!PIXEL_ATLASES[id];}
  debug(){return{atlases:Object.entries(PIXEL_ATLASES).map(([id,a])=>({id,frames:a.frames.length,loaded:a.frames.every((_,i)=>this.pixelFrames.has(`${id}:${i}`)),filter:'nearest'})),frames:this.pixelFrames.size};}
  icon(parent:Node,id:string,size=40):Node|undefined {
    const groups:Record<string,string[]>={weapons:['sword','staff','bow','bulwark','reaver','runeblade'],bodies:['plate','robe','leather','duelistVest','wardMantle','sanguineWrap'],heads:['helm','circlet','hood','keenVisor','sageMask','aegisCrown'],skills:['fireball','icebolt','shield','dash','nova','cleave','volley','ironGuard','frostNova']};
    groups.perks=PIXEL_ATLASES.perks?.poses??[];
    for(const [atlas,ids]of Object.entries(groups)){const index=ids.indexOf(id);if(index<0||!this.hasPixel(atlas))continue;const f=PIXEL_ATLASES[atlas]!.frames[index]!,ratio=f.rect[2]/f.rect[3];return this.pixelSprite(parent,atlas,index,ratio>1?size:size*ratio,ratio>1?size/ratio:size);}return undefined;
  }
  pixelSprite(parent:Node,id:string,index:number,width?:number,height?:number):Node {
    const f=PIXEL_ATLASES[id]!.frames[index]!,w=width??f.rect[2]*PIXEL_ATLASES[id]!.scale,h=height??f.rect[3]*PIXEL_ATLASES[id]!.scale,n=uiNode(`Pixel ${id}`,parent,w,h),s=n.addComponent(Sprite);s.spriteFrame=this.pixelFrame(id,index);s.sizeMode=Sprite.SizeMode.CUSTOM;n.getComponent(UITransform)!.setContentSize(w,h);return n;
  }
  sprite(parent:Node,atlas:AtlasId,index:number,width:number,height?:number,name:string=atlas):Node{
    const frame=this.region(atlas,index),node=uiNode(name,parent,width,height??width*frame.rect[3]/frame.rect[2]);
    const sprite=node.addComponent(Sprite);sprite.spriteFrame=this.frame(atlas,index);sprite.sizeMode=Sprite.SizeMode.CUSTOM;
    node.getComponent(UITransform)!.setContentSize(width,height??width*frame.rect[3]/frame.rect[2]);return node;
  }
  dispose():void{for(const f of [...this.frames.values(),...this.pixelFrames.values()])f.destroy();for(const t of [...this.textures.values(),...this.pixelTextures])t.destroy();this.frames.clear();this.pixelFrames.clear();this.textures.clear();this.pixelTextures.length=0;this.loaded=false;}
}
