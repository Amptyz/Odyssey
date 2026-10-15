/** Small binary priority queue used by A*: avoids scanning the whole open set. */
export class MinHeap {
  private nodes:{id:number;score:number}[]=[];
  get size():number{return this.nodes.length;}
  push(id:number,score:number):void {
    const item={id,score};let i=this.nodes.length;this.nodes.push(item);
    while(i>0){const parent=(i-1)>>1;if(this.nodes[parent]!.score<=score)break;this.nodes[i]=this.nodes[parent]!;i=parent;}
    this.nodes[i]=item;
  }
  pop():number {
    const first=this.nodes[0]!,last=this.nodes.pop()!;
    if(this.nodes.length){let i=0;while(i*2+1<this.nodes.length){let child=i*2+1;
      if(child+1<this.nodes.length&&this.nodes[child+1]!.score<this.nodes[child]!.score)child++;
      if(this.nodes[child]!.score>=last.score)break;this.nodes[i]=this.nodes[child]!;i=child;
    }this.nodes[i]=last;}
    return first.id;
  }
}
