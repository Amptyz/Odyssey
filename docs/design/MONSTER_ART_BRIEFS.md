# 17种怪物美术设定与制作Brief

2026-10-16。只交付设定、Prompt与动画规格，**没有生成/编辑任何PNG、动画、视频或.meta**。战斗数值与稳定ID唯一对应 [MONSTER_DESIGN.md](MONSTER_DESIGN.md)，本文件没有可自动导入的manifest。使用 [ember-art skill](../../.agents/skills/ember-art/SKILL.md) 及其 [Prompt](../../.agents/skills/ember-art/references/prompts.md)、[动画契约](../../.agents/skills/ember-art/references/animation.md)，遵循 [风格](../ART_DIRECTION.md) 与 [管线](../ART_PIPELINE.md)。

## 全体画面约束

后续视觉交付：现已依据本设定完成 [17 怪物设计草图](../../art-source/design-sketches-v1/README.md)，含正 / 侧 / 背、基础动作、普攻、5 种精英技能与 2 个 Boss 完整技能及阶段页。开头“没有生成”描述的是首次 Brief 交付阶段；本轮 PNG 为设计板，运行时仍使用原程序轮廓 / 动画。当前范围倍率与准确时序见草图册的配置核对表，不能按图中文字反推战斗配置。

后续统一为明亮像素遗迹风，象牙石、鼠尾草、浅青水色，局部珊瑚/金色/冰青区分身份。每种主体 3–5 主色块、2–3 级硬边色阶、清楚像素簇与阶梯暖深描边；一个主轮廓加1–2个识别点，禁止密集雕刻、叶脉、碎石、写实裂痕、金属镜面反射。霜镜也保持明亮，不做恐怖暗黑冰窟。

源像素网格、逻辑画布、共享色板和显示倍率统一遵循 [ART_DIRECTION](../ART_DIRECTION.md#源像素网格与显示目标)，以下尺寸保持屏幕构图参照，不等于源像素分辨率。原 PNG 与现有程序怪物仍未像素化。

全体一个三分之四原始朝向，屏幕右下为标准出手方向，运行时左右镜像；没有四/八向、Spine或衣料物理。单位的武器/器具属于该怪物固定身份，不是玩家换装槽；镜像后手与器具整体翻转，不能换手重画。所有技能球、枪线、落地圈、冲锋扬尘和爆炸独立渲染，不烘进本体图集；炉心、面部金色标记可以作为固定材质留下，禁止常驻大光环。

尺寸表为1280×720、地图zoom=1时目标“正常站姿最大宽×高”，单位屏幕像素；不是强制把每帧bbox缩成这个矩形。极值动作允许宽度+20%，但躯干尺度保持不变，实际需要用返回PNG测量pixelScale。受击radius是地面世界格，**贴图不决定碰撞**；主要身体投影覆盖受击圈，突出手臂/叶片/枪尖可在圈外，不是额外弱点机制。默认投影54×28，世界圆r在屏幕投影约宽`76.37r`、高`39.60r`；例如B01 r=.9约68.7×35.6地面椭圆，身体底座宽约68，左右臂扩至112。Boss体积差异是真实radius差异，接入先完成按体型导航，不把大怪挤成玩家碰撞体。

脚底策略 A：先按权威风格指南选定逻辑画布与倍率，再留四周≥12%透明空间覆盖全动作；原 256/512 高分辨率画布建议已由像素基准替代。固定身体比例与足底中心，下垂武器/碎片不得低于足底基线。`ArtFrame.rect` 为实际图集左上像素、pivot 为裁区像素；制作足底点取所选逻辑画布宽约 1/2、高约 7/8，映射到导出图像后记录；**这些是制作画布参考，不是当前播放器任意Y-pivot功能**。当前inspect-art裁边、AnimatedUnit只读pivotX，anchorY=0；输出须确保所有帧最低非透明像素落在同一足底线且不夹带地面投影，死亡不可掉零件到更低处。若要保留整体腾空或任意Y锚点，另实施策略B（统一画布/偏移/共同pivot与渲染消费），本批默认不采用。

## 图集与状态时长

现有16帧4×4布局适合作为小怪的最低生产基线S：idle0–3、walk4–7、attack8–11、hurt12、death13–15；cast可复用attack但不同器具姿势要独立生产再调整布局，不能靠调色变成专属动作。S：idle4帧4fps=1秒循环；walk4帧9fps≈.444秒循环；attack4帧9fps≈.444秒one-shot；hurt1帧8fps=.125秒；death3帧4fps=.75秒one-shot，.9秒内淡出。风格检查需涵盖首尾接续、镜像、死亡最终不复活。

S仅表示帧分配，**不代表能正确表现整段战斗时间**：当前windup将attack固定age=.08，出手后动作只显示.45秒、hurt优先、cast默认7fps名义.571秒且会截尾。小怪制作可以把8号帧画为明显蓄力、9号接触、10号过冲、11号回位；但现有出手时又从8号开始，9号不能天然与模拟命中同步。接入任何新怪前需补“前摇保持关键姿→出手重映射到接触帧→恢复”的动作相位映射，并让hurt只叠短反馈不抹掉威胁姿态。伤害仍由模拟时钟触发，禁止动画回调扣HP。枪线/双钳/冲锋/Boss必须有新相位映射，不能承诺当前16帧直接完整播放。

精英扩展E建议24帧（4列6行）：idle4/walk4/attack4/cast8/hurt1/death3；cast8帧仅为姿势库，按模拟phase映射，不使用固定8/fps决定技能命中。Boss扩展B建议40帧（5列8行）：idle4/walk4/attack4/skillA8/skillB8/skillC8/hurt1/death3；P2身份变化优先用炉盖/镜盘局部层或替代关键帧，不把伤害特效画进身体。扩展多skill剪辑与阶段外观目前不支持，需要扩展MotionPose/AnimationClips、动作快照及图集生成来源。

每个brief的“动作”按 `待机；移动；普攻8→9→10→11；技能；受击；死亡`给关键姿势。未另写时idle/walk/hurt/death用S时长；普攻实际前摇/生效/后摇和技能完整时序唯一读取战斗稿，不能用本体4帧.444秒重写3秒攻击周期。长前摇保持姿态，短接触帧占.08–.15秒，剩余后摇回到防备。精英技能关键姿势在E的8帧库中做，不要求每个姿势等时；Boss用B并按循环阶段播放。

## 10小怪独立Brief

### N01 `melee` 苔刃精灵

- **轮廓/色材**：前倾水滴形石身、两短腿、一只持叶形短石刃的手；另一手空。陶土灰`#B49B82`、鼠尾草`#86A58B`、少量浅金面纹`#DDC480`。主识别是斜伸单刃，不做杂草头发。
- **尺寸/锚点**：38×48，躯干底宽约23，r=.30；双脚接触中点，石刃全动作不低于脚底。
- **威胁/动作**：S。小呼吸；短腿交替原地走；石刃后拉→向前短刺→前倾过冲→收回，战斗`.45/.10/1.05`。无cast；受击肩后摆；死亡膝折成一块安静石堆，刃留在身侧不掉出足线。扇形单缺口预警与本体分离。
- **复用/优先级**：P0，现moss/ruin-sprite身份可作后续实际图片参考，原资产是否足够需查看后判断，不在本次声称已逐像素审阅。先做它验证新attack相位。
- **Prompt参数**：`a small forward-leaning teardrop stone sprite with two short legs, one leaf-shaped stone knife in its near hand, empty far hand, terracotta grey body, one broad sage leaf cap, one restrained gold face mark; 38x48 gameplay pixels; no lantern, armor or extra foliage`。

### N02 `ranged` 雾灯精灵

- **轮廓/色材**：倒梨形短身，双脚，双手托一个横向三瓣灯口；头部无尖叶。淡蓝灰`#9BB8C7`、乳白灯壳`#E8DFC8`、灯芯浅紫`#C3AECF`。灯口三瓣是唯一亮色，不能变成巨大发光球。
- **尺寸/锚点**：40×46，底宽21，r=.28；双脚中点；灯最低处高于脚底6px。
- **威胁/动作**：S，以专属cast姿取代刺击。灯口闭合呼吸；小步后退；举灯蓄力→灯口打开朝向外推→双手回弹→收灯，`.75/0/2.25`。无额外cast；受击护灯侧摆；死亡抱灯坐倒，灯芯熄小。独立慢球与短箭预警。
- **复用/优先级**：P0，保留mistling配色家族，新增灯具轮廓与发射动作，不能只用N01调色。
- **Prompt参数**：`a squat inverted-pear ruin spirit with two small grounded feet, holding a horizontal three-lobed ceramic lantern with both hands, pale blue-grey body, ivory lantern and restrained lilac core; 40x46 gameplay pixels; no stone knife, leaf hair or halo`。

### N03 `stoneback` 石背甲虫

- **轮廓/色材**：横向低扁六足甲虫，完整一块圆梯形背壳，两颗钝角；无拟人双手。暖象牙`#CDC8AD`壳、灰绿`#879A80`腹，角端浅褐。只分壳/腹/六足三个大组，不画甲片网格。
- **尺寸/锚点**：52×35，壳底投影宽32，r=.42；前后六足接触基线中点。
- **威胁/动作**：S。壳微呼吸；三对足交替；壳转向抬侧→侧向横摆→平放过冲→稳住，`.8/.15/1.55`；六足始终同数量。受击缩足；死亡壳倾侧压低，禁止翻转露写实内脏。160°双齿扇形提示其宽扫。
- **复用/优先级**：P1，新身份不复用精灵躯干；石材像素簇与色阶可共享。
- **Prompt参数**：`a low wide six-legged ruin beetle, one broad trapezoid ivory stone shell, two blunt horn tips, muted sage underside, clear six-leg silhouette with minimal segmentation; 52x35 gameplay pixels; no humanoid arms, weapon or detailed carapace engraving`。

### N04 `reedLancer` 芦枪侍从

- **轮廓/色材**：细高柱状身，两臂两腿，长芦枪横向伸出，顶部两根并排宽叶；不戴人类头盔。浅石`#D6CDB4`、芦绿`#91A57D`、木杆棕`#967D5C`。长直枪线是主要身份。
- **尺寸/锚点**：58×56（含枪），躯干23×45，r=.30；后脚与前脚足线中点，枪尖不越图格。
- **威胁/动作**：S。握枪不晃；窄步原地走；枪平收→直线伸枪→保持枪尖→双肘收回，`.85/.10/1.55`；不画横扫。受击维持握点；死亡跪倒枪朝上倾，避免枪尾低于脚底造成跳动。窄矩形预警。
- **复用/优先级**：P1，精灵家族但新柱状比例和双手枪，不复制N01刃动画。
- **Prompt参数**：`a slender pillar-shaped ruin attendant with two arms and two legs, a long straight reed spear held horizontally in both hands, two broad upright reed leaves, ivory stone body and muted reed green; 58x56 including spear at gameplay scale; no helmet, sword or dense reeds`。

### N05 `sunbud` 日芽投手

- **轮廓/色材**：圆球花苞身、三片厚花瓣、两短根脚，头顶单个浅金种荚，双小叶臂。珊瑚`#D99D79`、奶金`#E6D08D`、深浅两块叶绿。花是完整大瓣，不做向日葵密集籽盘。
- **尺寸/锚点**：42×50，足部23，r=.30；两根脚中点，种荚不离开本体帧飞走。
- **威胁/动作**：S。花瓣轻开合；根脚小步；抬双叶臂→向上投掷手势（种子不入帧）→仰身→恢复，`1.10/0/2.90`。受击合瓣；死亡三瓣合为低矮花苞。三叶落点圈与弧形种子表象独立渲染。
- **复用/优先级**：P1，全新植物小体，不靠精灵头上加花。
- **Prompt参数**：`a round walking flower bud with exactly three broad coral petals, two short root feet and two small leaf arms, one pale gold seed pod at the crown, sage foliage; 42x50 gameplay pixels; no tiny seeds, petal veins, airborne projectile or ground explosion`。

### N06 `frostling` 霜叶精灵

- **轮廓/色材**：窄锥形身，三片宽霜叶呈叉冠，双短足，单长前臂作为发射口；与雾灯的双手灯不同。淡冰青`#9FCBD6`、乳白`#E0EFED`、一块中蓝`#719DAB`。
- **尺寸/锚点**：35×52，足宽21，r=.28；脚底中点，叶冠固定三片不随帧增减。
- **威胁/动作**：S。冠幅微动；小步滑行但脚不腾空；三叶合窄→长臂伸出→回缩→展冠，`.9/0/2.6`；受击整身向后；死亡冠叶闭合落成低锥。窄冰针与双线预警分开，命中减速用短暂脚底冰线，非永久冰环。
- **复用/优先级**：P0，保留frostling身份色，新增三叉冠轮廓，不能只蓝染N01。
- **Prompt参数**：`a narrow cone-bodied frost ruin spirit with exactly three broad icy leaves forming a forked crown, two small grounded feet and one elongated casting forearm, pale icy cyan, milk white and one muted blue block; 35x52 gameplay pixels; no lantern, knife, icicle clutter or aura`。

### N07 `shardCrab` 镜壳蟹

- **轮廓/色材**：四足、两只不等高大钳、平菱壳，甲虫六足圆壳与其明显区分。乳白`#D7E5E1`、雾青`#90B9C1`、钳尖一块靛灰`#71899D`；镜壳只一条宽斜切面，无真实反射。
- **尺寸/锚点**：54×39，躯干投影26，r=.34；四足共足线，钳抬起不触底。
- **威胁/动作**：S扩为attack6帧建议12fps名义.5秒，但必须相位消费。钳交替轻开；四足横步；左钳后收→左钳夹→右钳收→右钳夹→双钳展开→回位，对应t=.60/.85两段，不按均匀fps扣伤。受击缩钳；死亡四足收在壳下。两段斜齿扇形预警。
- **复用/优先级**：P1，新四足双钳骨架；六足甲虫素材不能直接调色。
- **Prompt参数**：`a squat four-legged ruin crab with two oversized unequal-height pincers and one flat diamond shell, milk white and mist teal with muted indigo pincer tips, one broad diagonal shell facet; 54x39 gameplay pixels; exactly four legs and two claws, no beetle horns or reflective scenery`。

### N08 `rimeMoth` 霜纱蛾

- **轮廓/色材**：两片宽扇翅、细短腹、两根粗短触角与两根落地支足；低空视觉，不加多层透明翅纹。淡紫灰`#B9B6D0`、浅青`#B7DADD`、腹部深灰。
- **尺寸/锚点**：54×41，支足点约20宽，r=.26；支足始终贴同一底线，不用当前底边锚点抹掉整体升降。
- **威胁/动作**：S。慢开合半翅；原地支足步与低幅扇翅；双翅合成V→展开两翅发射→缓收→回位，`.95/0/3.05`。三弹不画在翅中。受击斜翅；死亡翅合成静止一片，不飞散。扇形三箭预警。
- **复用/优先级**：P1，独立翼轮廓；不支持真飞行、跨墙或跳跃。
- **Prompt参数**：`a low-hovering stylized frost moth with exactly two broad fan wings, short body, two blunt antennae and two tiny grounded support feet, muted lilac-grey and pale cyan broad blocks, no wing veins; 54x41 gameplay pixels; fixed ground baseline, no airborne dust, extra wings or projectiles`。

### N09 `chimeSentry` 铃冠哨兵

- **轮廓/色材**：窄高两足石鸟，头顶一枚倒U铃冠，胸前一根长直管嘴；没有手持弓避免像玩家。石蓝灰`#8BA6B5`、象牙`#D9DFD3`、铃冠淡金`#D9C794`。
- **尺寸/锚点**：39×62，双足24宽，r=.30；鸟趾宽块，不画细爪尖。
- **威胁/动作**：S。铃冠不摇屏；长足慢步；管嘴压低直瞄→头前推→颈回弹→竖起，`1.20/0/3.30`；受击缩颈；死亡折腿蹲下铃冠仍一块。长虚线预警先于快箭，箭与本体分离。
- **复用/优先级**：P1，鸟形与铃冠是独立视觉，不把钟侍缩小。
- **Prompt参数**：`a narrow tall two-legged stone bird sentry with one inverted-U bell crown and one long straight tubular beak, muted stone blue-grey, ivory and restrained pale gold crown; 39x62 gameplay pixels; broad simple toes, no hands, bow, feather texture or floating target lines`。

### N10 `snowHare` 霜足跳兽

- **轮廓/色材**：四足短身、两只明显高长厚耳、后腿一块圆楔；短尾为整块无毛。乳白`#E1E8DF`、雾绿`#A5BEB5`、耳内灰蓝`#9AB5C7`。无红眼/獠牙。
- **尺寸/锚点**：38×43，身体约20高，r=.26；四足接触最低线，快跑是贴地小跳错觉，不能生成全身腾空帧。
- **威胁/动作**：S但walk6帧12fps=.5秒需新布局。耳微动；四足快交替；压耳收后腿→短踢→收腿→四足落稳，`.35/.08/.57`；受击横缩；死亡卧倒双耳折贴背。低伤高频短三角预警。
- **复用/优先级**：P1，动物四足与甲壳两种四足不可同轮廓替色。
- **Prompt参数**：`a compact four-footed frost hare with two tall thick ears, rounded wedge hind legs and one simple short tail, milk white stone-like fur masses with mist sage and muted blue ear insets; 38x43 gameplay pixels; feet keep the ground baseline, no individual fur hairs, fangs or real jump arc`。

## 5精英独立Brief

### E01 `warden` 古树守卫

- **轮廓/色材**：宽平叶冠、两只长方重拳、短足石木躯干，头身不做树人写实脸。灰绿石`#A8B19D`、暖木`#9D8865`、三大块苔绿；胸口保留小金纹。
- **尺寸/锚点**：76×83，主体落地投影47，r=.62；两拳不垂到脚以下，足线中心。精英血条高于叶冠8px。
- **威胁/动作**：E。呼吸很小；重步；双臂后抬→单重锤→压低→稳拳，`.85/.15/2`。`rootPlates`：两掌压地、左掌/右掌/双掌三个采样姿势、收掌；按0/.35/.70采样，不能把三圈画进地面帧。受击胸后仰；死亡跪地收拳，叶冠不散碎。
- **优先/复用**：P0精英代表。现grovewarden可保留身份并修关键姿势，需实际查看后才决定能否沿用素材；B01完全另做。
- **Prompt参数**：`a broad elite grove guardian with a flat crown made of three large sage foliage masses, two rectangular heavy fists, short grounded feet and a stone-wood torso with one small gold chest mark; 76x83 gameplay pixels; no detailed bark, antler forest or glowing root effects`。

### E02 `emberRam` 苔角冲阵者

- **轮廓/色材**：四足低头楔形石羊，单整块横向U角、背部两大苔片，前肩高于后腰。浅赭石`#C6AD8C`、叶绿`#8FA681`、角端奶白。
- **尺寸/锚点**：70×58，肩体37，r=.48；四蹄底线中点，角不能在低头时穿过脚线。
- **威胁/动作**：E。刨地仅抬足无扬尘；四足踏步；角后仰→短顶→回收→抬头，`.65/.10/1.75`。`ramLane`：低肩角平直保持1.1秒→奔跑循环最多.5714秒→四蹄刹住1秒→撞墙时额外摇头.8秒。世界冲锋由模拟sweep，动画不加根位移；撞击/尘单独VFX。受击缩颈；死亡侧卧保留U角。
- **优先/复用**：P1，冲锋相位与攻击箭头必须先通；不借N10兔子跳跃骨架。
- **Prompt参数**：`a low-headed four-legged ruin ram with a strong wedge shoulder, one broad U-shaped stone horn pair and two large moss plates on its back, pale ochre stone and sage green; 70x58 gameplay pixels; no curly wool detail, fiery trail, dust or leaping pose`。

### E03 `bellKeeper` 回响钟侍

- **轮廓/色材**：圆拱钟形躯干、两臂各握一侧钟摆杆、两短足，中央单宽开口；铃冠哨兵的细鸟形不能复用。奶金石`#D5C79D`、淡紫灰`#ACA7BD`、深青钟口`#627F87`。
- **尺寸/锚点**：64×74，主体37，r=.48；短足中心，钟裙边不得低于足底。
- **威胁/动作**：E。钟摆仅小幅；稳步；双杆收→同向前点放球→后缩→稳住，`.85/0/3.15`。`bellEcho`：双杆外开→第一次敲钟→等待第二节拍→再敲→闭杆，t1.05/2.00与模拟同步；声波和圈不入本体。受击钟体微倾；死亡缩脚钟壳落地而不破碎。
- **优先/复用**：P1，新钟体；仅材质可与哨兵共享。
- **Prompt参数**：`an elite walking bell attendant with an arch-shaped ceramic bell torso, two short legs, two arms holding paired simple clapper rods and one broad dark teal central opening, pale gold stone and lilac grey; 64x74 gameplay pixels; no tiny bells, bird beak, musical text or sound rings`。

### E04 `mirrorKnight` 镜棱骑士

- **轮廓/色材**：倒三角胸与分叉肩、两短臂各一块短平棱刃、两粗足；不画玩家铠甲骑士。霜白`#D4E4E0`、雾蓝`#8EADB9`、刃芯深靛`#687F99`。
- **尺寸/锚点**：68×84，主体43，r=.56；两粗足中心；双刃不低于脚线。
- **威胁/动作**：E。胸面轻呼吸；粗足慢踏；单刃抬→斜切→回刃→立稳，`.8/.10/2.1`。`splitEdge`：双肩先分出两个方向的准备姿→第一臂斩→留第二臂举起→第二臂斩→合臂，t1.10/1.75；两线VFX形状/方向独立，左右镜像必须保持本次技能±60°与模拟方向一致。受击后仰；死亡双刃叠于胸不散落。
- **优先/复用**：P1，双相位新帧，不能仅让普通枪兵加血。
- **Prompt参数**：`an elite nonhuman mirror guardian with an inverted-triangle chest, forked shoulders, two short arms each bearing one flat prism blade, and two sturdy stone feet, frost ivory, mist blue and muted indigo blade cores; 68x84 gameplay pixels; no human armor ornament, reflected scenery or sword trails`。

### E05 `rimeWeaver` 霜环织者

- **轮廓/色材**：正圆纺轮背架、细矮身、四只粗短编织臂、双脚，外轮只有4根宽辐条。浅青`#B1D4D5`、乳白`#E4EBDD`、淡紫`#AEA8C7`；不做蜘蛛密腿。
- **尺寸/锚点**：66×70，核心落地38，r=.50；双脚中点，圆轮底边高于足线。
- **威胁/动作**：E。圆轮不恒转，四臂小摆；双脚慢步；两前臂收→推出单线弹→回摆→闭合，`.9/0/3.1`。`wovenRing`：四臂张开指外轮→轮保持清楚圆孔→一次合臂释放→收轮，1.2秒前摇；地面空心环不在图片里。受击四臂收；死亡轮倾在身后，最多整体压低不跌到足线外。
- **优先/复用**：P1，圆形负空间必须在实尺寸清楚，Boss镜框不能复用此体仅拉高。
- **Prompt参数**：`an elite frost weaver with one circular spinning-wheel frame behind a compact body, exactly four broad spokes, four short weaving arms and two grounded feet, pale cyan, milk ivory and restrained lilac; 66x70 gameplay pixels; keep the wheel centre visibly open, no spider legs, thread web or ground ring`。

## 2Boss独立Brief

### B01 `courtyardHeart` 庭院司炉者 · 仅余烬庭院

- **轮廓/色材**：宽矮四足古炉座，四方圆角底台承半圆炉腹，两根可展开的铲形炉臂，顶端单完整翻盖；胸腹是淡珊瑚陶瓷面而不是骷髅火口。象牙`#D8CCB3`、鼠尾草`#91A68A`、珊瑚`#D99B79`、少量金`#D9BD76`。无叶冠、无重拳，因此不与古树守卫混淆。
- **尺寸/锚点**：112×110（两臂极值宽134），核心炉底约68×36，r=.90。四脚最低线中心，不用“只核心受伤”解释整个身躯；正面炉腹和底座都在受击体积投影内，外伸炉臂不是独立碰撞体。血条离翻盖最高点10px。
- **待机/移动/普攻**：B。idle4帧4fps1秒，炉盖微呼吸不喷火；walk4帧6fps≈.667秒，四脚依次短挪不抖镜头。普攻4姿：炉臂后举→平铲掌→臂前压→收回，映射1/.15/2.85秒，臂可大但身体不穿足线。
- **技能关键姿势**：`hearthFurrows` 两臂合成三齿指向→双臂压下→回收；`hearthSeeds` 炉盖半开→左臂抬/右臂抬/P2中轴抬→依次抛出手势→闭盖；`hearthVent` 炉盖完全上翻→两臂外撑保持1.4秒→炉腹张开一次→盖回落并长恢复。沟线、种子、圈和火流全独立。P2两秒转换是盖常开30°、腹部珊瑚大块变亮一档，不能靠常驻强光/加满碎叶。破势时双臂垂低、盖抖一次1秒，需新状态映射。
- **受击/死亡**：hurt1帧姿势只做轻倾，不能盖过施法轮廓；death3帧4fps=.75秒，四脚屈→炉盖关闭→熄芯静止；现.9秒淡出可容纳，若美术要求长坍塌另改生命周期，本次不默认。禁止爆炸残骸占安全地面。
- **优先/复用**：P2，先验证B01机制灰盒再生产；共享石陶材质，独立身份与整套B帧，不能放大grovewarden。翻盖局部层与技能专属剪辑需开发。
- **Prompt参数**：`a boss-sized broad squat ancient courtyard kiln on four stout grounded feet, rounded square ivory stone base, coral ceramic furnace belly, exactly two long spade-shaped kiln arms and one complete hinged dome lid, sage accents and restrained gold; 112x110 gameplay pixels, core base about68x36; no tree crown, fists, skull mouth, baked fire, projectiles or background ruins`。

### B02 `mirrorRegent` 霜镜执仪者 · 仅霜镜回廊

- **轮廓/色材**：高窄拱门框身、中央乳白单镜盘、两根下垂长棱臂、分叉石足；镜盘是实心柔光材质，周围开口真实透明，不能直接变成背上圆轮。霜白`#E0ECE7`、蓝灰`#9DBFC9`、深靛`#7586A6`、少量淡紫`#BDB1CD`。
- **尺寸/锚点**：92×128（臂伸极值110），基座约64×34，r=.85；两叉足底中点。细高大轮廓与B01宽矮相反，镜盘/框架是普通可受击本体，不做隐形真身机制。
- **待机/移动/普攻**：B。idle4帧4fps1秒，只框架轻张合；walk4帧6fps≈.667秒，叉足交替，镜盘不自行飘出；普攻长臂向后折→两臂错剪→单臂前伸→垂臂，映射1.1/.15/3.25秒。
- **技能关键姿势**：`regentLanes` 镜盘转窄→一臂指线→另一臂准备第二角→两臂复位，对应1.25/2.15；`regentHalo` 两臂围成内圆→镜盘收窄→外展释放→P2右臂指球→复位，方向球独立；`regentMarks` 叉足稳住→镜盘正向举→第一次压印→维持手势→第二次压印；`regentOath`（P2）双臂合菱→菱孔压窄→单臂平指→分开，1.3秒预警。所有地面环/线/印与本体分离。P2转换两秒镜盘转为明显菱形孔，大块深靛边框加深一档，不新长翅膀/肢体。
- **受击/死亡**：轻微框架倾斜；三帧.75秒：镜盘降至框内→叉足屈→镜框整体压低静止，不能碎出超过底线的小片。若保持画布来表达倾倒就需策略B，本批用压低收束兼容A。
- **优先/复用**：P2，独立Boss身份；与骑士共享冰石切面，但不复制双刃躯干。四技能可复用部分指向姿势，`regentOath`需额外4姿或重用skillC8帧库的空位；40帧不是强制上线数量，生产前画出最终帧映射再更新生成器。
- **Prompt参数**：`a tall narrow frost mirror boss with an open archway stone frame body, one central milk-white mirror disc, exactly two long hanging prism arms and two forked grounded stone feet, frost ivory, blue grey and restrained deep indigo; 92x128 gameplay pixels, base about64x34; no circular wheel backpack, tree foliage, human armor, mirror-reflected landscape or baked beams`。

## 可复制的完整Prompt组合

每条brief已给完整对象参数，无需重新发明身份。复制下方公共块，将`OBJECT`替换为该条英文参数即可成为单体身份图请求；再附动作块生成单动作帧组。这里是制作模板，没有实际调用imagegen，因此尺寸/透明/帧数仍需后续检查，不能写成“已通过”。

```text
Use case: stylized-concept
Asset type: runtime sprite identity reference
Request: ONE Project Ember monster. OBJECT
Bright living ruins in deliberate pixel art, three to five broad colour blocks,
shared limited palette, two or three hard-edged shades and stepped warm-dark outline.
No antialiasing, blur, soft gradients, noisy dithering or faux pixel filter.
Single three-quarter view facing screen-down-right; the game mirrors left/right.
Full neutral ready stance, exact limb count, fixed weapon and clear silhouette.
True transparent alpha outside subject and genuine transparent interior openings.
Keep at least12% clear padding on every side, including weapon and crown extremes.
No ground shadow, scenery, labels, watermark, grid lines, checkerboard,
background halo, attack arcs, projectiles, rings, explosions or damage numbers.
Avoid dense engraving, tiny leaves, veins, scratches, fur strands and realism.
Logical source canvas: [selected texel dimensions from ART_DIRECTION sample].
Shared palette and grid origin: [batch values]. Integer display scale: [sample value].
Measure the returned image and logical grid; a high-resolution output is not
automatically a pixel asset. Judge readability at the specified gameplay size.
```

动作请求用同一身份图，不把17个对象一次挤一张图，不将概念场景当运行时图集：

```text
Use the supplied identity reference for this exact monster.
Create ONLY one ACTION frame group in the same view and facing.
ACTION: [copy the chosen brief's ordered key poses and state duration].
Keep identity, limb count, body scale, face, palette, weapon grip and material
blocks identical. Walk in place; world movement comes from simulation.
Use the fixed cell canvas and common implied foot baseline; no root translation,
turn, camera motion, new accessories, duplicated limbs or resized bounding boxes.
Output one4-frame row for idle/walk/attack, one frame for hurt, or one3-frame row
for death as planned; expanded elite/boss pose groups follow their explicit map.
Preserve all extreme poses inside the transparent canvas. No baked combat VFX.
```

E/B 不是任意 JSON 可以导入：制作前把帧号→姿势→模拟相位固定在 art-source 记录，先实现播放器映射，再批量生成。S 的 4×4、E 的 4×6、B 的 5×8 只描述候选帧布局；图集尺寸由选定逻辑格尺寸乘行列得到，不再沿用旧 1024/4096 等请求。导出若采用整数倍运输画布，须记录真实逻辑 texel 与导出像素映射，禁止借高分辨率增加细节。过大图集可分 clip，但须实际接入 ArtLibrary，不假设 AtlasId 已支持任意新图。

## VFX字典与威胁可读性

以下保留各技能的语义形状和危险时序；像素簇、色阶、爆发层次与装饰叠加预算统一以 [PIXEL_VFX](../PIXEL_VFX.md) 为准。表中秒数为制作目标，不是已实现粒子配置，也不覆盖模拟预警有效期。

| 家族/技能 | 独立预警 | 出手与衰减 | 本体禁画 |
|---|---|---|---|
| N01/03/07/E01近战 | 深赭边+浅暖扇面；N03双齿，N07一/二齿 | .10–.15秒短宽扫，.2秒淡 | 扇面、碎石、震地圈 |
| N02慢球/N06冰针/N09快箭 | 单箭/双线/长虚线，形状区分速度身份 | 球宽芯、针尖芯、箭短尾；无长残影 | 飞行球/针/箭 |
| N04/E04/B01炉沟/B02扫线 | 精确矩形、端封口；枪短直、双斩斜齿、炉沟三齿、镜线菱齿 | 判定时短明线≤.15秒，.25秒退 | 地面线和远端炸点 |
| N05/E01/B01种荚 | 三叶/三盘圈，采样即出现，外沿不扩缩误导实际半径 | 单次低矮爆开≤.25秒 | 草丛/持续火池 |
| E02冲锋 | 宽.96、轴长4、总长4.96圆帽路径框+向前粗箭，障碍处截断 | 脚旁少量尘点<.3秒 | 火焰尾迹和跨墙运动 |
| E03/B02落印 | 两圈差异边线，第二次已明确提示 | 第二次前保留低亮圈，不长时间铺白 | 音符/雪花微粒 |
| E05/B02空镜环 | 内/外双边与空心安全区，边界固定 | 生效窄环.15秒后快速退 | 填满内安全圈的亮盘 |
| B02契印true | 白色细芯+深靛双边+菱形合口，配技能说明标真实 | 无全屏闪，.15秒核心 | 伤害数字/镜面环境反射 |

所有预警按实际CollisionWorld形状含受击圆扩张规则验收，显示区域本体形状与F3目标圆共同解释擦边命中；不能把“看见线没碰脚底点”当成无伤保证。重要圈内填色低不透明度，边界连续且在浅石、冷霜、深阴影均可见；不靠仅红/绿区分。多人预警人数不放大，调度上限见战斗稿。声音可加节拍，但尚无音效管线，视觉必须独立可解。

## 制作次序与实尺寸验收

P0依次N01→N02→N06→E01：先一只完整idle/walk/attack/hurt/death闭环，再处理远程器具与精英长技能。P1其余小怪/精英，每个有独立身份与姿势，允许共享材质色阶、S布局和VFX原语，不共享17个只有颜色变化的轮廓。P2先Boss灰盒机制和导航，再身份图、技能姿势库、P2转换。

后续每只都必须检查：

1. 在表中实尺寸画面与50%缩略下，灰度看出类别与器具；无需放大看叶脉辨认。17剪影并排不得出现仅换色，至少同时有水滴/灯梨/低甲虫/枪柱/花球/叉冠/双钳/双翼/长鸟/长耳/平冠双拳/U角石羊/钟拱/倒三角双刃/圆轮/宽炉/高镜框。
2. 浅石与深青背景测真alpha、透明内孔、边缘无白边/棋盘；左右镜像不改变肢体与握持，不将第二攻击方向误镜成同侧。
3. 按实际前摇/命中/恢复录制：长预警保持准备姿，出手姿不比逻辑晚一整帧组；N07两拍、E02冲锋、E03第二钟、E04错角、E05内圈、Boss阶段均与模拟对齐。没有动画事件伤害。
4. 足线逐帧叠看：背壳/长枪/低钳/死亡不能改变贴地最低点；走路原地，冲锋世界坐标只由模拟变。身体尺度一致，允许姿势宽高变化，不做逐帧bbox缩放。
5. Creator导入后真实生成.meta；inspect-art生成来源/manifest同步，frame索引不越界，动画超出.45窗口先修接口。运行pnpm check、真实Web Desktop构建及test:art，F3对照体型与导航，普通商店通关和F2密集组合分别记录。

本次完成的是上述设计规格。未产生源图，未实际检查新怪alpha、导入、真实帧播放、密集画面或浏览器通关；这些不能以文档数量校验替代。
