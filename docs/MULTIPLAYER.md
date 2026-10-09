# 好友房基础功能

通用多人房在 `main` 开发，平台接入遵循根目录 `AGENTS.md`。本版本不依赖 Toy SDK。

## 本地运行

```sh
npm install
npm run build
npm run start:multiplayer
```

打开 `http://localhost:8082/race.html`，点击好友房，输入昵称创建房间。其他玩家输入房间码或打开邀请链接加入。局域网测试使用电脑的局域网 IP 替换 localhost，各设备均访问 8082 端口。

房间支持 2–4 名真实玩家，人数由服务端限制。房主选择赛道，所有玩家准备后开始三圈比赛；支持漂移、迷你加速和氮气。当前版本不加入 AI、车间碰撞、EMP 或赛道道具。多人赛结果不会写入单人排行榜。

服务器运行共享驾驶模拟，每秒 60 次更新、20 次状态广播。客户端预测自己的驾驶并按服务端确认纠正，其他车辆平滑显示。临时断线保留位置 20 秒并尝试重连；刷新页面不保留重连身份。房主离线后转交房主权限。首位完赛后等待 20 秒结算，整场最长 10 分钟；主动退赛标记 DNF。

## 公网部署

前端可静态部署到 Vercel。房间服务使用持续运行的 Node 进程，入口是 `server/multiplayer.js`，默认端口 8082，可通过 `PORT` 配置。服务提供 `/ws` WebSocket 和 `/health` 健康检查，也可同时托管 dist 文件。

公网 WebSocket 必须通过 HTTPS 反向代理提供 WSS。构建前端时指定服务地址：

```sh
MULTIPLAYER_WS_URL=wss://rooms.example.com/ws npm run build
```

服务端可用 `MULTIPLAYER_ALLOWED_ORIGINS` 设置允许的网页来源，多个来源以逗号分隔。公网静态站未配置地址时，会提示房间服务尚未配置。

当前房间状态保存在单个 Node 进程内，重启会丢失房间。不能将此入口直接当作 Vercel Function 或多副本服务部署；后续使用 Vercel WebSocket Functions 或多实例时，需要实现房间归属、共享状态和跨实例通信。本次开发未部署公网房间服务。

Toy 身份和邀请分享只在 `codex/toy-*` 分支接入，沿用上述通用房间协议。

## 验证

`npm test` 包含真实四 WebSocket 客户端同步、人数限制、准备与房主权限、断线恢复、输入验证、客户端预测、四人三圈完赛和一致排名测试。
