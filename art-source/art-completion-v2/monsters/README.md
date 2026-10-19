# Monster completion v2

2026-10-19. Used the repository ember-art skill and the built-in image_gen tool. No external API, raster repainting, cropping, recolouring, or invented metadata UUIDs. Model and seed were not exposed. Parent agent owns Creator import/build and gameplay visual QA.

## Delivered

- `definitions.json`: explicit safe frame selections for mirrorKnight, courtyardHeart both phases, mirrorRegent both phases; explicit bellKeeper body-axis/contact anchors; three new runtime atlas definitions. Body scale of every old atlas stays unchanged.
- `EmberDemo/assets/resources/art/pixel-v2/monsters/courtyardHeart-phase2-death.png`: three death poses, 2172x724, 3 cells of 724x724. Knees fold, lid closes, coral belly extinguishes. At 4 fps the final pose arrives at .5 seconds and holds through the existing .9 second fade. Common canvas ground y628, scale .25, axis x362. Original source pixels are untouched. Source foot minima605/625/628 preserve a short settling motion of at most5.75 design pixels; frames are not individually normalized.
- `mirrorRegent-strike.png` and `mirrorRegent-phase2-strike.png` in the same runtime directory: independently isolated full rightward arm strikes, 1254x1254. P1 oval disc, P2 diamond panel. Body scale128/858, common canvas ground y1051 and axis x520. Alpha128 bboxes are `[149,194,1227,1047]` and `[148,194,1227,1049]`. No neighbour sprite or chopped arm. Fine colour variation and nonbinary alpha remain; strict palette/grid conformance is not certified.
- `MonsterAnimation.ts` and `MonsterVisual.ts`: sampled strike pulse has priority during windup; three-pose death atlas playback; phase-specific separate mirror strike atlases; debug returns the actual resource path. No combat numbers, time windows or damage rules changed.
- `tests/monster-animation.test.ts`: four tests, including real EnemySystem30Hz snapshots showing hearthSeeds and regentMarks pulses before their nominal final windup.

## Audit and frame repairs

All19 source atlases (17 identities plus2 Boss phase atlases) were actually viewed with view_image. Each has all eight base poses, elites have skill poses, Boss phases preserve identity; source deaths are single compressed resting poses. This does not imply full multi-frame cycles or unique independent animations for every skill.

`qa-measurements.json` contains dimensions, SHA256, alpha bands, original source pose heights and actual cut crossings for all19. The accompanying `inspect-monsters.py` is read-only for PNGs and reruns the report. Crossings count alpha>=128 on BOTH sides of a cut: merely touching the first column of a neighbouring frame is not a cut.

The real original cut defects were mirrorKnight row1 x362, courtyardHeart both phases row1 x280, and mirrorRegent both phases row1 x256, row2 x512, row3 x256, row4 x256. Enlarging rectangles is insufficient: long arms overlap neighbouring bodies, and mirror halo poses12/13 even connect. Safe complete source poses replace those damaged regions in explicit metadata. No claimed pixel repair was performed.

Safe source selections (zero-based destination -> original source):

- mirrorKnight:4->9 (complete skill strike),5->0 (idle recovery).
- courtyardHeart and phase2:4->9 (complete furrows strike),5->0.
- mirrorRegent and phase2:4/9/12/16->15 (complete horizontal-arm pose);5/10/13/17->0. Actual strike pulses now select the newly generated phase-specific isolated patch instead. Windup/recovery still share safe poses; dedicated independent halo/marks transitions remain future work.

bellKeeper's436/288/362 row heights are correct transparent gaps, not a defect. They are retained. The low-band auto anchor could include the clapper and shift the torso during a walk; explicit x axes were measured against the arch body, with one ground per row (y436/724/1024), instead of using clapper extrema as contact points.

## Generation provenance and rejected candidates

Exact prompts, reference paths, original tool output paths and adoption status are in `generation-records.json` and `mirror-phase2-generation.json`. Every generated candidate is preserved under `candidates/`; runtime PNGs are copies of selected whole outputs.

The first mirror alpha-cleanup candidate was not adopted. The apparent gray background in view_image was not sufficient evidence: actual sampled source background RGBA had alpha0 or1. It is incorrect to call these opaque backgrounds or to reject the source because most sprite interiors use alpha252/253 rather than255. No further alpha-cleanup retries were made.

The first death strip had lids still ajar in frames2/3; one targeted edit closed both. The accepted full output is death-v3. Both isolated mirror strikes passed static silhouette/identity review. Runtime light/dark background, mirror flip, dense combat and transition review are delegated to the parent's Creator/browser run, not claimed here.

## Verification

- `pnpm exec vitest run tests/monster-animation.test.ts`:4 tests passed, including both real early-strike cases.
- `pnpm typecheck:cocos`: passed after final source changes.
- Read-only measurement script:19 source atlases and3 runtime assets measured.
- Full `pnpm check`, Creator import, generated `.meta`, actual browser scene verification: parent integration responsibility. Static images alone do not establish game animation acceptance.

Remaining: single-frame hurt/death and two-key walk remain on the other source monsters; not all older high-resolution sprites meet a strict shared texel grid/palette. The two mirror strike patches are shared attack-release poses across several actions, not independent bespoke complete skill clips. Eight-direction art, video and combat changes are outside this batch.

Final parent integration: Creator3.8.8 build,311 tests and103 browser checks passed. Both mirror stage strike patches were actually consumed and screenshotted; courtyard P2 was killed by formal fireball damage and showed death0/1/2 at0/.267/.5 seconds with stable grounding. See `reports/art-completion-validation.json` and `reports/art-animation-browser.json`. Remaining pose/grid limitations above still apply.
