# Toy 万圣节更新

日期：2026-10-30。平台分支：`codex/toy-halloween`。通用代码基于 `main` 的 `2bb6f8f`，从既有 `codex/toy-eleven-city` 接入分支合入；未将 Toy SDK 反向加入 `main`。

## 本次包体

- 万圣节首页活动入口、真实路线互动导览、幽光南瓜谷第六赛道和大厅主题。
- 开赛渲染预热、AI 静态部件合批、手机按键布局与挑战提示优化。
- 保留 Toy 身份、云存档、旧五榜读取、有效标准三圈自动提交。万圣节赛道使用本机个人最佳与幽灵，不调用或混写五个已用分榜。排行榜页面对南瓜谷显示本地成绩说明，禁用无对应分榜的读取操作。
- 云存档驾驶时长仅在内存累计，在完赛、暂停、返回、页面隐藏或手动同步时批量保存；相同保存请求合并，失败保留收据，不自动立即重试。
- 沿用现有作品 ID `35519224606720`、slug `apex-club-racing`、标题、封面、图标、分类和可见性。

## 发布前检查

- `npm test`：170 项，168 通过、2 个可选分布式检查跳过、0 失败。新增验证南瓜谷不触发 SDK 或旧榜、长时间驾驶不访问云存档以及关键节点完整批量保存。
- `npm run build`：`ace5fa9bb41c`。
- `toy_doctor.py dist --slug apex-club-racing --json`：通过，无 ERROR/WARN。
- 包含 120 个文件，新增模块和图片均有对应相对资源；无账号资料、测试输出、`.git`、`node_modules`、环境文件或旧 `toy.yaml`。
- 通用赛道脚本驾驶与四人上限测试通过；没有向真实排行榜发送测试成绩。

Toy 初次容器预览已验证桌面首页、三条赛道切换、开赛、暂停及返回。平台当前 SDK 对预览页显式禁止 submitScore/setCloudStorage 等写操作；getRankList/getCloudStorage/getUserProfile 能力可识别。本次不向正式榜提交测试成绩。修正了本地成绩说明在语言切换时的显示状态，最终包再次构建与预检通过；最终容器预览和审核结果由发布记录补充。预览、截图和完整 CLI 响应保存在忽略的 `output/toy-halloween/`，不进入上传包。

## 既有服务状态

发布前，现有 Vercel 好友房服务 `/api/rooms/health` 返回 HTTP 503，响应 `{"ok":false,"configured":true}`。这是独立后端服务状态，不能用单人比赛成功声称联网好友房通过验证。本次包体不修改后端服务配置或来源白名单。


## 最终容器自检

提交前自检预览：https://www.bilibili.com/toy/preview/author_tLeXXGwA/index.html 。容器确认构建号 `ace5fa9bb41c`。

- 桌面 1440×1000：首页主视觉和导览正常，墓园近道标签可切换；海湾→十一城→南瓜谷连续切换后正常开赛，倒计时后比赛计时增加，新增资源无 HTTP 加载失败。
- 手机模拟：390×844 竖屏首页无横向溢出，开赛按钮可见；844×390 横屏大厅开赛按钮高 44px，三项开赛动作可用；实机容器中的比赛计时增长，触控左右方向按下、松开状态正确，触控未越界。
- 南瓜谷排行榜页中英文切换后都保留本地成绩说明，空榜招募提示不出现，周期、刷新、我的排名禁用，不读取或提交旧榜。
- Toy SDK 对 preview 路径禁止成绩与存档写入；预览路径还没有正式 Toy ID，真实榜单读取返回 `toy id not available on host`。这不是改写分榜的理由。发布前直接读取正式站点霓虹港湾旧榜成功，共 34 条；发布后须再次核对正式榜与新构建。
- Toy 手机容器的权限策略拒绝 accelerometer/deviceorientation；屏幕触控正常。桌面没有运行时错误，手机日志中的该传感器策略报错与场景资源加载分开记录；Three.js 原有环境贴图卷积警告不影响本次场景加载。

本次没有连接新身份、写入真实云存档或向正式排行榜提交测试成绩。


## 提交记录

`toy update 35519224606720 <Toy 工作区>/dist --json --yes` 已成功返回 `status: auditing`，随后 `toy mylist --json` 也确认同一作品为审核中。

- 提交后的最新预览：https://www.bilibili.com/toy/preview/author_GOQSKLbT/index.html
- 正式入口：https://www.bilibili.com/toy/apex-club-racing/index.html
- 游戏代码版本：`f066a42`；构建号：`ace5fa9bb41c`。
- 上传后的本地包摘要与已自检包体一致；新预览首页确认同一构建号，主视觉加载正常。

审核中不等于新版已经上线；正式入口的切换结果另行记录。
