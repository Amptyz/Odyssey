# Hero and equipment v2

The four selected files are copied byte-for-byte into `EmberDemo/assets/resources/art/pixel-v2/`. Stable atlas IDs remain hero, weapons, bodies and heads. `measurements.json` contains explicit metadata-only trimmed rectangles and SHA256 hashes. All atlases contain six frames in the existing item order. Heads have a row boundary at source y=570, not 512: equal-grid splitting cuts off the hood and helmet.

## Selection

- hero-v2: identity-preserving edit of pixel-v1 hero. Friendly ordinary hair and neutral clothes preserved. Sleeve-to-forearm joints sampled at (1280,285) and (245,735) are physical alpha253 pixels, not background gaps. Shoulder and palm positions were remeasured and placed in HeroRig separately from legacy arm percentages; original shoulder positions and 8×19 display arm sizes remain.
- hero-v3: rejected additional candidate. It changes the head to a frontal view and adds trousers to the torso part. It is retained only as provenance and is not copied to runtime.
- weapons-v2: all six wearable implements simplified, with distinct short grips and less bright decoration. Sword, staff, cleaver and runeblade use measured low grips; bow uses its physical middle grip, shield its center boss. Display ratios are closer to source aspect ratios.
- bodies-v2: six compact garments with short shoulder caps, no embedded skin or limbs. Replaces long-sleeved display illustrations with wearable short overlays.
- heads-v2: six simpler wearable overlays. Sampled helmet face, hood face, both mask eyes, circlet interior and crown interior are all alpha0. Visor and crown get separate vertical placements; headgear now follows the head pivot during recoil.

## Transparency and pixel limitations

The image viewer displays nonzero hidden RGB in transparent pixels as dark colored halos. Those RGB colors alone do not prove baked visible backgrounds. Actual alpha measurements are recorded. Every selected output has genuine transparent pixels and alpha max254, with interiors primarily253/254; no image has strict binary alpha. Low-alpha edge pixels and a larger-than-requested measured palette remain. No Python drawing, alpha cleanup, thresholding, cropping or compositing was performed. The tool's requested 24-color palette is a production target that the outputs did not strictly meet. Do not claim exact low-resolution texel or 24-color compliance.

## Validation

`pnpm typecheck:cocos` passed after HeroRig changes. No gameplay formulas, simulation clocks or collision shapes changed.

The parent built Creator Web Desktop with the explicit frames and exposed it on local port8083. `browser-qa.mjs` captured the real 1280×720 Cocos canvas for the empty rig and all six weapon/body/head triplets, both walking directions and attacks, using explicitly applied F2 configuration at 0.25 speed. Full screenshots, original canvas screenshot clips and pose observations are under `reports/hero-equipment-v2/`. The final run waits for actual attackCd=0 before every attack; earlier attempted left attacks blocked by cooldown and screenshots obscured by pause were superseded.

Manual inspection of idle, movement and attack screenshots found genuine transparent compositing, visible base face through helmet/hood and mask eye holes, connected shoulder/garment silhouettes and attached grips without obvious floating weapons in these combinations. The mask is visually strong and the crown is tall, but no severe fitting defect justified another transform change. No PNG editing was performed. Screenshot/pose inspection covers near-maximum strike ages approximately0.17–0.23; it does not establish continuous animation smoothness or strict texel consistency.

Not covered by this focused pass: cast/hurt/death poses, every cross-product of mixed garments/headgear, natural purchase/reward flows, four-player overlap or GPU performance. Normal purchase and final rebuilt game validation belong to the parent task. This test configuration does not stand in for those results.

Additional second-build check: `reports/art-animation-browser.json` records actual shield cast (pose age.1333), actual melee hurt (48/240HP, hurt age0) and death (invincible=false, death age.0331). The normal defeat overlay obscures final hero collapse, so only its transition is covered. Four formal fireball hits trigger a living courtyard Boss phase2 and then kill it; three screenshots show actual death0/1/2 at ages0/.2667/.5, fixed world position(10,8), readable lid closure and low resting body without large foot drift. No HP/snapshot injection or health25 action was used. Browser closed after capture and all seven additional screenshots were inspected.

Supplemental real browser pass captured cast, enemy-hit hurt, and death transition; the defeat overlay obscured the final settled death pose. It also verified the new courtyard Boss death sequence via actual fireball damage. See `reports/art-animation-browser.json`; it does not broaden fitting coverage to every possible equipment combination. Final parent build and normal shop regression are recorded in `reports/art-completion-validation.json`.
