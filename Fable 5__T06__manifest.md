# T06 交付清单（Manifest）

- **来源模型**：Fable 5
- **测试题目**：T06｜Coding：风暴钟塔
- **完成日期**：2026-07-21
- **任务执行时长**：约 22 分钟（02:21 ~ 02:43，UTC+8，含编码、测试、构建、实机截图）
- **Token 用量**：无法从会话内精确读取；按本次产出估算约 6 万～9 万 tokens（输入+输出，其中源代码与测试约 2,400 行）。

## 文件清单

| 路径 | 说明 |
| --- | --- |
| `README.md` | 项目说明（含来源模型与题目标注、运行方式、玩法、结构） |
| `package.json` / `package-lock.json` | 依赖与脚本（vite / typescript / vitest，均为 devDependencies） |
| `tsconfig.json` / `vite.config.ts` | TypeScript 严格模式与 Vite 配置 |
| `index.html` / `src/style.css` | 页面骨架与缩放居中样式 |
| `src/main.ts` | 入口：固定 120Hz 步长主循环、DPR 与窗口缩放适配 |
| `src/engine/physics.ts` | 纯物理层：蓄力、跳跃速度、AABB 分轴碰撞求解 |
| `src/game/level.ts` | 关卡数据：5 区域、5 类平台、风区、10 收集物、3 检查点、终点 |
| `src/game/session.ts` | 一局状态：检查点/重生点/坠落/收集/高度统计 |
| `src/game/storage.ts` | 最佳成绩 localStorage 持久化（可注入存储，容错损坏数据） |
| `src/game/game.ts` | 主逻辑状态机：玩家、移动/碎裂/弹簧/单向平台、横风、冰面、摄像机 |
| `src/game/render.ts` | 渲染：3 层视差风暴背景、雨、闪电、角色「灯芯」、HUD、界面 |
| `src/game/input.ts` / `src/game/audio.ts` / `src/game/particles.ts` | 输入轮询 / WebAudio 程序化音效 / 粒子系统 |
| `tests/charge.test.ts` | 蓄力与跳跃速度测试（11 例） |
| `tests/collision.test.ts` | 碰撞求解测试（9 例） |
| `tests/checkpoint.test.ts` | 检查点/收集/高度测试（9 例） |
| `tests/storage.test.ts` | 成绩保存测试（7 例） |
| `dist/` | `npm run build` 产物（index.html + JS 36.0 kB + CSS） |
| `Fable 5__T06__gameplay.png` | 实机游玩截图（结冰钟廊区域，蓄力中，HUD/风向/收集可见） |
| `Fable 5__T06__result.png` | 实机结算界面截图（用时/坠落/高度/齿轮 + 新纪录提示） |
| `Fable 5__T06__build-and-test.log` | 真实 `npm test` 与 `npm run build` 输出日志 |
| `Fable 5__T06__manifest.md` | 本清单 |

## 运行结果

- `npm test`：**4 个测试文件、36 个用例全部通过**（vitest 2.1.9）。
- `npm run build`：**通过**（tsc 严格模式类型检查 + vite 5.4.21 构建，产物 gzip 后约 13 kB）。
- 实机验证（vite preview + 浏览器自动化）：标题页、HUD、蓄力条、跳跃（模拟按住空格 0.6s 后松开，起跳速度 vy≈-541、vx≈273，随后正常落地）、检查点激活、收集、结算界面与 localStorage 最佳成绩写入均正常。
- 要求覆盖：5 区域 / 5 类平台（普通、移动、碎裂、弹簧、单向）/ 横风 + 结冰两种机制 / 10 收集物 / 3 检查点（保留坠落惩罚）/ 结算四项统计 / localStorage 最佳成绩 / 掉出世界自动回检查点、碎裂平台自动复原。

## 已知问题

1. 截图由浏览器自动化生成，其中的统计数值（用时/坠落/齿轮数）为验证流程所设的演示值，非完整人工通关成绩。
2. 关卡难度未经过大量真人试玩调参，高区（风暴外壁、钟顶）在强阵风下可能偏难；数值集中在 `physics.ts` 的 `PHYS` 与 `level.ts` 中，便于调整。
3. 音效为 WebAudio 程序化合成，受浏览器自动播放策略限制，需首次按键后才会初始化声音（已按规范处理）。
4. Token 用量为估算值，会话环境未提供精确计量接口。
