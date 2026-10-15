import { ImageAsset, Rect, Size, SpriteFrame, Texture2D, resources, Sprite, UITransform, Node } from 'cc';
import { ATLAS_FRAMES,type AtlasId,type ArtFrame } from '../content/art-manifest';
import { uiNode } from './Primitives';
/** One texture per atlas; shared SpriteFrames are kept for the scene lifetime. */
export class ArtLibrary {
  private readonly frames=new Map<string,SpriteFrame>();
  private readonly textures=new Map<AtlasId,Texture2D>();
  loaded=false;
  async load():Promise<void>{
    await Promise.all((Object.keys(ATLAS_FRAMES) as AtlasId[]).map(id=>new Promise<void>((resolve,reject)=>{
      resources.load(`art/living-ruins/${id}`,ImageAsset,(error,image)=>{
        if(error){reject(error);return;}
        const texture=new Texture2D();texture.image=image;this.textures.set(id,texture);
        for(const [index,frame] of ATLAS_FRAMES[id].entries()){
          const sprite=new SpriteFrame();sprite.texture=texture;sprite.rect=new Rect(...frame.rect);sprite.originalSize=new Size(frame.rect[2],frame.rect[3]);
          this.frames.set(`${id}:${index}`,sprite);
        }
        resolve();
      });
    })));
    this.loaded=true;
  }
  frame(atlas:AtlasId,index:number):SpriteFrame{const f=this.frames.get(`${atlas}:${index}`);if(!f)throw new Error(`Missing art frame ${atlas}:${index}`);return f;}
  region(atlas:AtlasId,index:number):ArtFrame{return ATLAS_FRAMES[atlas][index]!;}
  sprite(parent:Node,atlas:AtlasId,index:number,width:number,height?:number,name:string=atlas):Node{
    const frame=this.region(atlas,index),node=uiNode(name,parent,width,height??width*frame.rect[3]/frame.rect[2]);
    const sprite=node.addComponent(Sprite);sprite.spriteFrame=this.frame(atlas,index);sprite.sizeMode=Sprite.SizeMode.CUSTOM;
    node.getComponent(UITransform)!.setContentSize(width,height??width*frame.rect[3]/frame.rect[2]);return node;
  }
  dispose():void{for(const f of this.frames.values())f.destroy();for(const t of this.textures.values())t.destroy();this.frames.clear();this.textures.clear();this.loaded=false;}
}
