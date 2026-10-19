"""Read-only atlas analysis. Writes metadata/regions, never changes PNG pixels."""
from pathlib import Path
from PIL import Image
import argparse, json, hashlib, math
parser=argparse.ArgumentParser(description=__doc__)
parser.add_argument('--check',action='store_true',help='Check generated metadata without writing files')
args=parser.parse_args()
root=Path(__file__).resolve().parents[1]
batch=root/'art-source/pixel-production-v1'
definitions=json.loads((batch/'production.json').read_text(encoding='utf-8'))
registry=root/'art-source/art-completion-v2/manifest.json'
if registry.exists():
 by_id={d['id']:d for d in definitions}
 for fragment in json.loads(registry.read_text(encoding='utf-8')):
  source=(root/fragment).resolve();assert source.is_relative_to(root),fragment
  for patch in json.loads(source.read_text(encoding='utf-8')):
   by_id[patch['id']]={**by_id.get(patch['id'],{}),**patch}
 definitions=list(by_id.values())
 batch=registry.parent
atlases={};report={}
for d in definitions:
 p=root/d['path']
 assert p.is_file(),f"Missing registered atlas: {p}"
 im=Image.open(p); assert im.mode=='RGBA',str(p)
 alpha=im.getchannel('A'); w,h=im.size; cols,rows=d['grid']
 assert cols>0 and rows>0 and len(d['poses'])<=cols*rows,d['id']
 assert len(set(d['poses']))==len(d['poses']),f"Duplicate pose: {d['id']}"
 mask=alpha.point(lambda a:255 if a>=128 else 0)
 frames=[]; heights=[]; measurements=[]
 explicit=d.get('frames') or d.get('explicitFrames')
 if not explicit and d.get('rects'):
  assert len(d['rects'])==len(d['anchors']),d['id']
  explicit=[{'rect':r,'anchor':a} for r,a in zip(d['rects'],d['anchors'])]
 if explicit: assert len(explicit)==len(d['poses']),d['id']
 ys=[0]
 for row in range(1,rows):
  expected=h*row/rows;span=h/rows*.22
  candidates=range(max(ys[-1]+1,round(expected-span)),min(h,round(expected+span)))
  def row_score(y):
   hist_row=mask.crop((0,y,w,y+1)).histogram()
   return hist_row[255]*h+abs(y-expected)
  ys.append(min(candidates,key=row_score))
 ys.append(h)
 # Generator grids are requests, not facts. Separate each ROW at actual transparent gaps.
 row_masks=[];row_cuts=[]
 for row in range(rows):
  y0,y1=ys[row],ys[row+1]
  band=mask.crop((0,y0,w,y1)); occupied=[bool(band.crop((x,0,x+1,y1-y0)).getbbox()) for x in range(w)]
  cuts=[0]
  for col in range(1,cols):
   expected=w*col/cols; span=w/cols*.32
   candidates=range(max(cuts[-1]+1,round(expected-span)),min(w,round(expected+span)))
   def score(x):
    return (sum(occupied[max(0,x-2):min(w,x+3)])*w+abs(x-expected))
   cut=min(candidates,key=score);cuts.append(cut)
  cuts.append(w);row_cuts.append(cuts)
 for i,pose in enumerate(d['poses']):
  col,row=i%cols,i//cols
  if explicit:
   x0,y0,fw,fh=explicit[i]['rect'];x1=x0+fw;y1=y0+fh
   assert all(isinstance(v,int) for v in [x0,y0,fw,fh]) and fw>0 and fh>0,d['id']
   assert 0<=x0<x1<=w and 0<=y0<y1<=h,(d['id'],i,'out of bounds')
  else:
   x0,x1=row_cuts[row][col],row_cuts[row][col+1]
   y0,y1=ys[row],ys[row+1]
  bbox=mask.crop((x0,y0,x1,y1)).getbbox(); assert bbox,(d['id'],i)
  heights.append(bbox[3]-bbox[1])
  # The common body SCALE is unchanged. Contact pivot is measured in the low foot band,
  # not the weapon bbox center. Tall held implements do not affect horizontal grounding.
  low=max(bbox[1],bbox[3]-max(3,round((bbox[3]-bbox[1])*.12)))
  foot=mask.crop((x0,y0+low,x1,y0+bbox[3])).getbbox()
  foot_x=(foot[0]+foot[2])/2 if foot else (bbox[0]+bbox[2])/2
  anchor=[foot_x/(x1-x0),(y1-y0-bbox[3])/(y1-y0)]
  if explicit:
   anchor=explicit[i]['anchor']
  elif d.get('kind')=='icon':
   # Icons/equipment are trimmed by metadata only. Source RGBA pixels remain untouched.
   x0+=bbox[0];y0+=bbox[1];x1=x0+bbox[2]-bbox[0];y1=y0+bbox[3]-bbox[1];anchor=[.5,.5]
  assert len(anchor)==2 and all(math.isfinite(v) and 0<=v<=1 for v in anchor),(d['id'],i,'invalid anchor')
  frames.append({'rect':[x0,y0,x1-x0,y1-y0],'anchor':anchor})
  measurements.append({'bbox':list(bbox),'footBand':foot,'anchor':anchor})
 hist=alpha.histogram(); assert hist[0]>w*h*.15,'Missing genuine alpha'
 scale=d.get('scale',atlases[d['baseScaleFrom']]['scale'] if d.get('baseScaleFrom') else d['height']/heights[0])
 assert math.isfinite(scale) and scale>0,d['id']
 resource=p.relative_to(root/'EmberDemo/assets/resources').with_suffix('').as_posix()
 digest=hashlib.sha256(p.read_bytes()).hexdigest()
 atlases[d['id']]={'resourcePath':resource,'sourceSize':[w,h],'sourceSha256':digest,'frames':frames,'height':d['height'],'scale':scale,'poses':d['poses']}
 report[d['id']]={'path':d['path'],'size':[w,h],'sha256':digest,'transparentPixels':hist[0],'fractionalAlphaPixels':sum(hist[1:255]),'lowAlphaPixels':sum(hist[1:16]),'nearOpaquePixels':sum(hist[240:]),'sourceFrameHeights':heights,'scale':scale,'grid':d['grid'],'explicitFrames':bool(explicit),'yCuts':ys if not explicit else None,'actualRowCuts':row_cuts if not explicit else None,'measurements':measurements,'poses':d['poses'],'qualityNote':'Measurements are not visual approval; alpha 1 RGB is not an opaque background.'}
out='/** Generated by scripts/inspect-pixel-art.py; original RGBA pixels are untouched. */\nexport interface PixelFrame {rect:[number,number,number,number];anchor:[number,number]}\nexport interface PixelAtlas {resourcePath:string;sourceSize:[number,number];sourceSha256:string;frames:PixelFrame[];height:number;scale:number;poses:string[]}\nexport const PIXEL_ATLASES:Record<string,PixelAtlas>={\n'+',\n'.join(json.dumps(k)+':'+json.dumps(v,separators=(',',':')) for k,v in atlases.items())+'\n};\n'
target=root/'EmberDemo/assets/scripts/ember/content/pixel-art.ts'
if args.check:
 assert target.read_text(encoding='utf-8')==out,'Pixel metadata is stale; regenerate after reviewing definitions.'
else:
 target.write_text(out,encoding='utf-8')
 (batch/'inspection.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
print(f"{'Checked' if args.check else 'Generated'} {len(atlases)} atlas definitions; PNG pixels unchanged.")
