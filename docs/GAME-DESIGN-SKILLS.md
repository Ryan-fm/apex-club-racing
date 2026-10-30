# 游戏设计技能整理

核对与拉取日期：2026-10-30。项目使用原生 Three.js，优先选择引擎无关设计方法及原生 Three.js 实现指导，不迁移引擎。

## 本次从 GitHub 拉取

来源仓库：[gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills)，核对版本 `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9`。通过 Codex skill-installer 官方安装脚本下载技能目录及参考资料，安装到本机 `~/.codex/skills/`，后续对话可使用。

| 技能 | 来源 | 本项目用途 | 本次落地 |
| --- | --- | --- | --- |
| level-design | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/level-design/SKILL.md) | 从驾驶尺度反推路宽、转弯、坡度；安排紧张与喘息节奏 | 起步直道、庄园长弯、墓园 S 弯、森林回头弯、月光返程；测试闭环和路线间距 |
| game-feel | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/game-feel/SKILL.md) | 让转弯、漂移与加速的视觉反馈保持清晰，避免装饰遮挡驾驶信息 | 保留漂移/小喷/氮气反馈，使用暖色赛道导引和独立近道提示；尊重减少动态设置 |
| performance-optimization | [SKILL.md](https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/performance-optimization/SKILL.md) | 先测量、再批量渲染和减少无效工作 | 共享几何与材质、实例化重复道具；新地图跳过旧海湾布景；记录实际渲染数据 |

## 项目已有的 Three.js 配套技能

来源：[majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills)。本机已安装，本次读取并按需使用，无需重复覆盖。

| 技能 | 负责内容 |
| --- | --- |
| threejs-game-director | 协调设计、实现、资源和验证 |
| threejs-gameplay-systems | 赛道节奏、核心循环、驾驶与碰撞约束 |
| threejs-aaa-graphics-builder | 场景造型、材质、光照与批量渲染 |
| threejs-game-ui-designer | 入口、大厅、HUD、横屏和触控可读性 |
| threejs-debug-profiler | 固定场景测量，定位 CPU/GPU 和资源问题 |
| threejs-qa-release | 构建、真实输入、移动端及发布产物验证 |

## 使用边界

技能是设计和实现参考，项目 AGENTS.md 及用户要求优先。保留 main 与 Toy 平台分支隔离、四人服务端上限与既有排行榜语义；本次不安装无关引擎、不引入运行时依赖，也不执行来源仓库中的发布脚本。具体设计及验证记录见 `docs/HALLOWEEN.md` 与 `artifacts/final-evidence.md`。
