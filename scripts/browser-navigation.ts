import type {Page} from '@playwright/test';

/** Walk across an open camp with real right-clicks, including off-screen targets.
 * These fixtures must not assume that the entire camp fits in one viewport.
 */
export async function walkCampWithRightClick(page:Page,target:{x:number;y:number}):Promise<void> {
  for(let step=0;step<30;step++){
    const next=await page.evaluate(target=>{
      const api=(window as any).__EMBER__,hero=api.snapshot().hero;
      if(Math.hypot(hero.x-target.x,hero.y-target.y)<.3)return null;
      const a=api.screen(hero.x,hero.y),b=api.screen(target.x,target.y);
      const dx=b.x-a.x,dy=b.y-a.y;
      // Keep the click clear of the HUD and within the visible arena.
      let t=1;
      if(dx)t=Math.min(t,((dx>0?320:-320)-a.x)/dx);
      if(dy)t=Math.min(t,((dy>0?160:-160)-a.y)/dy);
      if(t<=0)throw Error('Player has not returned inside the camera safe area');
      return{world:{x:hero.x+(target.x-hero.x)*t,y:hero.y+(target.y-hero.y)*t},screen:{x:a.x+dx*t,y:a.y+dy*t}};
    },target);
    if(!next)return;
    const box=(await page.locator('canvas').boundingBox())!;
    await page.mouse.click(box.x+box.width/2+next.screen.x*box.width/1280,box.y+box.height/2-next.screen.y*box.height/720,{button:'right'});
    await page.waitForFunction(at=>{
      const h=(window as any).__EMBER__.snapshot().hero;
      return Math.hypot(h.x-at.x,h.y-at.y)<.25;
    },next.world,{timeout:10000});
    await page.waitForTimeout(100);
  }
  throw Error('Camp right-click traversal did not reach the requested interaction');
}
