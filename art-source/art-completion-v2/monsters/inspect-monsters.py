"""Read-only source PNG measurements. Does not edit, crop or recolour images."""
from pathlib import Path
from PIL import Image
import json, hashlib
root=Path(__file__).resolve().parents[3]
old=json.loads((root/'art-source/pixel-production-v1/inspection.json').read_text())
report={'alphaThreshold':128,'note':'Transparent RGB is not visible background; fractional alpha and colour counts are measurements, not approval. Crossing counts require opaque pixels on BOTH sides of the old cut.','atlases':{}}
for n,d in old.items():
 if n in ['hero','weapons','bodies','heads','skills','environment','perks']:continue
 p=root/'EmberDemo/assets/resources/art/pixel-v1'/f'{n}.png';im=Image.open(p);a=im.getchannel('A');px=a.load();hist=a.histogram();crossings=[]
 for row,xs in enumerate(d['actualRowCuts']):
  for x in xs[1:-1]:
   count=sum(px[x-1,y]>=128 and px[x,y]>=128 for y in range(d['yCuts'][row],d['yCuts'][row+1]))
   if count:crossings.append({'row':row,'x':x,'adjacentOpaquePairs':count})
 report['atlases'][n]={'size':list(im.size),'sha256':hashlib.sha256(p.read_bytes()).hexdigest(),'alpha0':hist[0],'alpha1to20':sum(hist[1:21]),'alpha21to127':sum(hist[21:128]),'alpha128to239':sum(hist[128:240]),'alpha240to255':sum(hist[240:]),'originalCutCrossings':crossings,'sourceFrameHeights':d['sourceFrameHeights']}
report['newRuntime']={}
for p in sorted((root/'EmberDemo/assets/resources/art/pixel-v2/monsters').glob('*.png')):
 im=Image.open(p);a=im.getchannel('A');report['newRuntime'][p.name]={'size':list(im.size),'bbox128':list(a.point(lambda v:255 if v>=128 else 0).getbbox()),'sha256':hashlib.sha256(p.read_bytes()).hexdigest()}
(root/'art-source/art-completion-v2/monsters/qa-measurements.json').write_text(json.dumps(report,indent=2)+'\n')
print('Measured 19 source monster atlases and',len(report['newRuntime']),'new runtime assets; PNG pixels untouched.')
