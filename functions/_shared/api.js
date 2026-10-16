const SESSION_COOKIE = "portfolio_session";
const SESSION_TTL_SECONDS = 60 * 60 * 12;
const MAX_JSON_BYTES = 1024 * 1024;
const IMAGE_LIMIT_BYTES = 5 * 1024 * 1024;
const PDF_LIMIT_BYTES = 8 * 1024 * 1024;

const collections = {
  skills: {
    table: "skills",
    columns: ["category", "name", "description", "sort_order", "is_visible"],
    required: ["category", "name"],
    listSql: "SELECT * FROM skills ORDER BY sort_order, name",
  },
  projects: {
    table: "projects",
    columns: ["slug", "title", "summary", "body_markdown", "role", "tech_json", "tags_json", "cover_key", "repo_url", "demo_url", "start_date", "end_date", "status", "sort_order"],
    required: ["slug", "title", "summary"],
    listSql: "SELECT * FROM projects ORDER BY sort_order, created_at",
  },
  posts: {
    table: "posts",
    columns: ["slug", "title", "excerpt", "body_markdown", "tags_json", "cover_key", "status"],
    required: ["slug", "title"],
    listSql: "SELECT * FROM posts ORDER BY updated_at DESC",
  },
};

const now = () => new Date().toISOString();
const json = (data, status = 200, headers = {}) =>
  Response.json({ data }, { status, headers: { "Cache-Control": "no-store", ...headers } });
const fail = (status, code, message) =>
  Response.json({ error: { code, message } }, { status, headers: { "Cache-Control": "no-store" } });
const asText = (value, max = 5000) => typeof value === "string" ? value.trim().slice(0, max) : "";
const nullableText = (value, max = 5000) => asText(value, max) || null;
const isSlug = (value) => typeof value === "string" && /^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value);
const mediaUrl = (key) => key ? `/media/${key.split("/").map(encodeURIComponent).join("/")}` : null;

function parseJson(value, fallback) {
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function mapProfile(profile) {
  if (!profile) return null;
  return {
    display_name: profile.display_name,
    headline: profile.headline,
    intro: profile.intro,
    location: profile.location,
    wechat_id: profile.wechat_id,
    wechat_qr_url: mediaUrl(profile.wechat_qr_key),
    avatar_url: mediaUrl(profile.avatar_key),
    resume_url: mediaUrl(profile.resume_key),
    updated_at: profile.updated_at,
  };
}

function mapProject(project) {
  return {
    ...project,
    tech: parseJson(project.tech_json, []),
    tags: parseJson(project.tags_json, []),
    cover_url: mediaUrl(project.cover_key),
  };
}

function mapPost(post) {
  return { ...post, tags: parseJson(post.tags_json, []), cover_url: mediaUrl(post.cover_key) };
}

function mapSkill(skill) {
  return { ...skill, sort_order: Number(skill.sort_order) };
}

function fromBase64Url(value) {
  const base64 = value.replaceAll("-", "+").replaceAll("_", "/");
  const binary = atob(base64 + "=".repeat((4 - base64.length % 4) % 4));
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

async function digest(value) {
  const result = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return toBase64Url(new Uint8Array(result));
}

async function verifyPassword(password, encoded) {
  const parts = encoded.split("$");
  if (parts.length !== 5 || parts[1] !== "pbkdf2-sha256") return false;
  const iterations = Number(parts[2]);
  if (!Number.isInteger(iterations) || iterations < 100000 || iterations > 1000000) return false;
  const salt = fromBase64Url(parts[3]);
  const expected = fromBase64Url(parts[4]);
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, ["deriveBits"]);
  const actual = new Uint8Array(await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    expected.length * 8,
  ));
  if (actual.length !== expected.length) return false;
  let mismatch = 0;
  for (let index = 0; index < actual.length; index += 1) mismatch |= actual[index] ^ expected[index];
  return mismatch === 0;
}

async function hmac(value, secret) {
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(value))));
}

function getCookie(request) {
  const cookies = request.headers.get("Cookie") ?? "";
  const entry = cookies.split(";").map((part) => part.trim()).find((part) => part.startsWith(`${SESSION_COOKIE}=`));
  return entry?.slice(SESSION_COOKIE.length + 1) ?? "";
}

function cookieHeader(token, env, clear = false) {
  const secure = env.SITE_ORIGIN?.startsWith("https://") ? "; Secure" : "";
  return `${SESSION_COOKIE}=${clear ? "" : token}; HttpOnly; SameSite=Lax; Path=/api/admin; Max-Age=${clear ? 0 : SESSION_TTL_SECONDS}${secure}`;
}

function checkOrigin(request, env) {
  const origin = request.headers.get("Origin");
  return Boolean(origin && origin === new URL(request.url).origin && (!env.SITE_ORIGIN || origin === env.SITE_ORIGIN));
}

async function readJson(request) {
  const length = Number(request.headers.get("Content-Length") ?? 0);
  if (length > MAX_JSON_BYTES) throw new Error("BODY_TOO_LARGE");
  const body = await request.arrayBuffer();
  if (body.byteLength > MAX_JSON_BYTES) throw new Error("BODY_TOO_LARGE");
  return JSON.parse(new TextDecoder().decode(body));
}

async function requireSession(request, env) {
  const token = getCookie(request);
  if (!token) return null;
  const tokenHash = await digest(token);
  const session = await env.DB.prepare(
    "SELECT id FROM admin_sessions WHERE token_hash = ? AND expires_at > ?",
  ).bind(tokenHash, now()).first();
  return session ?? null;
}

async function mapAdminProfile(env) {
  const profile = await env.DB.prepare("SELECT * FROM profile WHERE id = 1").first();
  return profile ? {
    ...mapProfile(profile),
    avatar_key: profile.avatar_key,
    resume_key: profile.resume_key,
    wechat_qr_key: profile.wechat_qr_key,
  } : null;
}

async function rateLimitKey(request, env) {
  const address = request.headers.get("CF-Connecting-IP") ?? request.headers.get("x-forwarded-for") ?? "local";
  const username = (request.headers.get("X-Login-Name") ?? "").slice(0, 128);
  return hmac(`${address}:${username}`, env.SESSION_SECRET);
}

async function handleLogin(request, env) {
  if (!checkOrigin(request, env)) return fail(403, "ORIGIN_REJECTED", "请求来源无效。");
  let input;
  try {
    input = await readJson(request);
  } catch {
    return fail(400, "INVALID_BODY", "请检查登录信息。");
  }

  const username = asText(input.username, 128);
  const password = typeof input.password === "string" ? input.password.slice(0, 256) : "";
  const identifierHash = await hmac(
    `${request.headers.get("CF-Connecting-IP") ?? "local"}:${username}`,
    env.SESSION_SECRET,
  );
  await env.DB.prepare("DELETE FROM login_attempts WHERE attempted_at < ?")
    .bind(new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()).run();
  const attempts = await env.DB.prepare(
    "SELECT COUNT(*) AS count FROM login_attempts WHERE identifier_hash = ? AND success = 0 AND attempted_at > ?",
  ).bind(identifierHash, new Date(Date.now() - 15 * 60 * 1000).toISOString()).first();
  if (Number(attempts?.count ?? 0) >= 8) return fail(429, "RATE_LIMITED", "登录尝试过多，请 15 分钟后再试。");

  const usernameMatches = username === env.ADMIN_USERNAME;
  const passwordMatches = await verifyPassword(password, env.ADMIN_PASSWORD_HASH ?? "");
  const success = usernameMatches && passwordMatches;
  await env.DB.prepare("INSERT INTO login_attempts (identifier_hash, attempted_at, success) VALUES (?, ?, ?)")
    .bind(identifierHash, now(), success ? 1 : 0).run();
  if (!success) return fail(401, "LOGIN_FAILED", "账号或密码错误。");
  await env.DB.prepare("DELETE FROM login_attempts WHERE identifier_hash = ? AND success = 0")
    .bind(identifierHash).run();

  const token = toBase64Url(crypto.getRandomValues(new Uint8Array(32)));
  const tokenHash = await digest(token);
  const expiresAt = new Date(Date.now() + SESSION_TTL_SECONDS * 1000).toISOString();
  await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ? OR expires_at <= ?")
    .bind(tokenHash, now()).run();
  await env.DB.prepare("INSERT INTO admin_sessions (id, token_hash, created_at, expires_at) VALUES (?, ?, ?, ?)")
    .bind(crypto.randomUUID(), tokenHash, now(), expiresAt).run();
  return json({ authenticated: true, expires_at: expiresAt }, 200, { "Set-Cookie": cookieHeader(token, env) });
}

function parseList(value, maxItems = 30) {
  const values = Array.isArray(value) ? value : typeof value === "string" ? value.split(/[\n,]/) : [];
  return [...new Set(values.map((item) => asText(item, 100)).filter(Boolean))].slice(0, maxItems);
}

function safeUrl(value) {
  const text = nullableText(value, 2048);
  if (!text) return null;
  try {
    const url = new URL(text);
    return url.protocol === "https:" ? url.toString() : null;
  } catch {
    return null;
  }
}

function validateRecord(type, input) {
  const record = {};
  if (type === "skills") {
    record.category = asText(input.category, 80);
    record.name = asText(input.name, 100);
    record.description = nullableText(input.description, 1000);
    record.sort_order = Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0;
    record.is_visible = input.is_visible === false || input.is_visible === 0 || input.is_visible === "0" ? 0 : 1;
  } else if (type === "projects") {
    record.slug = asText(input.slug, 100);
    record.title = asText(input.title, 180);
    record.summary = asText(input.summary, 1000);
    record.body_markdown = asText(input.body_markdown, 30000);
    record.role = nullableText(input.role, 120);
    record.tech_json = JSON.stringify(parseList(input.tech));
    record.tags_json = JSON.stringify(parseList(input.tags));
    record.cover_key = nullableText(input.cover_key, 240);
    record.repo_url = safeUrl(input.repo_url);
    record.demo_url = safeUrl(input.demo_url);
    record.start_date = nullableText(input.start_date, 40);
    record.end_date = nullableText(input.end_date, 40);
    record.status = input.status === "published" ? "published" : input.status === "archived" ? "archived" : "draft";
    record.sort_order = Number.isInteger(Number(input.sort_order)) ? Number(input.sort_order) : 0;
  } else if (type === "posts") {
    record.slug = asText(input.slug, 100);
    record.title = asText(input.title, 180);
    record.excerpt = asText(input.excerpt, 1000);
    record.body_markdown = asText(input.body_markdown, 30000);
    record.tags_json = JSON.stringify(parseList(input.tags));
    record.cover_key = nullableText(input.cover_key, 240);
    record.status = input.status === "published" ? "published" : "draft";
  }

  const config = collections[type];
  if (!config || config.required.some((field) => !record[field])) {
    return { error: "请填写所有必填字段。" };
  }
  if ((type === "projects" || type === "posts") && !isSlug(record.slug)) {
    return { error: "链接标识仅支持小写英文、数字和连字符。" };
  }
  if ((input.repo_url && !record.repo_url) || (input.demo_url && !record.demo_url)) {
    return { error: "外部链接必须使用 HTTPS。" };
  }
  return { record };
}

async function handleCollection(request, env, type, id) {
  const config = collections[type];
  if (!config) return fail(404, "NOT_FOUND", "内容不存在。");
  if (request.method === "GET" && !id) {
    const result = await env.DB.prepare(config.listSql).all();
    const rows = result.results ?? [];
    return json(rows.map(type === "skills" ? mapSkill : type === "projects" ? mapProject : mapPost));
  }
  if (request.method === "GET" && id) {
    const row = await env.DB.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).bind(id).first();
    return row ? json((type === "skills" ? mapSkill : type === "projects" ? mapProject : mapPost)(row)) : fail(404, "NOT_FOUND", "内容不存在。");
  }
  if (request.method === "DELETE" && id) {
    const result = await env.DB.prepare(`DELETE FROM ${config.table} WHERE id = ?`).bind(id).run();
    return Number(result.meta?.changes ?? result.changes ?? 0) ? json({ deleted: true }) : fail(404, "NOT_FOUND", "内容不存在。");
  }
  if (request.method !== "POST" && request.method !== "PUT") return fail(405, "METHOD_NOT_ALLOWED", "不支持此操作。");
  if ((request.method === "POST" && id) || (request.method === "PUT" && !id)) return fail(404, "NOT_FOUND", "内容不存在。");

  let input;
  try {
    input = await readJson(request);
  } catch (error) {
    return fail(error.message === "BODY_TOO_LARGE" ? 413 : 400, "INVALID_BODY", "请检查提交内容。");
  }
  const { record, error } = validateRecord(type, input);
  if (error) return fail(422, "VALIDATION_ERROR", error);

  const timestamp = now();
  try {
    if (request.method === "POST") {
      const recordId = crypto.randomUUID();
      const values = { ...record };
      if (type === "projects" || type === "posts") {
        values.published_at = record.status === "published" ? timestamp : null;
      }
      values.id = recordId;
      values.created_at = timestamp;
      values.updated_at = timestamp;
      const columns = Object.keys(values);
      await env.DB.prepare(
        `INSERT INTO ${config.table} (${columns.join(", ")}) VALUES (${columns.map(() => "?").join(", ")})`,
      ).bind(...columns.map((column) => values[column])).run();
      const row = await env.DB.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).bind(recordId).first();
      return json((type === "skills" ? mapSkill : type === "projects" ? mapProject : mapPost)(row), 201);
    }

    const values = { ...record, updated_at: timestamp };
    if (type === "projects" || type === "posts") {
      const current = await env.DB.prepare(`SELECT published_at FROM ${config.table} WHERE id = ?`).bind(id).first();
      if (!current) return fail(404, "NOT_FOUND", "内容不存在。");
      values.published_at = record.status === "published" ? current.published_at ?? timestamp : null;
    }
    const columns = Object.keys(values);
    const result = await env.DB.prepare(
      `UPDATE ${config.table} SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = ?`,
    ).bind(...columns.map((column) => values[column]), id).run();
    if (!Number(result.meta?.changes ?? result.changes ?? 0)) return fail(404, "NOT_FOUND", "内容不存在。");
    const row = await env.DB.prepare(`SELECT * FROM ${config.table} WHERE id = ?`).bind(id).first();
    return json((type === "skills" ? mapSkill : type === "projects" ? mapProject : mapPost)(row));
  } catch (error) {
    if (String(error?.message ?? "").includes("UNIQUE")) return fail(409, "CONFLICT", "该链接标识已存在。");
    throw error;
  }
}

async function handleUpload(request, env) {
  let form;
  try {
    const length = Number(request.headers.get("Content-Length") ?? 0);
    if (length > PDF_LIMIT_BYTES + 64 * 1024) return fail(413, "FILE_TOO_LARGE", "文件超过大小限制。");
    form = await request.formData();
  } catch {
    return fail(400, "INVALID_UPLOAD", "无法读取上传文件。");
  }
  const kind = form.get("kind");
  const file = form.get("file");
  const allowedKinds = ["avatar", "project-cover", "resume", "content-image", "wechat-qr"];
  if (!allowedKinds.includes(kind) || !(file instanceof File)) return fail(422, "INVALID_UPLOAD", "请选择有效的上传用途和文件。");
  const isPdf = kind === "resume";
  const limit = isPdf ? PDF_LIMIT_BYTES : IMAGE_LIMIT_BYTES;
  if (!file.size || file.size > limit) return fail(413, "FILE_TOO_LARGE", `文件大小需小于 ${isPdf ? 8 : 5} MiB。`);

  const allowed = isPdf
    ? { "application/pdf": "pdf" }
    : { "image/png": "png", "image/jpeg": "jpg", "image/webp": "webp" };
  const extension = allowed[file.type];
  if (!extension) return fail(415, "UNSUPPORTED_MEDIA", "仅支持 PNG、JPEG、WebP 图片和 PDF 简历。");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const signatureOk = isPdf
    ? new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-"
    : file.type === "image/png"
      ? bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47
      : file.type === "image/jpeg"
        ? bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        : new TextDecoder().decode(bytes.slice(0, 4)) === "RIFF"
          && new TextDecoder().decode(bytes.slice(8, 12)) === "WEBP";
  if (!signatureOk) return fail(415, "INVALID_SIGNATURE", "文件内容与所声明的类型不匹配。");

  const key = `${kind}/${crypto.randomUUID()}.${extension}`;
  await env.MEDIA.put(key, bytes, {
    httpMetadata: {
      contentType: file.type,
      cacheControl: "public, max-age=31536000, immutable",
    },
  });
  await env.DB.prepare(
    "INSERT INTO media_objects (key, kind, content_type, size_bytes, created_at) VALUES (?, ?, ?, ?, ?)",
  ).bind(key, kind, file.type, file.size, now()).run();
  return json({ key, url: mediaUrl(key), content_type: file.type, size_bytes: file.size }, 201);
}

async function handleAdmin(request, env, pathname) {
  if (pathname === "/api/admin/auth/login" && request.method === "POST") return handleLogin(request, env);
  if (pathname === "/api/admin/auth/session" && request.method === "GET") {
    return json({ authenticated: Boolean(await requireSession(request, env)) });
  }
  if (pathname === "/api/admin/auth/logout" && request.method === "POST") {
    if (!checkOrigin(request, env)) return fail(403, "ORIGIN_REJECTED", "请求来源无效。");
    const token = getCookie(request);
    if (token) await env.DB.prepare("DELETE FROM admin_sessions WHERE token_hash = ?").bind(await digest(token)).run();
    return json({ authenticated: false }, 200, { "Set-Cookie": cookieHeader("", env, true) });
  }

  if (!await requireSession(request, env)) return fail(401, "UNAUTHORIZED", "请先登录管理员账号。");
  if (!checkOrigin(request, env) && request.method !== "GET") return fail(403, "ORIGIN_REJECTED", "请求来源无效。");

  if (pathname === "/api/admin/dashboard" && request.method === "GET") {
    const [skills, projects, posts] = await Promise.all([
      env.DB.prepare("SELECT COUNT(*) AS count FROM skills").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM projects").first(),
      env.DB.prepare("SELECT COUNT(*) AS count FROM posts").first(),
    ]);
    return json({ skills: Number(skills?.count ?? 0), projects: Number(projects?.count ?? 0), posts: Number(posts?.count ?? 0) });
  }

  if (pathname === "/api/admin/profile") {
    if (request.method === "GET") return json(await mapAdminProfile(env));
    if (request.method !== "PUT") return fail(405, "METHOD_NOT_ALLOWED", "不支持此操作。");
    let input;
    try {
      input = await readJson(request);
    } catch {
      return fail(400, "INVALID_BODY", "请检查资料内容。");
    }
    const record = {
      display_name: asText(input.display_name, 120),
      headline: asText(input.headline, 180),
      intro: asText(input.intro, 5000),
      location: nullableText(input.location, 180),
      wechat_id: asText(input.wechat_id, 100),
      wechat_qr_key: nullableText(input.wechat_qr_key, 240),
      avatar_key: nullableText(input.avatar_key, 240),
      resume_key: nullableText(input.resume_key, 240),
      updated_at: now(),
    };
    if (!record.display_name || !record.headline || !record.wechat_id) return fail(422, "VALIDATION_ERROR", "姓名、定位和微信号不能为空。");
    for (const [key, kind] of [
      ["avatar_key", "avatar"],
      ["resume_key", "resume"],
      ["wechat_qr_key", "wechat-qr"],
    ]) {
      if (!record[key]) continue;
      const media = await env.DB.prepare("SELECT kind FROM media_objects WHERE key = ?").bind(record[key]).first();
      if (media?.kind !== kind) return fail(422, "VALIDATION_ERROR", "所选头像、简历或微信二维码文件无效。");
    }
    const columns = Object.keys(record);
    await env.DB.prepare(
      `UPDATE profile SET ${columns.map((column) => `${column} = ?`).join(", ")} WHERE id = 1`,
    ).bind(...columns.map((column) => record[column])).run();
    return json(await mapAdminProfile(env));
  }

  if (pathname === "/api/admin/uploads" && request.method === "POST") return handleUpload(request, env);

  const match = pathname.match(/^\/api\/admin\/(skills|projects|posts)(?:\/([a-zA-Z0-9-]+))?$/);
  if (match) return handleCollection(request, env, match[1], match[2]);
  return fail(404, "NOT_FOUND", "请求的管理内容不存在。");
}

export async function handleApiRequest(request, env) {
  try {
    const { pathname } = new URL(request.url);
    if (pathname === "/api/public/site" && request.method === "GET") {
      const [profile, skills, projects, posts] = await Promise.all([
        env.DB.prepare("SELECT * FROM profile WHERE id = 1").first(),
        env.DB.prepare("SELECT * FROM skills WHERE is_visible = 1 ORDER BY sort_order, name").all(),
        env.DB.prepare("SELECT * FROM projects WHERE status = 'published' ORDER BY sort_order, created_at").all(),
        env.DB.prepare("SELECT * FROM posts WHERE status = 'published' ORDER BY published_at DESC").all(),
      ]);
      return json({
        profile: mapProfile(profile),
        skills: (skills.results ?? []).map(mapSkill),
        experiences: [],
        projects: (projects.results ?? []).map(mapProject),
        posts: (posts.results ?? []).map(mapPost),
      });
    }
    if (pathname.startsWith("/api/admin/")) return handleAdmin(request, env, pathname);
    return fail(404, "NOT_FOUND", "请求的 API 不存在。");
  } catch {
    return fail(500, "INTERNAL_ERROR", "服务暂时无法完成请求。");
  }
}

export async function handleMediaRequest(request, env, key) {
  if (request.method !== "GET" || !key || key.length > 300) return fail(404, "NOT_FOUND", "文件不存在。");
  try {
    const media = await env.DB.prepare("SELECT content_type FROM media_objects WHERE key = ?").bind(key).first();
    if (!media) return fail(404, "NOT_FOUND", "文件不存在。");
    const object = await env.MEDIA.get(key);
    if (!object) return fail(404, "NOT_FOUND", "文件不存在。");
    return new Response(object.body, {
      headers: {
        "Content-Type": media.content_type,
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "public, max-age=31536000, immutable",
        "Content-Security-Policy": "default-src 'none'; sandbox",
        "Content-Disposition": media.content_type === "application/pdf" ? "attachment; filename=\"resume.pdf\"" : "inline",
      },
    });
  } catch {
    return fail(500, "INTERNAL_ERROR", "文件暂时无法读取。");
  }
}
