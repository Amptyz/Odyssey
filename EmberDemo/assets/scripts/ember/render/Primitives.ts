import { Color, Graphics, Label, Layers, Node, UITransform } from 'cc';
const UI_COLORS:Record<string,string>={'#20373D':'#18191F','#243E43':'#202028','#3B5859':'#33323A','#30454B':'#292831','#2D464C':'#24232C','#243F46':'#1C1C23','#263F46':'#202029','#10242C':'#111117','#344B51':'#292831','#344D52':'#292831','#3E5559':'#35313B','#547B75':'#A74936','#668D7C':'#9F513C','#3D5B55':'#48483D','#526E61':'#514C3E','#405D62':'#35313B','#445F61':'#35313B','#EFE2C1':'#F1E6D2','#C2D6CA':'#CEC8BC','#B8D4C7':'#B7B2AB','#A3BEB1':'#A6A39B'};
export const color = (hex:string):Color => new Color().fromHEX((UI_COLORS[hex.slice(0,7).toUpperCase()]??hex.slice(0,7))+hex.slice(7));
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
export function box(g:Graphics,x:number,y:number,w:number,h:number,fill:string,r=8):void {
 if(w<=0||h<=0)return;g.fillColor=color(fill);
 if(r>=6){const cut=Math.min(10,h/4,w/8);g.moveTo(x+cut,y);g.lineTo(x+w,y);g.lineTo(x+w,y+h-cut);g.lineTo(x+w-cut,y+h);g.lineTo(x,y+h);g.lineTo(x,y+cut);g.close();g.fill();}
 else{g.rect(x,y,w,h);g.fill();}
}
