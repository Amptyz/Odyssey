import { Graphics,type Node } from 'cc';
import { PROCEDURAL_EQUIPMENT } from '../content/appearances';
import { polygon,uiNode } from './Primitives';
/** Geometry is drawn once when equipped; all animation belongs to the shared rig. */
export function createEquipmentVisual(parent:Node,appearance:string):Node|undefined {
  const definition=PROCEDURAL_EQUIPMENT[appearance];if(!definition)return undefined;
  const node=uiNode(`Procedural equipment ${appearance}`,parent,40,64),g=node.addComponent(Graphics);
  for(const shape of definition.polygons)polygon(g,shape.points.map(([x,y])=>({x,y})),shape.fill,shape.outline===false?undefined:'#66584C');
  return node;
}
