/** Offline measurement only: decode the original PNG, reproduce the shader's
 * head registration, and author one radial outline per sampled active pose.
 * Runtime collision never reads image pixels. Run: node --import tsx scripts/measure-melee.mjs */
import {chromium} from '@playwright/test';
import {readFileSync,writeFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {MELEE_ART,MELEE_BLADE_KEYS} from '../EmberDemo/assets/scripts/ember/content/melee-motion.ts';
const source='EmberDemo/assets/resources/art/melee-v3/keyframes-source.png';
const png=readFileSync(source),sha=createHash('sha256').update(png).digest('hex');
const heads=Array.from({length:12},(_,index)=>{
 const key=MELEE_BLADE_KEYS[Math.max(0,Math.min(4,index-2))];
 const mean=key.points.reduce((p,q)=>({x:p.x+q[0]/key.points.length,y:p.y+q[1]/key.points.length}),{x:0,y:0});
 return {x:(MELEE_ART.pivot.x+mean.x*MELEE_ART.radius)/MELEE_ART.cellWidth,y:(MELEE_ART.pivot.y-mean.y*MELEE_ART.radius)/MELEE_ART.cellHeight};
});
const browser=await chromium.launch({channel:'chrome',headless:true});
let result;
try{
 const page=await browser.newPage();
 result=await page.evaluate(async ({url,art,heads})=>{
  const image=new Image();image.src=url;await image.decode();
  const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
  const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(image,0,0);
  const rgba=ctx.getImageData(0,0,canvas.width,canvas.height).data;
  const W=art.cellWidth,H=art.cellHeight,N=720,STEPS=80,SUB=4,cutoff=.1,padding=.75;
  const cells=Array.from({length:12},(_,i)=>{
   const values=new Float32Array(W*H),x0=art.columns[i%4],y0=art.rows[Math.floor(i/4)];
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){const p=((y0+y)*canvas.width+x0+x)*4;values[y*W+x]=(.2126*rgba[p]+.7152*rgba[p+1]+.0722*rgba[p+2]-35)/220;}
   return values;
  });
  const sample=(cell,u,v)=>{
   if(u<0||v<0||u>1||v>1)return 0;
   const px=Math.max(0,Math.min(W-1,u*W-.5)),py=Math.max(0,Math.min(H-1,v*H-.5));
   const x=Math.floor(px),y=Math.floor(py),xx=Math.min(W-1,x+1),yy=Math.min(H-1,y+1),tx=px-x,ty=py-y;
   // Unmatting happens after bilinear texture filtering, as in the real shader.
   return Math.max(0,Math.min(1,(cell[y*W+x]*(1-tx)+cell[y*W+xx]*tx)*(1-ty)+(cell[yy*W+x]*(1-tx)+cell[yy*W+xx]*tx)*ty));
  };
  const sampledProfiles=[],metrics=[],keyPixels=[];
  let maxPixelOutside=0,maxPadding=0,radialErrorSum=0,radialErrorCount=0,maxArcDegrees=0;
  for(let step=0;step<=STEPS*SUB;step++){
   const p=step/(STEPS*SUB),time=120+p*120;
   let a=0;while(a<art.times.length-2&&time>=art.times[a+1])a++;
   const b=a+1,mix=(time-art.times[a])/(art.times[b]-art.times[a]);
   const hx=heads[a].x+(heads[b].x-heads[a].x)*mix,hy=heads[a].y+(heads[b].y-heads[a].y)*mix;
   const bins=new Float64Array(N),pixels=[];
   let minX=W,minY=H,maxX=0,maxY=0,oldCrop=0;
   for(let y=0;y<H;y++)for(let x=0;x<W;x++){
    const u=(x+.5)/W,v=(y+.5)/H,d=Math.hypot(u-hx,v-hy),t=Math.max(0,Math.min(1,(d-.12)/.24)),influence=1-t*t*(3-2*t);
    const sa=sample(cells[a],u-(hx-heads[a].x)*influence,v-(hy-heads[a].y)*influence);
    const sb=sample(cells[b],u-(hx-heads[b].x)*influence,v-(hy-heads[b].y)*influence);
    if(sa*(1-mix)+sb*mix<cutoff)continue;
    const dx=x+.5-art.pivot.x,dy=art.pivot.y-y-.5,r=Math.hypot(dx,dy),angle=(Math.atan2(dy,dx)+Math.PI*2)%(Math.PI*2),bin=angle/(Math.PI*2)*N;
    bins[Math.floor(bin)]=Math.max(bins[Math.floor(bin)],r);pixels.push([bin,r]);
    if(dx*Math.sin(35*Math.PI/180)+dy*Math.cos(35*Math.PI/180)<0)oldCrop++;
    minX=Math.min(minX,x);maxX=Math.max(maxX,x);minY=Math.min(minY,y);maxY=Math.max(maxY,y);
   }
   // A ray interpolates adjacent bin maxima. One-neighbour dilation encloses
   // texel centres, with <1 source-pixel allowance for the texel footprint.
   const radii=Array.from(bins,(_,i)=>Math.max(bins[(i+N-1)%N],bins[i],bins[(i+1)%N]));
   const populated=radii.map((r,i)=>r>0?i:-1).filter(i=>i>=0);
   let gap=0,gapStart=0;
   for(let i=0;i<populated.length;i++){const d=(populated[(i+1)%populated.length]-populated[i]+N)%N;if(d>gap){gap=d;gapStart=populated[i];}}
   const start=(gapStart+gap)%N,span=N-gap;
   // Fill angular gaps inside the contiguous curved sweep, keeping its rear gap.
   let last=start;
   for(let offset=1;offset<=span;offset++){
    const i=(start+offset)%N;if(!radii[i])continue;
    const distance=(i-last+N)%N;
    for(let k=1;k<distance;k++)radii[(last+k)%N]=radii[last]+(radii[i]-radii[last])*k/distance;
    last=i;
   }
   for(let i=0;i<N;i++)if(radii[i])radii[i]+=padding;
   for(const [bin,r]of pixels){const i=Math.floor(bin),f=bin-i,edge=radii[i]*(1-f)+radii[(i+1)%N]*f;maxPixelOutside=Math.max(maxPixelOutside,r-edge);}
   for(let i=0;i<N;i++)if(bins[i]){const error=radii[i]-bins[i];maxPadding=Math.max(maxPadding,error);radialErrorSum+=error;radialErrorCount++;}
   maxArcDegrees=Math.max(maxArcDegrees,span*360/N);
   sampledProfiles.push(radii);
   if(step%(16*SUB)===0){keyPixels.push(pixels);metrics.push({progress:p,sourceTime:time,pixels:pixels.length,bounds:[minX,minY,maxX,maxY],maxRadius:Math.max(...radii),startDegrees:start*360/N,arcDegrees:span*360/N,old180CropPercent:100*oldCrop/pixels.length});}
  }
  const peak=metrics.find(m=>m.progress===.8),rotationOffsetDegrees=90-(peak.startDegrees+peak.arcDegrees/2);
  // The image and collision select exactly the same one of 81 measured poses.
  // A shared 1.5 ms phase quantum avoids interpolating a missing angular ray
  // through a still-visible part of the light. Extra samples document its motion.
  const poses=Array.from({length:STEPS+1},(_,i)=>sampledProfiles[i*SUB]);
  // Independent Euclidean edge-to-pixel measurement (not a same-ray distance).
  for(let k=0;k<metrics.length;k++){
   const visible=new Uint8Array(W*H);
   for(const [bin,r]of keyPixels[k]){const a=bin/N*Math.PI*2,x=Math.round(art.pivot.x+Math.cos(a)*r-.5),y=Math.round(art.pivot.y-Math.sin(a)*r-.5);visible[y*W+x]=1;}
   const distances=[];
   for(const [i,r]of poses[Math.round(metrics[k].progress*STEPS)].entries())if(r){
    const a=i/N*Math.PI*2,x=art.pivot.x+Math.cos(a)*r-.5,y=art.pivot.y-Math.sin(a)*r-.5,cx=Math.round(x),cy=Math.round(y);let best=Infinity;
    const test=(px,py)=>{if(px>=0&&py>=0&&px<W&&py<H&&visible[py*W+px])best=Math.min(best,Math.hypot(px-x,py-y));};
    for(let ring=0;ring<=W;ring++){for(let dx=-ring;dx<=ring;dx++){test(cx+dx,cy-ring);test(cx+dx,cy+ring);}for(let dy=-ring+1;dy<ring;dy++){test(cx-ring,cy+dy);test(cx+ring,cy+dy);}if(ring>best+1)break;}
    distances.push(best);
   }
   distances.sort((a,b)=>a-b);metrics[k].boundaryToArtworkPixels={max:Math.max(...distances),p95:distances[Math.floor(distances.length*.95)],mean:distances.reduce((a,b)=>a+b,0)/distances.length};
  }
  const referenceRadius=Math.max(...poses.map(p=>Math.max(...p)));
  return {referenceRadius,maxArcDegrees,angularSamples:N,poseSteps:STEPS,shaderSamples:STEPS*SUB+1,measurementIntervalMilliseconds:120/(STEPS*SUB),alphaThreshold:cutoff,sourcePadding:padding,rotationOffsetDegrees,poses:poses.map(p=>p.map(r=>Math.round(r/referenceRadius*1e6)/1e6)),metrics,error:{maxVisiblePixelOutside:maxPixelOutside,maxRadialBinPadding:maxPadding,meanRadialBinPadding:radialErrorSum/radialErrorCount}};
 },{url:'data:image/png;base64,'+png.toString('base64'),art:MELEE_ART,heads});
}finally{await browser.close();}
const generated={sourceSha256:sha,referenceRadius:result.referenceRadius,maxArcDegrees:result.maxArcDegrees,angularSamples:result.angularSamples,poseSteps:result.poseSteps,alphaThreshold:result.alphaThreshold,rotationOffsetDegrees:result.rotationOffsetDegrees,poses:result.poses};
const ts='/** Generated by scripts/measure-melee.mjs from the shader-visible source outline. Do not hand-edit. */\nexport const MELEE_OUTLINE: {sourceSha256:string;referenceRadius:number;maxArcDegrees:number;angularSamples:number;poseSteps:number;alphaThreshold:number;rotationOffsetDegrees:number;poses:readonly (readonly number[])[]} = '+JSON.stringify(generated).replace('\"poses\":[','\"poses\":[\n').replaceAll('],[','],\n[')+';\n';
const target='EmberDemo/assets/scripts/ember/content/melee-outline.ts';
if(process.argv.includes('--check')){
 if(readFileSync(target,'utf8')!==ts)throw Error('Melee outline is stale; regenerate from the PNG.');
}else writeFileSync(target,ts);
const summary={source,sourceSha256:sha,referenceRadius:MELEE_ART.radius,...result};delete summary.poses;
summary.oldCircle={referenceRadius:180,arcDegrees:180};
summary.screenPixelsPerSourcePixel=5/result.referenceRadius*(54/Math.sqrt(2))*1.25;
summary.defaultCamera={pixelsPerWorldUnit:54/Math.sqrt(2)*1.25,baseReach:5,pixelsPerSourcePixel:summary.screenPixelsPerSourcePixel};
for(const frame of summary.metrics){
 frame.worldMaxRadius=frame.maxRadius/result.referenceRadius*5;frame.screenMaxRadius=frame.worldMaxRadius*summary.defaultCamera.pixelsPerWorldUnit;
 frame.boundaryToArtworkScreenPixels={max:frame.boundaryToArtworkPixels.max*summary.screenPixelsPerSourcePixel,p95:frame.boundaryToArtworkPixels.p95*summary.screenPixelsPerSourcePixel};
}
writeFileSync('reports/melee-outline-measurement.json',JSON.stringify(summary,null,2)+'\n');
console.log(JSON.stringify(summary));
