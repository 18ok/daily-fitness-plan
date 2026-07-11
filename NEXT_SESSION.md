# 健身 APP 开发接续说明

更新时间：2026-07-11

## 正式入口

- 用户试用域名：https://app.yuchengmini.cn/
- 不要把 GitHub Pages 或 Vercel 技术地址当作对外入口。
- 已验证正式域名首页、JS、CSS 均返回 200，并包含新版反馈功能与 `pinch-zoom` 修复。

## 已完成

- PR #2 已合并到 `main`，合并提交：`c93b25b`。
- 手机双指放大后可以缩小。
- 首次进入需要明确选择时间、状态、地点，再显示计划。
- 返回用户可以快速确认当天计划，并可原位调整。
- 保留训练、饮食、最低线、不要做四类插画及轻微动效。
- 加入匿名试用反馈、本地离线队列及 Supabase 插入边界。
- 第一轮朋友试用清单：`docs/pilot/2026-07-11-friends-round-1.md`。
- 最终维护验证已通过：应用逻辑、周期逻辑、浏览器冒烟、维护差异检查和生产构建。

## 当前停点

Supabase 项目：`energy-plan-app`

项目编号：`iijjfanfqebxfxqadjmi`

SQL 文件：`supabase/experience_feedback.sql`

第一次粘贴 SQL 时，PowerShell 默认编码把中文反馈值变成乱码，Supabase 在第 15 行报语法错误，因此建表没有成功。之后已使用 UTF-8 重新复制并确认三个值为：`适合`、`太难`、`不符合状态`，但关机前尚未确认第二次运行结果。

## 下次第一步

1. 用 Edge 登录 Supabase。
2. 打开 `energy-plan-app` 的 SQL Editor。
3. 用 UTF-8 读取并执行 `supabase/experience_feedback.sql`。
4. 运行权限检查，确认 RLS 开启，`anon` 和 `authenticated` 只有 `INSERT`，没有 `SELECT`、`UPDATE`、`DELETE`。
5. 在 https://app.yuchengmini.cn/ 提交一次真实测试反馈，确认数据库收到一行且页面显示提交成功。

PowerShell 复制 SQL 时必须显式指定 UTF-8：

```powershell
Get-Content -LiteralPath 'supabase\experience_feedback.sql' -Encoding UTF8 -Raw | Set-Clipboard
```

## 后续顺序

1. 先让 3～5 位女性健身新手完成第一轮手机试用。
2. 按出现人数统计卡点，每轮只修复前 2～3 个高频问题。
3. 只有达到试用清单中的门槛，才进入方案 2：移动端底部调整层与即时预览。
4. 动作演示、器械科普和饮食科普等待简笔动画素材能力就绪后再接入，不放空入口。
5. 网页流程验证后，再建立 Taro + React 的微信小程序同级项目，复用计划规则、数据结构和素材，不重写现有网页。

## 本地注意事项

- `.env.local` 包含当前 Supabase 网页配置，已随本地开发副本保留，不要公开提交。
- `.superpowers/` 是本地工作记录，保留但不提交。
- 新位置的 `node_modules` 和 `dist` 被排除；首次继续开发时运行 `npm install`，再运行 `npm run verify:maintenance`。
