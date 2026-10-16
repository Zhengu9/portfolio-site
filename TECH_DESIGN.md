# 全栈个人作品集技术设计

## 1. 架构概览

```text
浏览器
  ├── React + TypeScript + Vite + Tailwind CSS（Cloudflare Pages 静态资源）
  ├── /api/*    -> Cloudflare Pages Functions -> D1
  └── /media/*  -> Cloudflare Pages Functions -> R2

Pages Functions bindings:
  DB: D1
  MEDIA: R2
  ADMIN_USERNAME / ADMIN_PASSWORD_HASH: Cloudflare secrets
```

- 同源部署，前后端通过 `/api` 和 `/media` 通信，不在浏览器暴露 Cloudflare API Token。
- 前端为 Vite 构建的 SPA；Pages Functions 负责 JSON API、会话认证和媒体读取。
- D1 是文本内容和会话的唯一持久化数据源；R2 保存二进制文件。不得使用 localStorage/mock 数据作为正式持久化实现。
- 用户资料、技能、经历、项目、文章均来自数据库/API；组件仅负责渲染和交互。
- MVP 不引入 SSR、独立服务器、Durable Objects 或第三方内容 CMS。
- 本地通过 Wrangler Pages Dev 运行 Pages Functions，并使用 Cloudflare 官方 D1/R2 本地模拟绑定；D1 migration 和媒体对象持久化到被忽略的 `.wrangler/state/`，与旧本地测试数据目录隔离。生产仍使用 Cloudflare D1/R2。

## 2. 技术栈

| 层 | 选型 | 职责 |
| --- | --- | --- |
| Web | React + TypeScript | 页面、表单、交互组件 |
| 构建 | Vite | 本地开发和静态资源构建 |
| 样式 | Tailwind CSS | 设计 token、响应式与状态样式 |
| 路由 | React Router | 公开和 `/admin` 路由 |
| 表单/校验 | React Hook Form + Zod | 输入状态及客户端 schema 校验；服务端仍须独立验证 |
| Markdown | `react-markdown` + `remark-gfm` + `rehype-sanitize` | 安全展示 Markdown，不启用原始 HTML |
| API | Cloudflare Pages Functions（TypeScript） | 同源 API、鉴权、校验和媒体代理 |
| 数据 | Cloudflare D1（SQLite） | 结构化资料、内容、会话和登录限流记录 |
| 文件 | Cloudflare R2 | 头像、项目封面、简历 PDF |
| 测试 | Vitest、Cloudflare Workers 测试工具、Playwright | 单元、函数/API 集成和浏览器流程 |

依赖版本在初始化项目时选择相互兼容的稳定版本并锁定 lockfile；升级依赖时先查对应官方文档并运行全部测试。

## 3. 路由与 API 契约

统一 JSON 错误格式：

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "请检查输入内容",
    "fields": { "title": "标题不能为空" }
  }
}
```

成功读取返回 `{ "data": ... }`；列表允许返回 `{ "data": [], "meta": { "cursor": null } }`。所有写请求校验 `Content-Type`、来源、权限和 body 大小。未登录返回 `401`，无权限返回 `403`，资源不存在返回 `404`，输入非法返回 `400`/`422`，文件过大返回 `413`，限流返回 `429`。

### 3.1 公开 API

| Method | Path | 用途 |
| --- | --- | --- |
| `GET` | `/api/public/site` | 首页所需的公开资料、技能、经历、精选项目和最新文章聚合 |
| `GET` | `/api/public/profile` | 已批准公开的个人资料 |
| `GET` | `/api/public/skills` | 可见技能，按 category/order 排序 |
| `GET` | `/api/public/experiences` | 已公开教育、工作和学习经历 |
| `GET` | `/api/public/projects?cursor=&limit=` | 已发布项目分页 |
| `GET` | `/api/public/projects/:slug` | 已发布项目详情 |
| `GET` | `/api/public/posts?cursor=&limit=&tag=` | 已发布文章分页 |
| `GET` | `/api/public/posts/:slug` | 已发布文章详情 |
| `GET` | `/api/public/resume` | 返回当前简历 PDF 的媒体 URL；未设置时返回 `404` |

公开 API 只返回 `is_public = 1` 或 `status = 'published'` 的内容，不包含管理字段、草稿、会话和登录限流记录。

### 3.2 认证与管理 API

| Method | Path | 用途 |
| --- | --- | --- |
| `POST` | `/api/admin/auth/login` | 校验账号密码，签发会话 Cookie |
| `GET` | `/api/admin/auth/session` | 返回当前登录状态和到期时间，不返回 Token |
| `POST` | `/api/admin/auth/logout` | 删除当前 D1 会话并清除 Cookie |
| `GET` | `/api/admin/dashboard` | 统计内容数量及最近更新时间 |
| `GET/PUT` | `/api/admin/profile` | 读取/更新单例资料及公开字段 |
| `GET/POST` | `/api/admin/skills` | 列表/新增技能 |
| `PUT/DELETE` | `/api/admin/skills/:id` | 更新/删除技能 |
| `GET/POST` | `/api/admin/experiences` | 列表/新增经历 |
| `PUT/DELETE` | `/api/admin/experiences/:id` | 更新/删除经历 |
| `GET/POST` | `/api/admin/projects` | 列表/新增项目 |
| `GET/PUT/DELETE` | `/api/admin/projects/:id` | 详情/更新/删除项目 |
| `GET/POST` | `/api/admin/posts` | 列表（含草稿）/新建文章 |
| `GET/PUT/DELETE` | `/api/admin/posts/:id` | 详情/更新/删除文章 |
| `POST` | `/api/admin/uploads` | 上传头像、项目图片或简历 PDF |
| `GET/POST/PUT/DELETE` | `/api/admin/skills[/:id]` | 技能管理 |
| `GET/POST/PUT/DELETE` | `/api/admin/projects[/:id]` | 项目管理 |
| `GET/POST/PUT/DELETE` | `/api/admin/posts[/:id]` | 博客管理 |

所有 `/api/admin/*`（除登录外）验证有效会话。删除接口应设计为幂等；前端二次确认不能替代服务端授权和资源存在性检查。

### 3.3 媒体路由

- `GET /media/:key` 由 Pages Function 从 R2 读取流并返回安全响应头；仅公开内容引用的 key 可公开读取。
- 禁止把用户输入直接当作 bucket key 路径拼接；校验 key 结构并从数据库关联信息判断资源用途/公开状态。
- 使用正确 `Content-Type`、`X-Content-Type-Options: nosniff`、安全的 `Content-Disposition`、ETag 和适当缓存策略。
- 简历下载使用 `Content-Disposition: attachment`；头像/封面使用 inline。
- 私有上传不创建可猜测路径；随机 UUID key。R2 bucket 不直接公开写入。

## 4. 数据模型

时间采用 UTC ISO 8601 字符串；主键为随机 UUID。JSON 字段需在 API 边界做 schema 校验。所有排序字段使用明确整数。

### 4.1 表结构

| 表 | 核心字段 | 说明 |
| --- | --- | --- |
| `profile` | `id` 固定为 1、`display_name`、`headline`、`intro`、`location`、`wechat_id`、`wechat_qr_key`、`avatar_key`、`resume_key`、`updated_at` | 单例资料；联系区公开微信号及可选二维码 |
| `skills` | `id`、`category`、`name`、`description`、`sort_order`、`is_visible`、`created_at`、`updated_at` | 不存或展示熟练度分数 |
| `experiences` | `id`、`type`、`organization`、`role`、`start_date`、`end_date`、`description`、`sort_order`、`is_public`、`created_at`、`updated_at` | `type` 使用受控值；首版只存/展示教育信息，不展示工作/实习经历 |
| `projects` | `id`、`slug`、`title`、`summary`、`body_markdown`、`role`、`tech_json`、`tags_json`、`cover_key`、`repo_url`、`demo_url`、`start_date`、`end_date`、`status`、`sort_order`、`created_at`、`updated_at`、`published_at` | `status` 为 draft/published/archived；slug 唯一 |
| `posts` | `id`、`slug`、`title`、`excerpt`、`body_markdown`、`tags_json`、`cover_key`、`status`、`published_at`、`created_at`、`updated_at` | 草稿不进入公开查询 |
| `admin_sessions` | `id`、`token_hash` 唯一、`created_at`、`expires_at`、`last_seen_at` | 只存 Cookie Token 的 SHA-256 摘要 |
| `login_attempts` | `id`、`ip_hash`、`attempted_at`、`success` | 短期限流；IP 仅作带服务端 secret 的 HMAC 摘要并定期清理 |
| `media_objects` | `key` 主键、`kind`、`content_type`、`size_bytes`、`created_at` | 记录上传资源元数据，支持引用检查和孤儿文件清理 |

### 4.2 迁移策略

- SQL 文件放入 `migrations/`，使用有序编号，如 `0001_initial.sql`、`0002_add_wechat_qr.sql`。
- 迁移只向前追加；已应用的 migration 不直接改写。破坏性变更分阶段迁移并提供数据兼容期。
- 本地使用 Wrangler 本地 D1 应用迁移；远端预览和生产按环境分别执行远端迁移。
- 所有查询使用 D1 prepared statements 和绑定参数；slug、状态和排序字段加索引。
- 生产备份/恢复流程和保留周期在上线前核实 Cloudflare 账户能力并记录演练结果。

### 4.3 DDL 约束建议

- `projects.slug`、`posts.slug` 唯一；`profile.id CHECK(id = 1)`。
- `status`、`type` 使用 `CHECK` 约束允许值；布尔值使用 `0/1`。
- 对公开列表常用的 `(status, published_at)`、`(is_visible, sort_order)`、`(is_public, sort_order)` 建索引。
- 外链保存前仅允许 `https:`（GitHub 等明确允许的协议）；不允许 `javascript:`、`data:`。

## 5. 目录结构目标

```text
个人作品集/
├── PRD.md
├── TECH_DESIGN.md
├── AGENTS.md
├── package.json
├── package-lock.json
├── vite.config.ts
├── tailwind.config.ts
├── wrangler.jsonc
├── migrations/
│   ├── 0001_initial.sql
│   └── 0002_*.sql
├── functions/
│   ├── api/public/[[path]].ts
│   ├── api/admin/[[path]].ts
│   └── media/[[path]].ts
├── src/
│   ├── app/
│   ├── routes/
│   │   ├── public/
│   │   └── admin/
│   ├── components/
│   ├── features/
│   │   ├── profile/
│   │   ├── skills/
│   │   ├── experiences/
│   │   ├── projects/
│   │   ├── posts/
│   │   └── uploads/
│   ├── api/                 # 仅封装同源 HTTP API，不保存内容副本
│   ├── schemas/             # 可复用类型/校验定义
│   ├── styles/
│   └── main.tsx
├── tests/
│   ├── unit/
│   ├── functions/
│   └── e2e/
└── public/
```

目录是实现目标，不意味着本阶段要生成网站代码。

## 6. 认证与安全设计

### 6.1 管理员认证

- 单管理员 MVP，不提供公开注册。
- `ADMIN_USERNAME`、`ADMIN_PASSWORD_HASH` 通过 Cloudflare secret 配置，禁止写进仓库、Vite `VITE_*` 变量或客户端构建产物。
- 密码哈希在受信任的本地初始化工具中使用 Web Crypto PBKDF2-HMAC-SHA-256、每账号随机 salt 和足够高的迭代数生成；保存格式包含算法、迭代数、salt 和 hash。登录时重新派生并以恒定时间比较。参数必须根据 Cloudflare Workers CPU/延迟预算实测，不可使用裸 SHA-256。
- 密码不得写日志或存入 D1。生产登录限流采用 D1 窗口计数并结合平台限流；统一错误消息避免泄露账号是否存在。清理旧限流记录。
- 通过 `crypto.getRandomValues` 生成至少 256-bit 不透明会话 Token；Cookie 中仅存原始随机值，D1 只存 SHA-256 摘要。绝不向 JS 暴露 Token。
- Cookie 设置 `HttpOnly; Secure; SameSite=Lax; Path=/api/admin; Max-Age=...`，生产强制 HTTPS；登录成功轮换会话，登出及密码轮换时撤销会话。会话设置有限有效期并可滑动续期，但单次续期不能超过最长会话期限。
- 所有变更请求校验 `Origin` 与本站精确来源；仅接受预期的 JSON 或受限 multipart 请求，拒绝跨站来源。SameSite Cookie 不是唯一 CSRF 防护。
- 管理 API 不返回密码哈希、Token、内部 secret 或登录限流原始 IP。

### 6.2 输入与输出

- 前端和 Pages Function 共用/镜像 Zod schema；服务端始终重新验证所有输入。
- 限制字符串长度、数组项数、JSON 体积、分页上限；仅接受白名单状态、类型和字段。
- D1 使用参数化查询，防止 SQL 注入；不得把 Markdown/表单输入当 HTML 执行。
- Markdown 渲染不启用 raw HTML；净化 URL 协议，外链加 `rel="noopener noreferrer"`。
- 设置 CSP、`X-Content-Type-Options: nosniff`、`Referrer-Policy`、`Permissions-Policy` 和 `frame-ancestors 'none'`；CSP 按实际构建资源验证后收紧。
- 错误响应不泄露 SQL、bucket key、stack trace、secret 或环境变量。

### 6.3 文件上传

- `POST /api/admin/uploads` 仅管理员可用，使用用途枚举 `avatar | project-cover | resume | content-image | wechat-qr`。
- avatar/project-cover/content-image/wechat-qr 接受 PNG、JPEG、WebP，单文件上限 5 MiB；resume 仅接受 PDF，单文件上限 8 MiB。初始边界可调整，但必须统一配置、服务端强制执行并测试。
- 检查请求总长、扩展名、声明 MIME 和文件签名/magic bytes；三者不一致时拒绝。拒绝 SVG、HTML、脚本、压缩包和未知格式。
- 随机生成 key，不使用用户文件名作为存储路径；数据库记录实际内容类型和大小。PDF 校验 `%PDF-` 签名；图片至少检查格式签名，必要时通过受控解码避免畸形文件。
- R2 写入成功后再更新 D1 引用；更新失败时执行补偿删除，定期清理孤儿文件。替换头像/封面/简历后，不立即删除仍被引用的对象。
- 响应不回显可执行原始文件名；安全设置下载文件名，并对 PDF 设置安全响应策略。

## 7. 关键技术行为

- React 首次加载通过 `/api/public/site` 拉取公开内容，项目和文章分页读取；失败时显示可重试错误状态，不以静态假资料冒充成功数据。
- 后台写操作完成后更新视图；以服务器响应为准。刷新/重新访问页面从 D1/R2 重新读取，以此验证持久化。
- API 默认同源，封装超时、JSON 解析和标准错误映射；收到 `401` 清理内存中的会话状态并导航到登录页。
- 不在 localStorage/sessionStorage 持久化认证凭据或服务端内容副本。
- Canvas 粒子动画限制 DPR、粒子数量和帧更新；页面不可见时暂停；减少动态效果时不启动循环。
- 滚动进场用 `IntersectionObserver`，内容在 JS 失败或减少动态效果时仍可见；禁止因动画把主内容初始设为不可见。
- 图片定义 `width/height` 或 `aspect-ratio`，设置合理 `alt`、懒加载和响应式尺寸。

## 8. Cloudflare 配置与部署

### 8.1 Wrangler 配置要点

`wrangler.jsonc` 应声明 Pages 构建输出目录 `dist`、兼容日期、D1 绑定 `DB`（含 database name/id 与 migrations directory）及 R2 绑定 `MEDIA`。仓库提供的 database ID 是需替换的占位符。预览和生产使用不同 D1/R2 资源或明确隔离的环境配置。不得把真实密钥提交到配置文件。

本地开发要求 Node.js `>=22.13.0`。首次运行 `npm run setup:admin` 生成随机本地管理员密码、PBKDF2 哈希和会话 secret；生成的 `.dev.vars` 被 `.gitignore` 忽略，供 Wrangler Pages Dev 和 E2E 使用。`npm run dev` 会先构建前端、执行 `npm run db:migrate:local`，再启动 Wrangler Pages Dev；D1 与 R2 状态保存在 `.wrangler/state/`，不触碰旧版 `.local/` 测试数据。重复启动只应用尚未执行的 migration。

Pages Functions 始终由 Wrangler 执行，并从 `wrangler.jsonc` 读取 `DB`、`MEDIA` 和 `preview_database_id` 绑定；本地不再通过 Vite 中间件或 Node SQLite 兼容层模拟 API。部署前必须用 Wrangler 在预览及生产 D1 分别应用 migrations，并替换配置中的 D1 database ID。

### 8.2 环境变量/Secrets

| 名称 | 类型 | 用途 |
| --- | --- | --- |
| `ADMIN_USERNAME` | Secret | 管理员登录名 |
| `ADMIN_PASSWORD_HASH` | Secret | 离线生成的 PBKDF2 密码哈希字符串 |
| `SESSION_TTL_SECONDS` | 非敏感配置 | 会话空闲/最长有效时长策略 |
| `SITE_ORIGIN` | 非敏感配置 | 精确 Origin 校验及安全链接生成 |
| `MAX_IMAGE_BYTES` / `MAX_PDF_BYTES` | 非敏感配置 | 服务端上传限制 |

Cloudflare API Token 只在 Cloudflare/GitHub Actions 的受限部署环境中使用；本地开发优先 `wrangler login`。任何 Token 不进入浏览器环境变量。

### 8.3 部署步骤

1. 创建 GitHub 仓库并推送；Cloudflare Pages 连接仓库并配置 `npm ci`、`npm run build`、输出目录 `dist`。
2. 创建预览及生产 D1、R2 资源，在 Pages 设置中配置对应 bindings。
3. 执行本地 migration，再分别应用远程预览/生产 migration；生产 migration 在发布前检查备份及兼容性。
4. 在 Cloudflare Pages secrets 中配置管理员用户名和离线生成的密码哈希；设置公开来源、会话和上传参数。
5. 运行 lint、类型检查、单元/API/e2e 测试，部署预览分支并验证后台保存后重新加载仍持久化。
6. 验证 Cookie、安全响应头、上传限制、项目/博客草稿隔离和简历下载，再合并到生产分支。
7. 配置自定义域名/HTTPS，检查 DNS、生产 API 和媒体缓存，记录回滚到上一部署与数据恢复流程。

## 9. 技术验收

- 本地和 Cloudflare Pages 构建成功；Functions API 和 D1/R2 bindings 在预览环境可用。
- 公开 API 仅暴露已发布字段；管理 API 未登录拒绝；Cookie 属性和登出撤销符合设计。
- Markdown 不执行脚本或原始 HTML；校验非法链接和恶意输入。
- 允许类型/大小的文件可上传并重新读取；伪造 MIME、签名错误和超限文件拒绝。
- migration 可在空数据库执行且重复部署不造成 schema 漂移；远程环境独立配置。
- 管理端保存内容后，页面硬刷新仍从服务端读回一致数据；浏览器存储中无认证凭据。

## 10. 官方文档参考

- Cloudflare Pages Functions: https://developers.cloudflare.com/pages/functions/
- Pages Functions bindings: https://developers.cloudflare.com/pages/functions/bindings/
- Pages Wrangler configuration: https://developers.cloudflare.com/pages/functions/wrangler-configuration/
- Cloudflare D1 migrations: https://developers.cloudflare.com/d1/reference/migrations/
- Cloudflare R2 Workers API: https://developers.cloudflare.com/r2/api/workers/workers-api-reference/
- Vite deployment: https://developers.cloudflare.com/pages/framework-guides/deploy-a-vite3-project/
