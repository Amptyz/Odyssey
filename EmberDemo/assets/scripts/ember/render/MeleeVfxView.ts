import { Graphics, Mask, Sprite, UITransform, Vec4, type Material, type Node } from 'cc';
import { CollisionWorld } from '../combat-core/CollisionWorld';
import { shapeContours } from '../combat-core/ShapeContours';
import { mapDefinition } from '../content/maps';
import { campMap } from '../content/scenes';
import type { WorldSnapshot } from '../simulation/GameWorld';
import { graphics, polygon, uiNode } from './Primitives';
import { worldToScreen, screenVisible, worldLengthToScreen, type Projection } from './GroundProjection';
import { MeleeVfxTimeline, meleeArtSample, meleeArtHead, meleeShape, type MeleeVfxFrame } from './MeleeVfxPlan';
import type { ArtLibrary } from './ArtLibrary';
import { meleeRotation } from '../combat-core/MeleeSweep';
import { MELEE_ART } from '../content/melee-motion';

interface FlowInstance { node: Node; stencil: Graphics; sprite: Sprite; material: Material }

/** Approved source keyframes, rigidly placed around each actual Swing.
 * A terrain stencil clips the image; collision follows the bright head only. */
export class MeleeVfxView {
  private readonly timeline = new MeleeVfxTimeline();

  private readonly light: Graphics;
  private collision = new CollisionWorld();
  private mapKey = '';
  private frames: MeleeVfxFrame[] = [];
  private vertices = 0;
  private impacts = 0;
  private readonly instances: FlowInstance[] = [];
  constructor(private readonly lightParent: Node, private readonly art: ArtLibrary) {
    this.light = graphics('White melee flow', lightParent);
  }
  update(state: WorldSnapshot, alpha: number, camera: Projection, key: string): void {
    this.light.clear(); this.vertices = 0; this.impacts = 0;
    const mapKey = `${state.mapId}:${state.scene.kind}`;
    if (mapKey !== this.mapKey) {
      this.mapKey = mapKey;
      this.collision = new CollisionWorld(state.scene.kind === 'camp' ? campMap(state.mapId) : mapDefinition(state.mapId));
    }
    this.frames = this.timeline.update(state, alpha, `${key}:${state.wave}`);
    let index = 0;
    for (const frame of this.frames) {
      const at = worldToScreen(frame.center, camera);
      if (!screenVisible(at, worldLengthToScreen(frame.radius, camera))) continue;
      // The original artwork contains both the moving blade and its old wake.
      // Only terrain clips the image. Damage uses the independently authored head.
      const paths = shapeContours({kind:'circle',center:frame.center,radius:frame.radius}, this.collision);
      const sample=meleeArtSample(frame);
      if(sample.time<=0||sample.time>=360)continue;
      const instance = this.instances[index] ?? this.createInstance(); index++;
      instance.node.active = true; instance.node.setPosition(at.x, at.y);
      instance.stencil.clear();
      for (const path of paths) {
        const points = path.map(p => worldToScreen(p, camera));
        instance.stencil.moveTo(points[0]!.x-at.x, points[0]!.y-at.y);
        for (const p of points.slice(1)) instance.stencil.lineTo(p.x-at.x, p.y-at.y);
        instance.stencil.close(); instance.stencil.fill(); this.vertices += points.length;
      }
      const scale=worldLengthToScreen(frame.radius,camera)/MELEE_ART.radius;
      const rotation=meleeRotation(frame.facing),x=(MELEE_ART.cellWidth/2-MELEE_ART.pivot.x)*scale,y=(MELEE_ART.pivot.y-MELEE_ART.cellHeight/2)*scale;
      instance.sprite.node.setPosition(x*Math.cos(rotation)-y*Math.sin(rotation),x*Math.sin(rotation)+y*Math.cos(rotation));
      instance.sprite.node.angle=rotation*180/Math.PI;
      instance.sprite.node.getComponent(UITransform)!.setContentSize(MELEE_ART.cellWidth*scale,MELEE_ART.cellHeight*scale);
      const rect=(index:number)=>new Vec4(MELEE_ART.columns[index%4]!/MELEE_ART.width,MELEE_ART.rows[Math.floor(index/4)]!/MELEE_ART.height,MELEE_ART.cellWidth/MELEE_ART.width,MELEE_ART.cellHeight/MELEE_ART.height);
      instance.material.setProperty('frameA',rect(sample.a));instance.material.setProperty('frameB',rect(sample.b));
      const ha=meleeArtHead(sample.a),hb=meleeArtHead(sample.b);
      instance.material.setProperty('heads',new Vec4(ha.x,ha.y,hb.x,hb.y));
      instance.material.setProperty('playback',new Vec4(sample.mix,1,0,0));

    }
    // Leave in-use masks enabled: toggling them every render rebuilds stencil state.
    for (let i = index; i < this.instances.length; i++) this.instances[i]!.node.active = false;
    // Only a confirmed hit belonging to a melee attack gets the small white impact.
    // No particles around the whole arc, no impact for a miss, no damage callbacks.
    for (const cue of state.cues) {
      const age = cue.duration - cue.ttl;
      const frame = this.frames.find(f => f.id === cue.attackId && f.sourceId === cue.sourceId);
      if (cue.kind !== 'damage' || cue.cause !== 'basic' || !frame || age < 0 || age > .10 || this.impacts >= 12) continue;
      const at = worldToScreen(cue.at, camera), r = (9 - age * 55) * camera.zoom;
      const origin = worldToScreen(frame.center, camera), end = worldToScreen({ x: frame.center.x + frame.facing.x, y: frame.center.y + frame.facing.y }, camera);
      const angle = Math.atan2(end.y - origin.y, end.x - origin.x);
      const points = Array.from({ length: 8 }, (_, i) => {
        const a = angle + i * Math.PI / 4, radius = i % 2 === 0 ? r : r * .25;
        return { x: at.x + Math.cos(a) * radius, y: at.y + Math.sin(a) * radius };
      });
      polygon(this.light, points, '#FFFFFF' + Math.round((1 - age / .10) * 240).toString(16).padStart(2, '0'));
      this.impacts++;
    }
  }
  private createInstance(): FlowInstance {
    const node = uiNode('Terrain-clipped melee flow', this.lightParent);
    const mask = node.addComponent(Mask); mask.type = Mask.Type.GRAPHICS_STENCIL;
    const stencil = node.getComponent(Graphics)!;
    const sprite = uiNode('Painted white light', node).addComponent(Sprite);
    sprite.spriteFrame = this.art.meleeFrame; sprite.sizeMode = Sprite.SizeMode.CUSTOM;
    const material = this.art.meleeMaterial(); sprite.customMaterial = material;
    const instance = { node, stencil, sprite, material }; this.instances.push(instance); return instance;
  }
  blades() { return this.frames.filter(f=>f.phase==='active').map(meleeShape); }
  debug() {
    return { renderer: 'approved-keyframe-sequence', texture: MELEE_ART.resource, clock: 'completed simulation interval interpolation', vertices: this.vertices, impacts: this.impacts,
      frames: this.frames.map(f => ({ id: f.id, sourceId: f.sourceId, phase: f.phase, age: f.age, progress: f.progress,
        art:meleeArtSample(f), blade:f.phase==='active'?meleeShape(f):undefined,
        center: { ...f.center }, facing: { ...f.facing }, radius: f.radius, arc: f.arc })) };
  }
}
