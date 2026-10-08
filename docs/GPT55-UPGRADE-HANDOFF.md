# APEX CLUB — GPT‑5.5 实施交接

核对日期：2026-09-15。文档用途：交给 GPT‑5.5 执行整体升级。本文标明“现状”的内容已核对源码；标明“目标／拟新增”的内容尚未实现。本次交接没有修改游戏功能，也没有迁移 WebGPU。

## 0. 可直接交给 GPT‑5.5 的任务指令

> 继续维护 `/Users/mac/Downloads/antigrav_racer` 中的 APEX CLUB。先完整阅读 `docs/GPT55-UPGRADE-HANDOFF.md`，并检查 `docs/GPT55-BASELINE.json`。以当前工作区源文件为实现基线，保留已有玩法、移动端、改装和语言功能。执行“性能测量 → WebGPU 对照体验段 → 操控与视听升级 → 全游戏推广 → 验收发布”的顺序。先交付 TITAN＋古城城门＋连续三弯的可玩体验段，提供与当前版同设备、同画质、同输入的性能对比。不要把研发方案描述成已经实现，也不要把测试通过描述成真机性能达标。核心操控规则与回归清单见本文。按里程碑推进，每次说明修改、证据和未解决项。

### 跨任务／跨设备接手

交付包 `output/apex-gpt55-handoff.zip` 包含运行源码、14个本地vendor文件、测试、构建脚本和本交接文档。解压后的项目目录为 `apex-club/`；若不在原电脑，将上面指令里的工作目录换成该目录。包内不包含Git历史、Vercel账户链接或凭证，需要发布时重新核验目标项目。

已将交付包解压到独立临时目录验证：62项测试通过，构建哈希仍为 `023596e1e060`，模型导出通过；运行不依赖原工作区的隐含文件。ZIP内文件已逐一校验SHA-256。包内README如有旧玩法说明，以本文“核心玩法契约”为准。

## 1. 产品方向与边界

**产品定位：**精致玩具赛车风格的 3D 街机竞速。优先实现“漂移跟手、连喷有层次、主车有质感、手机稳定可玩”。

**本轮核心问题：**用户反馈漂移后卡顿明显；用户期望评估 WebGPU，并同时提高操控、车型／场景质感和游戏完成度。尚未录制可归因的 CPU/GPU 性能轨迹，不能宣称已查明根因。

**第一份可评审交付：**一辆 TITAN、古城城门前后三个连续弯、一段可重复输入的路线。必须能真实驾驶、漂移、小喷和通过城门；与当前 WebGL 路线保留对照入口。整体路线先沿用现有古城地图；新增挑战入口可以复用其中一段，不擅自修改整图圈长和记录语义。

**已有资产应继续使用：**六车选车与改装、两张地图、首页与车库布局、中英文、教学、幽灵车、奖牌、EMP。这里包含已实现功能，不应当作新需求重复创建。

**本轮范围：**本地 1 人＋7 AI，单人排名或 4v4 AI 组队。真人联网、账号、付费商品、开放世界不在本轮实施范围内；如以后做，单独设计服务端与同步方案。

## 2. 已核实的基线

| 项目 | 当前事实 |
|---|---|
| 工作目录 | `/Users/mac/Downloads/antigrav_racer` |
| 架构 | 原生 HTML/CSS/ES modules＋本地 vendor Three.js；无前端框架构建链 |
| Three.js | `REVISION === '179'`；当前 vendor/build 没有 WebGPU bundle |
| 渲染 | 首页／比赛为 WebGLRenderer；独立车库、人物展示各有渲染实例 |
| 正式站 | https://apex-club-racing.vercel.app/ |
| 核对构建 | `023596e1e060`；来自 `npm run build` 的内容哈希 |
| 自动测试 | 本次重新运行：62 项，全部通过 |
| TITAN 导出 | `npm run export:model` 成功，2,544,956 字节，308 个导出 mesh、13 个材质 |
| 导出说明 | GLB 导出器将实例展开且排除了着色器特效；308 不是运行时 draw calls，也不代表 GPU 成本 |
| 功能源码比对 | 44 个源码／构建／测试文件与 `/tmp/apex-language-pr-0915/works/apex-club` 一致 |
| 对应提交 | 语言功能分支 `codex/apex-language-toggle`，提交 `4eab813`，PR #91 |
| 性能证据 | 尚无真机 FPS、CPU/GPU 分项耗时、帧时间分布；之前 390×844 是浏览器布局检查 |

`GPT55-BASELINE.json` 提供源文件 SHA-256、关键函数定位、测试文件目录及运行时依赖指纹。接手时若哈希变化，先阅读差异，以用户的新改动为准。不要根据旧哈希覆盖更新。

### Git 与发布上下文

- 用户指定 PR 仓库：`https://github.com/MartinDelophy/awesome-gpt-6-astra`，作品路径 `works/apex-club/`。
- 本地根仓库 origin 仍是 `Ryan-fm/apex-club-racing`，HEAD 为旧提交 `f8885cc`，有大量历史未提交／未跟踪文件。**根仓库 HEAD 不代表当前已发布游戏。不要 reset/clean 或直接整树提交。**
- 先查询 PR #91 的最新状态。已合并则从最新 upstream main 建立 `codex/` 分支；未合并则合理基于该分支继续，避免丢掉语言功能或制造重复 PR。
- 本次已知隔离工作树在 `/tmp/apex-language-pr-0915`；临时目录可能以后消失，不将它作为唯一源码。
- 用户要求提交名为 **Ryan**；既往 commit 邮箱 `44168807+Ryan-fm@users.noreply.github.com`，GitHub 身份 `Ryan-fm`。发布／提交前核对实际账户，不冒用仓库所有者身份。不要自行合并 PR。
- Vercel 项目 `apex-club-racing`，scope `ryan-1d85`。生产来自 `dist/`；不要转回旧 chatgpt.site 部署，也不要重建同名项目。

## 3. 当前代码地图（核对后的真实入口）

以下行号是本次基线定位，后续修改后以函数名为准。

| 责任 | 入口与关键符号 |
|---|---|
| 页面启动 | `index.html` → `bootstrap.js` → `game.js`；import map 指向本地 Three.js |
| 比赛总循环 | `game.js:616 loop`，状态初始化 `:230` 附近，`reset :287` |
| 操作与车姿混合逻辑 | `game.js:306 updatePlayer`、`:362 updateAI`、`:224 animateCraft` |
| 物理与撞墙 | `driving-model.js`：`stepHandling`、`projectTrack`、`resolveTrackContact`、`progressDelta` |
| 比赛／漂移规则 | `race-rules.js`：`createRace`、`advanceRacer`、`updateDrift`、`standings`、`teamScores` |
| 小喷／飞喷／落地喷 | `stunt-model.js`：`offerDrift`、`stepStunts`、`boostOpportunity`、`fireStunt` |
| 实体按键映射 | `keyboard-controls.js`：`DEFAULT_BINDINGS`、`CANONICAL_ACTIONS`、`createKeyboardState`、`formatKeys`；改键面板 `keyboard-settings.js` |
| 手机与陀螺仪 | `mobile-controls.js`：`isHandheldDevice`、`createMobileControls`、`screenTilt`、`tiltSteering` |
| 漂移粒子／胎痕 | `race-effects.js:createRaceEffects`；运行时调用 `game.js:640` |
| 尾焰与改装 | `kart-customization.js:applyCustomization/animateExhaust`；`garage-config.js` 保存与校验 |
| 模型工厂 | `kart-model.js:makeCraft/configureKart`；TITAN `armored-kart.js:createArmoredKart`；车型参数 `kart-catalog.js` |
| 材质与车轮 | `vehicle-finish.js:vehicleMaterials/sportWheel/createVehicleEnvironment` |
| 地图／碰撞一致性 | `track-layout.js:circuitPoints/roadHalfWidth`；`game.js:setRouteGeometry/trackFrame/activateRoute/selectScene` |
| 古城／城门／道具 | `scene-design.js:createCitadel`、`citadel-gate.js:createGateBuilder`、`pickup-design.js:createPickupFactory` |
| 镜头与后处理 | `game.js:418 updateCamera`、`:44 ensureComposer`、`:754 applyQuality` |
| HUD／语言 | `game.js:437 updateHUD`、`:569 updateRaceHUD`；`localization.js:setupLanguage/tr/setLanguage` |
| 教学／记录／EMP | `race-experience.js` 纯规则；`game.js:updateExperience/updateCombat/updateLesson` |
| 音效 | `race-audio.js:createRaceAudio`；Web Audio 合成，引擎／音乐／提示分别调音量 |
| 首页／车库 | `showroom-design.js`＋`lobby.css`；`garage.html/css/js` 独立车库 |
| 构建／模型导出 | `scripts/build.mjs` 静态拷贝＋版本化；`scripts/export-model.mjs` |

### 当前数据流

```text
键盘／触控／陀螺仪
  → 规范化内部动作
  → updatePlayer / updateAI
  → 驾驶物理 + 漂移规则 + stunt 时间窗口 + 碰撞 + 比赛进度
  → 车辆姿态／动画（目前混在物理子步里）
  → 镜头 + 粒子 + HUD + 声音
  → WebGLRenderer 或 EffectComposer
```

## 4. 核心玩法契约：第一轮性能迁移必须保持

### 4.1 实体按键与内部动作不可混淆

以下是现有 `keyboard-controls.js` 的核心映射，是真实源码语义：

```js
// 玩家实际默认键位
DEFAULT_BINDINGS = {
  accelerate: 'ArrowUp', brake: 'ArrowDown',
  left: 'ArrowLeft', right: 'ArrowRight',
  drift: 'ShiftLeft', mini: 'KeyW', nitro: 'ControlLeft',
  emp: 'KeyQ', pause: 'KeyH', restart: 'KeyR'
};
// 游戏内部沿用的动作编码（不是 UI 显示的按键）
CANONICAL_ACTIONS = {
  accelerate: 'KeyW', brake: 'KeyS', left: 'KeyA', right: 'KeyD',
  drift: 'Space', mini: 'KeyE', nitro: 'ShiftLeft',
  emp: 'KeyQ', pause: 'KeyH', restart: 'KeyR'
};
```

- A/D/S 是有条件后备键；用户改键后须遵循 `resolveKey` 的现有规则。
- 两侧 Shift/Ctrl 归一化；Esc 固定暂停；Command/Alt 系统快捷键不拦截。
- 持续按键与一次性动作分开。氮气、小喷、EMP 不得因多个物理子步重复消费。
- 手机直接映射内部动作，不能再次按实体键解释。电脑窄窗口和触屏笔记本不能因此启用手机陀螺仪。

### 4.2 漂移／小喷现有阈值

所有速度均为内部单位；HUD 换算系数 `DISPLAY_SPEED = .42`，移动距离系数 `DISTANCE_SCALE = .52`，不要把显示 km/h 直接代入物理。

| 机制 | 当前规则 |
|---|---|
| 起漂 | 按住漂移＋非零转向＋速度 >170 |
| 取消 | blocked 或速度 <110；撞墙取消奖励 |
| 蓄力 | 同向 `.62 × dt`、反打／其他 `.38 × dt`；调用处再乘车型 drift 系数 |
| 松开漂移 | charge ≥.32 获得 .8 秒喷射资格，≥.78 获得 1.5 秒资格；松开本身不直接加速 |
| 出弯／脱喷窗口 | `offerDrift` 给 .85 秒可触发时间；cut 依据松开时转向与原漂移方向相反 |
| 飞喷 | 真正离开跳台才可获得；lastRamp>4、ramp归零、速度>160；窗口 .9 秒 |
| 落地喷 | 真实落地后窗口 .65 秒 |
| 飞／落地喷时长 | `fireStunt` 当前默认 .6 秒，每个窗口消费一次 |
| 连喷 | `combo` 上限4，`chainTime` 2秒；计数不等于自动额外增加速度 |
| 氮气 | 储量达到约1/3且未在氮气中，消费1/3，持续2.1秒 |
| 跳台 | `JUMP_RAMPS=[.08,.40,.70]`，参数段长 .007、最高7单位；装饰性起漂跳动不能触发飞喷 |

### 4.3 必须保留的其他行为

- 松开方向保持世界航向；自动油门只加速，不自动循迹。测试用自动驾驶不能导入生产。
- 擦墙保留合理切向速度；正撞可转向脱困，停车按住刹车可倒车。
- 不改变圈数、排名、DNF、队伍计分；3圈，首位完赛后20秒结算规则保持。
- EMP 范围150世界单位、无友伤、5秒冷却；现有提示和AI减速继续工作。
- 切地图复用缓存，不整页刷新；路面、碰撞、跳台、道具、AI、小地图使用同一路线。
- 选车与改装共用模型；新材质仍保留 `bodyPaint`、`craftColor` 等明确角色，不能靠 roughness 猜部件身份。
- 改装只改变外观；每车独立保存。不得清掉用户改键、改装、记录、语言偏好。
- 新用户默认英文；用户切换语言后即时生效并持久化。
- 教学、暂停、切后台、旋转屏幕时清理输入，避免卡键；Reduced motion 继续有效。

## 5. 设计规格

### 5.1 统一美术

- 方向：精致玩具赛车。圆润但有结构的车壳，夸张轮胎，真实可读的悬挂与机械连接。
- 主车细节优先于远处装饰；保留车漆、金属、橡胶、座椅、玻璃的材质分层。
- 海湾：阳光、清晰接触阴影、海面亮点与冷色远景；路面有稳定可读的中间亮度。
- 古城：砖石体块、城楼屋檐、门洞厚度、暖灯笼与冷远山；避免给平面贴一层“膜”假装几何细节。
- 城门体验：日照→遮蔽→日照连续过渡；使用环境反射与预计算光照，慎用全屏高成本反射。
- 本轮先完善现有程序模型；确有必要再转换部分静态装饰为 GLB。记录新增资产许可证与来源。

### 5.2 漂移／镜头／声音

- 分开计算物理航向、视觉车身偏转、前轮反打、车身侧倾、悬挂压缩。视觉运动不得反向驱动物理。
- 相机采用稳定的运动方向参考与可控前视距离；不能重新引入自动道路朝向，也不能为平滑制造明显转向延迟。
- 漂移进入、出弯回正、飞行、落地使用连续过渡；Reduced motion 去除晃动和明显FOV变化。
- 固定反馈链：蓄力→就绪→按键触发→持续→结束。短提示按状态边沿触发，不每帧重建。
- 出弯／脱喷：短促尾焰；飞喷：悬挂伸展与风声；落地喷：压缩、轻尘与推进音。
- 尾焰自定义颜色继续生效；加速类型不能只依赖颜色，应同时用形态、时序与声音区分。
- 原玩法不能暗中被“电影镜头”改变。需要改变数值时，作为独立操控调校提交并单独对比。

### 5.3 页面与手机

- 延续当前夜间车库、左右切车、车漆／涂装／尾焰分栏。新引擎接入时保持选中车辆、相机和改装状态。
- 首页保留明确的地图／模式／开始比赛入口；细节规则留设置。比赛时道路、名次、小喷优先。
- 触控支持转向＋漂移＋喷射同时输入，pointercancel／lostcapture／切后台能够释放。
- 陀螺仪需手机用户主动启用；触控方向优先；校准、拒绝权限、无数据均有可用回退。
- 分别验证 390×844、844×390 和桌面；模拟视口不替代真实手机性能／多指／陀螺仪测试。
- 30秒挑战复用现有记录／幽灵体系，但使用独立挑战ID和存储命名空间，不覆盖三圈比赛纪录。

## 6. 性能诊断：事实与待验证假设

以下是源码可见的工作量，**不是经过计时证明的瓶颈排名**：

1. `race-effects.js` 已有固定池（640粒子、480段胎痕），不是无限创建／无限增长。每帧遍历整个池，死亡粒子也更新位置，所有粒子属性和胎痕位置均设 needsUpdate；胎痕约5秒衰减。发射与轮胎轨迹还产生临时 Vector3/Color/Array。
2. `updateHUD` 每显示帧写DOM；`updateRaceHUD` 的 .1秒节流位于多项漂移／小喷DOM更新之后；隐藏排行榜仍以 innerHTML 重建。
3. 语言模块监听 body 的文本、子节点和部分属性变化；动态HUD反复写入会触发额外处理。中文还有替换与英文源恢复；英文也仍有观察器。新模块已做初始化幂等与1500项翻译缓存上限，不应误报为“重复初始化”或“无限缓存”。
4. 当前 `loop` 将 dt 限制到 .08秒，使用 `ceil(dt/(1/120))` 个可变子步，慢帧最多10次；updatePlayer/updateAI 同时更新模型、矩阵、轮胎／尾焰和部分DOM。**这是有上界的细分，不是真正 accumulator 固定步，也不是无限补帧。**
5. 质量模式使用阴影、EffectComposer、泛光。`applyQuality` 根据 quality 覆盖最初 mobileDevice 的阴影开关，需复核设备策略。
6. 镜头每帧直接 `camera.position.copy(desired)`；帧率正常时的转向突变也可能被用户感知为卡顿，需要与实际慢帧分开诊断。
7. GLB 导出的实例展开数、场景 Mesh 数、GPU draw calls 是不同指标。多个渲染pass、独立canvas和隐形对象分别计量。

### 必需的测量方式

- 建立只在开发／诊断模式启用的记录器：帧间隔、各CPU阶段耗时、p50/p95/p99、>50ms/>100ms帧次数、renderer统计、物理步数、活跃粒子／胎痕、DOM写入次数、渲染后端／分辨率／画质。
- GPU耗时用可用的异步计时能力；不可用时明确标记 unavailable，不能拿CPU提交耗时代替GPU时间。避免同步读回干扰被测帧。
- 长帧／GC用浏览器性能轨迹辅助归因；JS堆／GPU内存只报告平台能观测到的指标，不声称覆盖所有内存。
- 记录同一设备、浏览器、视口、DPR、车型、地图、语言、后台标签数量。每个方案冷启动和预热后分开测，每段至少3次。
- 固定输入路径：直线→持续漂移→释放→小喷→氮气→飞喷／落地→恢复。使用固定AI随机种子或输入回放，诊断控制器只在测试入口运行。
- 至少覆盖 TITAN与轻型车、海湾与古城、中英文、八车同屏、两档画质、兼容后端、连续10次漂移和10分钟游玩。

## 7. 拟定架构：在现有 ES modules 内分层

先提取与验证，避免一次替换整个游戏。建议新增边界如下（文件名可小幅调整）：

```text
runtime/input-frame.js       归一化输入；held 与 one-shot 队列
runtime/race-simulation.js   物理、碰撞、进度、漂移、stunt；不操作DOM或Three对象
runtime/race-presenter.js    插值、车姿、轮胎、悬挂；每显示帧一次
runtime/race-ui.js           缓存DOM引用，值变化才写，按需节流
render/create-renderer.js    后端初始化／能力检测／失效恢复／dispose
render/materials/*.js       TSL材质与迁移期原WebGL材质适配
render/effects/*.js         粒子、胎痕、尾焰、后处理
runtime/performance.js       开发统计与对照导出
```

### 7.1 核心接口草案（设计契约，尚未实现）

下面是类型说明，不要求把项目改为 TypeScript，也不能直接当作可运行代码：

```ts
type InputFrame = {
  steer: number; throttle: boolean; brake: boolean; driftHeld: boolean;
  commands: Array<{ id: number; action: 'mini' | 'nitro' | 'emp' }>;
};
type SimulationEvent = {
  id: number; tick: number;
  kind: 'drift-ready' | 'boost-start' | 'boost-end' | 'collision' | 'land';
  payload: unknown;
};
interface RaceSimulation {
  step(dt: number, input: InputFrame): void;
  // previous/current含足够的车姿信息；只读给渲染层，禁止反馈改写物理。
  getRenderStates(): { previous: unknown; current: unknown };
  drainEvents(): SimulationEvent[];
  reset(options: unknown): void;
}
interface RenderAdapter {
  // backend填写实际检测结果，不能因为创建了WebGPURenderer就标为webgpu。
  backend: 'webgpu' | 'webgl2';
  prepare(world: unknown, variants: unknown[]): Promise<void>;
  resize(width: number, height: number, pixelRatio: number): void;
  render(frame: unknown): void;
  dispose(): void;
}
```

**调度契约：**输入→有限的物理步→生成语义事件→每显示帧一次车姿／特效／镜头→按需HUD→渲染。

- 提取阶段先保持现有子步与数值。真正固定步与插值在回放测试建立后再引入。
- one-shot 命令有唯一ID，只消费一次；多个子步不能重复发氮气、小喷、EMP。
- 暂停、切后台、恢复时重置时间基准／accumulator／输入，不补算后台经过的整段时间。
- 最大补帧数、剩余时间处理必须显式设计、计量并测试；不能静默丢时间后声称比赛计时／轨迹一致。
- 渲染插值不增加整帧以上不必要的输入延迟。相机预测如采用，只影响表现，不改变碰撞与进度。
- 特效声音订阅语义事件；活跃烟雾每帧动画，提示与音效只响应事件边沿。
- UI建议数字10–20Hz、排行榜按变化或较低频率；就绪／耗尽等关键状态当帧响应。设置值缓存为状态，不在每个子步查DOM。
- 语言对动态HUD使用显式键与参数格式化；静态页面可保留兼容观察器，但不把它放在高频HUD更新链上。保证切回英文不会残留中文或丢用户动态文本。

### 7.2 WebGPU迁移清单

1. 选择并锁定一个经过实测的 Three.js 版本；统一 core／addons／webgpu／tsl。当前r179资源不能与新版本bundle混用。保留可回退基线。
2. 先实现异步初始化与能力检测；测试无adapter、初始化失败、设备丢失和WebGL回退。不得通过无条件强制WebGPU排除旧手机。
3. 以下现有GLSL迁到节点材质／TSL：道路 onBeforeCompile、海水、天空、漂移粒子、胎痕、普通车／TITAN尾焰、软阴影、首页背景。除主比赛外，还要盘点车库、人物展示与截图路径。
4. 替换 EffectComposer/UnrealBloomPass/OutputPass 组合，明确色调映射、色彩空间、透明混合、曝光与抗锯齿，避免重复 tone mapping。
5. 适配 `createVehicleEnvironment`、render target、缩略图生成和像素读回。不能继续假设同步 `readRenderTargetPixels`；缩略图不进入比赛帧循环。构建文件清单加入新文件和完整依赖。
6. 预热实际会出现的材质／特效变体。场景首帧编译与热身后的渲染耗时分别记录。
7. 仅在测量证明划算时将粒子运动迁到compute；640粒子的规模不能预设GPU计算一定更快。持久化buffer，减少CPU→GPU上传。
8. WebGL回退只意味着渲染器提供另一个后端。涉及compute的功能必须单独验证或给出CPU／兼容实现，不能宣称TSL会自动解决所有回退。
9. 批量绘制重复构件、远处AI使用LOD／降低动画频率，主车保持完整材质。阴影与泛光分别预算，避免“WebGPU开启了更多特效反而更慢”。
10. WebGPU与WebGL共存期间用隔离入口／适配层，不在一个场景混入两个Three版本。最终避免长期维护两套玩法。

参考（已阅读过的官方资料，实施时再次核对选定版本）：
- [WebGPURenderer 后端与回退](https://threejs.org/docs/pages/WebGPURenderer.html)
- [官方迁移手册源码](https://github.com/mrdoob/three.js/blob/dev/manual/pages/webgpurenderer.html)：旧 ShaderMaterial/onBeforeCompile/EffectComposer 不可直接搬用，需适配。

## 8. 分阶段工作单与出口标准

| 阶段 | 必做工作 | 出口证据 |
|---|---|---|
| A 基线与分层 | 校验manifest；记录原版性能；提取输入／模拟／表现／HUD边界；修复确认的重复工作 | 原版与提取版回放可比、原测试通过、性能数据和差异说明 |
| B WebGPU体验段 | 古城TITAN三弯；新后端＋材质＋阴影／泛光；加载预热；兼容回退 | 可玩入口、真实后端信息、同画质对比、首次与连续漂移轨迹 |
| C 手感与视听 | 轮胎／悬挂／车身表现、相机、连喷反馈、城门光照 | 三弯完整驾驶录制、操控回归、减少镜头运动检查；调参独立记录 |
| D 全量推广 | 六款车／两图／车库／缩略图／人物／手机／中英文；挑战复用记录 | 场景与车型矩阵、存储迁移验证、实际手机检查、资源释放检查 |
| E 发布 | 长时与冷启动测试、加载失败处理、分阶段上线、可回退构建 | 部署ID／构建哈希／PR／性能报告；明确未覆盖设备 |

### 初始验收门槛（目标，非当前达成或跨设备承诺）

- 在明确列出的60Hz目标设备上：目标稳定60FPS，建议以 p95帧间隔≤20ms、p99≤33.3ms为初始门槛；30FPS档对应建议 p95≤36.7ms、p99≤50ms。测量协议与刷新率一同列出。
- 不允许每次漂移结束都复现 >100ms 帧；>50ms慢帧次数需相对基线明确下降。若硬件未达标，报告实际值与调整项。
- 同一对比保持分辨率／DPR／画质／车型与路线，不用降画质后的成绩冒充同画质引擎收益。自动画质模式单独测试。
- 10次漂移后性能恢复到该路线的稳定范围；10分钟内受控资源数量不持续上升。GC造成的锯齿不应误判为泄漏。
- 62项原测试保留。修改规则则更新合理的契约测试并说明原因，不删失败断言来过关。
- 新增真实价值测试：命令只消费一次、暂停恢复不补帧、固定步回放、世界航向保持、撞墙恢复、切图一致性、改装／语言持久化、后端失败回退。
- WebGL/WebGPU、中文/英文各测实际比赛；在目标手机测试多指操作与传感器，模拟视口不能签字代替。
- 视觉验收同角度对照：TITAN正／后四分之三、车轮材质、尾焰、海湾曝光、城门内外过渡、比赛道路可见性。

## 9. 本地验证与发布操作

在工作区根运行：

```sh
npm test
npm run build
npm run export:model
python3 -m http.server 8081
```

访问 `/dist/` 和 `/dist/garage.html`，不是只检查未构建源目录。8081如被已有服务占用，复用或使用空闲端口，不随意结束用户进程。

- build 是文件白名单拷贝并重写本地js/css的版本查询串。新增模块、资源格式或异步加载路径后必须更新构建逻辑，验证dist里没有缺失或旧文件。
- 不只修改dist，源文件才是交付。
- GLB导出只覆盖模型结构与格式；不验证运行时特效或实时帧率。
- 发布前检查Vercel项目链接与账户，在用户已经授权的项目范围执行。现有发布命令：

```sh
npx --yes vercel@59.13.1 deploy --prod --yes --scope ryan-1d85 --cwd dist
```

- 保留上一可用部署；先验可玩预览与兼容路径，再推广主域名。切换后确认主域名实际版本，不只看CLI成功。
- Git按阶段提交，描述应包含具体行为变化、验证、局限。PR目标必须是用户指定的awesome仓库，不因为根origin不同就提交错库。

## 10. 已知文档冲突与接手提醒

`EXPERIENCE.md` 是累积的历史记录，前几节存在旧结论：

- “Changing environment reloads the scene”已被后面的无刷新地图缓存机制取代。
- “first default follows browser language”已被默认英文取代。
- 开头“E / MINI”、空格漂移的叙述是旧实体键位。当前真实键位见本文4.1；内部编码仍沿用旧符号。
- 43／49／52／58项测试是历史快照，本次运行是62项。
- 旧“组队始终保持车队颜色”须结合最新自定义车漆优先级理解：自定义车身颜色会覆盖部分车体；队伍身份需通过饰件／标记保持可辨。

没有实测的事项：漂移卡顿的CPU/GPU归因、WebGPU实际收益、完整真机兼容矩阵、人类第一次过弯成功率、最终混音质量。本交接确认的是源码、功能契约与实施设计，不对这些尚未完成的项目作成功声明。
