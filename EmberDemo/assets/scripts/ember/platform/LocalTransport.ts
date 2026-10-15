import { MAPS } from '../content/maps';
import { GameWorld } from '../simulation/GameWorld';
import type { CommandPort, GameCommand } from './protocol';
/** Future networking boundary: commands in, detached snapshots out. */
export class LocalTransport implements CommandPort {
  world:GameWorld;
  constructor(readonly seed=1234) { this.world=new GameWorld(seed); }
  send(command:GameCommand):void {
    if(command.type==='SelectMap'&&this.world.phase==='ready'&&Object.prototype.hasOwnProperty.call(MAPS,command.mapId)){this.world=new GameWorld(this.seed,command.mapId);return;}
    if(command.type==='Restart') {this.world=new GameWorld(this.seed,this.world.mapId);return;}
    this.world.command(command);
  }
  snapshot() { return this.world.snapshot(); }
}
