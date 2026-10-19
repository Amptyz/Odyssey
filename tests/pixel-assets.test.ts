import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {describe,it,expect} from 'vitest';
import {PIXEL_ATLASES} from '../EmberDemo/assets/scripts/ember/content/pixel-art';

// A replaced PNG must never keep regions measured against an older source image.
describe('runtime atlas source contract',()=>{
 for(const [id,atlas] of Object.entries(PIXEL_ATLASES)){
  it(`${id}: source identity, dimensions and regions agree`,()=>{
   expect(atlas.resourcePath).toMatch(/^art\/[\w/-]+$/);
   const bytes=readFileSync(resolve('EmberDemo/assets/resources',atlas.resourcePath+'.png'));
   expect(bytes.subarray(0,8).toString('hex')).toBe('89504e470d0a1a0a');
   expect(createHash('sha256').update(bytes).digest('hex')).toBe(atlas.sourceSha256);
   const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20);
   expect(atlas.sourceSize).toEqual([width,height]);
   expect(atlas.frames.length).toBe(atlas.poses.length);
   expect(new Set(atlas.poses).size).toBe(atlas.poses.length);
   expect(atlas.scale).toBeGreaterThan(0);
   for(const {rect:[x,y,w,h],anchor} of atlas.frames){
    expect([x,y,w,h].every(Number.isInteger)).toBe(true);
    expect(x).toBeGreaterThanOrEqual(0);expect(y).toBeGreaterThanOrEqual(0);
    expect(w).toBeGreaterThan(0);expect(h).toBeGreaterThan(0);
    expect(x+w).toBeLessThanOrEqual(width);expect(y+h).toBeLessThanOrEqual(height);
    expect(anchor.every(v=>Number.isFinite(v)&&v>=0&&v<=1)).toBe(true);
   }
  });
 }
});
