import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';
export const color = (hex:string):Color => new Color().fromHEX(hex);
export function uiNode(name:string,parent:Node,width=1280,height=720):Node {
  const node=new Node(name);node.layer=Layers.Enum.UI_2D;node.addComponent(UITransform).setContentSize(width,height);parent.addChild(node);return node;
}
export function graphics(name:string,parent:Node):Graphics {return uiNode(name,parent).addComponent(Graphics);}
export function text(name:string,parent:Node,value:string,size:number,x=0,y=0,width=500,height=60,tint='#EFECE2'):Label {
  const node=uiNode(name,parent,width,height);node.setPosition(x,y);
  const label=node.addComponent(Label);label.string=value;label.fontSize=size;label.lineHeight=size*1.45;
  label.color=color(tint);label.horizontalAlign=Label.HorizontalAlign.CENTER;label.verticalAlign=Label.VerticalAlign.CENTER;
  label.overflow=Label.Overflow.SHRINK;return label;
}
export function setText(label:Label,value:string):void {if(label.string!==value)label.string=value;}
export function polygon(g:Graphics,points:readonly {x:number;y:number}[],fill:string,stroke?:string):void {
  if(!points.length)return;g.fillColor=color(fill);g.moveTo(points[0]!.x,points[0]!.y);
  for(let i=1;i<points.length;i++)g.lineTo(points[i]!.x,points[i]!.y);g.close();g.fill();
  if(stroke){g.strokeColor=color(stroke);g.lineWidth=1;g.stroke();}
}
export function disk(g:Graphics,x:number,y:number,r:number,fill:string):void {g.fillColor=color(fill);g.circle(x,y,r);g.fill();}
export function box(g:Graphics,x:number,y:number,w:number,h:number,fill:string,r=8):void {g.fillColor=color(fill);g.roundRect(x,y,w,h,r);g.fill();}
