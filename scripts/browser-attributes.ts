import { chromium } from '@playwright/test';
import { writeFileSync } from 'node:fs';
import type { WorldSnapshot } from '../EmberDemo/assets/scripts/ember/simulation/GameWorld';
import type { GameCommand } from '../EmberDemo/assets/scripts/ember/platform/protocol';

// Exercise the shipped Creator build through normal controls and validated developer commands.
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 720 } });
const checks: string[] = [], errors: string[] = [];
page.on('pageerror', error => errors.push(error.message));
page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
const check = (condition: unknown, label: string) => { if (!condition) throw Error(label); checks.push(label); };
const close = (a: number, b: number) => Math.abs(a - b) < 1e-6;
const state = () => page.evaluate(() => (window as any).__EMBER__.snapshot()) as Promise<WorldSnapshot>;
async function command(value: GameCommand) {
  await page.evaluate(c => (window as any).__EMBER__.send(c), value);
  await page.waitForTimeout(70);
}
async function click(x: number, y: number) {
  const box = (await page.locator('canvas').boundingBox())!;
  await page.mouse.click(box.x + box.width / 2 + x * box.width / 1280, box.y + box.height / 2 - y * box.height / 720);
  await page.waitForTimeout(100);
}
async function key(key: string) { await page.keyboard.press(key); await page.waitForTimeout(90); }

try {
  await page.goto('http://127.0.0.1:8080/?debug=1&seed=16');
  await page.waitForFunction(() => !!(window as any).__EMBER__?.snapshot().hero.attributeValues);
  let s = await state();
  check(!s.developer && s.hero.attributeValues.attackDamage === 20, 'Normal startup has baseline attributes and no developer source');
  check(close(s.hero.worldMoveSpeed, 4.2) && close(s.hero.movementPoints, 420), 'Unified movement conversion preserves the normal 4.2 world speed');
  await key('Enter');
  check((await state()).phase === 'shop', 'Normal keyboard flow opens the deterministic shop');
  await click(280, 113); // Staff.
  await click(280, -185); // Robe costs 100 too: the remaining 60 cannot buy it.
  s = await state();
  check(s.gold === 60 && s.stats.abilityPower === 30 && s.stats.abilityHaste === 10, 'Normal staff purchase produces AP/haste points and an unaffordable second item is rejected');
  check(s.hero.attributeValues.abilityPower === 30 && s.hero.maxHp === 240, 'Displayed shop stats and the authoritative unit attributes agree');
  await click(-390, -237); // Unequip universal slot1.
  s = await state();
  check(s.stats.abilityPower === 0 && s.hero.maxHp === 240 && s.hero.hp <= 240, 'Unequipping removes its source and clamps HP without healing');
  await click(280, 113); // Owned staff goes into the empty universal slot.
  s = await state();
  check(s.stats.abilityPower === 30 && s.gold === 60 && s.hero.hp <= 240, 'Re-equipping restores a source exactly once and does not heal');
  await page.screenshot({ path: 'reports/43-attribute-shop.png' });
  await key('Enter');
  s = await state();
  check(s.phase === 'fighting' && s.units.filter(u => u.team === 'enemy').every(u => u.attributeValues.maxHealth === u.maxHp), 'Every spawned enemy exposes the same attribute schema');

  await key('F2');
  await click(464, 237); // Attributes / sources tab.
  await click(220, 165); // players -> enemies.
  await click(220, 165); // enemies -> all.
  await click(220, 105);
  await page.locator('input:visible').last().fill('13');
  await click(0, 275); // Commit the native field by blurring it.
  s = await state();
  check(s.developer?.draft.attributeTarget === 'all' && s.developer.draft.attributeModifiers?.some(m => m.stat === 'attackDamage' && m.value === 13), 'F2 field configures an attribute source for every unit');
  check(s.hero.attributeValues.attackDamage === 20, 'Editing a draft does not mutate the running world');
  const draft = s.developer!.draft;
  await command({ type: 'DevConfigure', config: { ...draft, options: { ...draft.options, freezeEnemies: true, invincible: true, speed: 1 } } });
  await click(440, -322);
  s = await state();
  check(s.developer?.enabled && s.hero.attributeValues.attackDamage === 33, 'Applying the test source changes player AD');
  check(s.units.some(u => u.kind === 'melee' && u.attributeValues.attackDamage === 25), 'The same source changes enemy AD through the same resolver');
  check(s.units.every(u => u.attributeExplanation.sources.some(source => source.sourceId === 'developer')), 'Every affected unit can explain the applied test source');
  await key('F2');
  await click(-350, 165); // Inspect the first enemy.
  await page.screenshot({ path: 'reports/44-attribute-inspector.png' });

  const next = (await state()).developer!.draft;
  await command({ type: 'DevConfigure', config: {
    ...next, attributeTarget: 'players',
    loadout: { Q: 'shield', W: 'ironGuard', E: 'dash', R: 'nova' },
    attributeModifiers: [
      { stat: 'abilityPower', operation: 'flat', value: 100 },
      { stat: 'abilityHaste', operation: 'flat', value: 100 },
      { stat: 'magicResist', operation: 'flat', value: 100 },
    ],
  } });
  await click(440, -322);
  s = await state();
  check(s.stats.abilityPower === 130 && s.stats.abilityHaste === 110 && s.stats.magicResist === 100, 'Equipment and explicit test sources combine using their own units');
  check(s.units.filter(u => u.team === 'enemy').every(u => !u.attributeExplanation.sources.some(source => source.sourceId === 'developer')), 'Player-only modifiers do not leak to enemies');
  await key('q');
  s = await state();
  check(s.cooldowns.Q > 9 / 2.1 - .3 && s.cooldowns.Q <= 9 / 2.1, 'Real casting consumes the haste-adjusted skill cooldown');
  await key('w');
  s = await state();
  check(s.hero.shields.length === 2 && close(s.hero.shield, 425.5), 'Two AP-scaled shields coexist as independent instances');
  await page.waitForFunction(() => (window as any).__EMBER__.snapshot().hero.shields.length === 1, undefined, { timeout: 8000 });
  s = await state();
  check(close(s.hero.shield, 276), 'The four-second shield expires without deleting the six-second shield');
  await key('F2');
  const frozen = JSON.stringify((await state()).hero.shields);
  await page.waitForTimeout(350);
  check(JSON.stringify((await state()).hero.shields) === frozen, 'Developer inspection freezes independent shield timers');
  await click(-440, -322);
  s = await state();
  check(s.phase === 'ready' && !s.developer && s.stats.abilityPower === 0 && s.hero.attributeValues.attackDamage === 20, 'Exiting test mode removes test attributes, gear, and temporary state');
  check(errors.length === 0, 'No browser JavaScript errors');
  writeFileSync('reports/browser-attributes.json', JSON.stringify({ status: 'passed', checks, errors, timestamp: new Date().toISOString() }, null, 2) + '\n');
  console.log(`Attribute browser regression passed (${checks.length} checks).`);
} catch (error) {
  await page.screenshot({ path: 'reports/attributes-failure.png' });
  writeFileSync('reports/browser-attributes.json', JSON.stringify({ status: 'failed', checks, errors, error: String(error) }, null, 2) + '\n');
  throw error;
} finally { await browser.close(); }
