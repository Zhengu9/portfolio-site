import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  FileText,
  ImagePlus,
  LogOut,
  Plus,
  Save,
  Trash2,
  Upload,
  X,
} from "lucide-react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import type { Post, Project } from "../types/content";
import {
  deleteAdminRecord,
  getAdminDashboard,
  getAdminProfile,
  getAdminRecords,
  getAdminSession,
  loginAdmin,
  logoutAdmin,
  saveAdminProfile,
  saveAdminRecord,
  uploadAdminFile,
  type AdminDashboard,
  type AdminRecord,
  type CollectionName,
  type EditableProfile,
  type UploadKind,
} from "../api/admin";

const sectionNames: Record<CollectionName, string> = {
  skills: "技能",
  projects: "项目",
  posts: "博客",
};

function AdminShell({ children, onLogout }: { children: ReactNode; onLogout: () => void }) {
  return (
    <div className="admin-shell">
      <aside className="admin-sidebar">
        <Link className="brand-mark" to="/">
          <span className="brand-glyph">G</span><span className="brand-name">STUDIO</span>
        </Link>
        <p className="admin-side-label">CONTENT</p>
        <NavLink to="/admin" end>概览</NavLink>
        <NavLink to="/admin/profile">个人资料</NavLink>
        <NavLink to="/admin/skills">技能</NavLink>
        <NavLink to="/admin/projects">项目</NavLink>
        <NavLink to="/admin/posts">博客</NavLink>
        <div className="admin-sidebar-bottom">
          <span className="status-dot" />本地持久化已启用
          <button type="button" className="admin-logout" onClick={onLogout} aria-label="退出登录" title="退出登录">
            <LogOut size={16} />
          </button>
        </div>
      </aside>
      <main className="admin-main">{children}</main>
    </div>
  );
}

function AdminLoginPage() {
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      await loginAdmin(username, password);
      navigate("/admin", { replace: true });
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "登录失败，请重试。");
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="login-screen">
      <Link className="login-back" to="/">← 返回作品集</Link>
      <form className="login-form" onSubmit={submit}>
        <p className="section-kicker"><span>SECURE AREA</span></p>
        <h1>管理员登录</h1>
        <p>登录后维护公开作品集内容。</p>
        <label htmlFor="username">管理员账号</label>
        <input id="username" name="username" autoComplete="username" required value={username} onChange={(event) => setUsername(event.target.value)} />
        <label htmlFor="password">密码</label>
        <input id="password" name="password" type="password" autoComplete="current-password" required value={password} onChange={(event) => setPassword(event.target.value)} />
        {error && <p className="form-error" role="alert">{error}</p>}
        <button className="button button-primary" type="submit" disabled={busy}>
          {busy ? "正在验证…" : "登录"} <ArrowRight size={16} />
        </button>
      </form>
    </main>
  );
}

function AdminHeader({ title, detail }: { title: string; detail: string }) {
  return (
    <header className="admin-page-header">
      <p className="section-kicker"><span>PRIVATE WORKSPACE</span></p>
      <h1>{title}</h1>
      <p>{detail}</p>
    </header>
  );
}

function AdminDashboardPage() {
  const [counts, setCounts] = useState<AdminDashboard | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    getAdminDashboard().then(setCounts).catch((reason: unknown) => {
      setError(reason instanceof Error ? reason.message : "暂时无法读取内容数量。");
    });
  }, []);

  const cards: { to: string; label: string; count?: number }[] = [
    { to: "/admin/profile", label: "个人资料" },
    { to: "/admin/skills", label: "技能", count: counts?.skills },
    { to: "/admin/projects", label: "项目", count: counts?.projects },
    { to: "/admin/posts", label: "博客文章", count: counts?.posts },
  ];

  return (
    <>
      <AdminHeader title="内容管理" detail="编辑公开资料、技能、项目和博客，保存后刷新网站即可看到更新。" />
      {error && <p className="admin-feedback is-error" role="alert">{error}</p>}
      <div className="admin-overview-grid">
        {cards.map((card, index) => (
          <Link className="admin-overview-item" key={card.to} to={card.to}>
            <span>0{index + 1}</span>
            <strong>{card.label}{card.count !== undefined ? ` · ${card.count}` : ""}</strong>
            <ArrowUpRight size={16} />
          </Link>
        ))}
      </div>
      <p className="admin-notice">本地使用 Cloudflare Pages 模拟环境；内容写入 D1，上传文件写入 R2。此数据仅保存在当前设备。</p>
    </>
  );
}

function ProfileEditor() {
  const [profile, setProfile] = useState<EditableProfile | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState<UploadKind | null>(null);
  const [feedback, setFeedback] = useState("");

  useEffect(() => {
    getAdminProfile().then(setProfile).catch((reason: unknown) => {
      setFeedback(reason instanceof Error ? reason.message : "无法读取个人资料。");
    });
  }, []);

  const setField = (key: keyof EditableProfile, value: string | null) => {
    setProfile((current) => current ? { ...current, [key]: value } : current);
  };

  const upload = async (event: ChangeEvent<HTMLInputElement>, kind: UploadKind) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setUploading(kind);
    setFeedback("");
    try {
      const result = await uploadAdminFile(file, kind);
      if (kind === "avatar") {
        setProfile((current) => current ? { ...current, avatar_key: result.key, avatar_url: result.url } : current);
      } else if (kind === "resume") {
        setProfile((current) => current ? { ...current, resume_key: result.key, resume_url: result.url } : current);
      } else if (kind === "wechat-qr") {
        setProfile((current) => current ? { ...current, wechat_qr_key: result.key, wechat_qr_url: result.url } : current);
      }
      setFeedback("上传完成。点击保存后，公开页面会使用新文件。");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "文件上传失败。");
    } finally {
      setUploading(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!profile) return;
    setBusy(true);
    setFeedback("");
    try {
      setProfile(await saveAdminProfile(profile));
      setFeedback("资料已保存。重新加载公开页面即可验证。");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  };

  if (!profile) return <><AdminHeader title="个人资料" detail="加载中…" />{feedback && <p className="admin-feedback is-error">{feedback}</p>}</>;

  return (
    <>
      <AdminHeader title="个人资料" detail="个人文字信息、头像和 PDF 简历。" />
      <form className="admin-editor" onSubmit={submit}>
        <div className="admin-form-grid">
          <label className="admin-field">姓名
            <input required maxLength={120} value={profile.display_name} onChange={(event) => setField("display_name", event.target.value)} />
          </label>
          <label className="admin-field">定位
            <input required maxLength={180} value={profile.headline} onChange={(event) => setField("headline", event.target.value)} />
          </label>
          <label className="admin-field admin-field-wide">个人介绍
            <textarea rows={5} maxLength={5000} value={profile.intro} onChange={(event) => setField("intro", event.target.value)} />
          </label>
          <label className="admin-field">学校与专业
            <input maxLength={180} value={profile.location ?? ""} onChange={(event) => setField("location", event.target.value)} />
          </label>
          <label className="admin-field">微信号
            <input required maxLength={100} value={profile.wechat_id} onChange={(event) => setField("wechat_id", event.target.value)} />
          </label>
        </div>

        <div className="admin-upload-grid">
          <section className="admin-upload-field">
            <h2>头像</h2>
            {profile.avatar_url
              ? <img className="admin-avatar-preview" src={profile.avatar_url} alt="当前头像预览" />
              : <div className="admin-upload-empty"><ImagePlus size={24} /><span>尚未上传头像</span></div>}
            <label className="button button-quiet admin-upload-button">
              <Upload size={15} />{uploading === "avatar" ? "上传中…" : "选择图片"}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading !== null} onChange={(event) => void upload(event, "avatar")} />
            </label>
            <small>PNG、JPEG 或 WebP，最大 5 MiB。</small>
          </section>
          <section className="admin-upload-field">
            <h2>PDF 简历</h2>
            <div className="admin-file-current">
              <FileText size={22} />
              <span>{profile.resume_url ? "简历文件已上传" : "尚未上传简历"}</span>
              {profile.resume_url && <a href={profile.resume_url} target="_blank" rel="noreferrer" aria-label="预览当前简历"><ArrowUpRight size={15} /></a>}
            </div>
            <label className="button button-quiet admin-upload-button">
              <Upload size={15} />{uploading === "resume" ? "上传中…" : "选择 PDF"}
              <input type="file" accept="application/pdf,.pdf" disabled={uploading !== null} onChange={(event) => void upload(event, "resume")} />
            </label>
            <small>PDF 文件，最大 8 MiB。简历下载将在保存后更新。</small>
          </section>
          <section className="admin-upload-field">
            <h2>微信二维码</h2>
            {profile.wechat_qr_url
              ? <img className="admin-qr-preview" src={profile.wechat_qr_url} alt="当前微信二维码预览" />
              : <div className="admin-upload-empty"><ImagePlus size={24} /><span>尚未上传二维码</span></div>}
            <label className="button button-quiet admin-upload-button">
              <Upload size={15} />{uploading === "wechat-qr" ? "上传中…" : profile.wechat_qr_url ? "更换二维码" : "选择二维码"}
              <input type="file" accept="image/png,image/jpeg,image/webp" disabled={uploading !== null} onChange={(event) => void upload(event, "wechat-qr")} />
            </label>
            <small>PNG、JPEG 或 WebP，最大 5 MiB。上传后点击保存，公开联系页将显示新二维码。</small>
          </section>
        </div>

        {feedback && <p className={`admin-feedback${feedback.includes("失败") || feedback.includes("无法") ? " is-error" : ""}`} role="status">{feedback}</p>}
        <div className="admin-form-actions">
          <button className="button button-primary" type="submit" disabled={busy || uploading !== null}>
            <Save size={16} />{busy ? "保存中…" : "保存资料"}
          </button>
        </div>
      </form>
    </>
  );
}

function emptyRecord(collection: CollectionName): Record<string, string> {
  if (collection === "skills") return { category: "", name: "", description: "", sort_order: "0", is_visible: "1" };
  if (collection === "projects") {
    return {
      slug: "", title: "", summary: "", body_markdown: "", role: "", tech: "", tags: "",
      cover_key: "", repo_url: "", demo_url: "", start_date: "", end_date: "", status: "draft", sort_order: "0",
    };
  }
  return { slug: "", title: "", excerpt: "", body_markdown: "", tags: "", cover_key: "", status: "draft" };
}

function recordToForm(record: AdminRecord) {
  const item = record as unknown as Record<string, unknown>;
  return Object.fromEntries(Object.entries(item).map(([key, value]) => [
    key.replace(/_json$/, ""),
    Array.isArray(value) ? value.join(", ") : value === null || value === undefined ? "" : String(value),
  ]));
}

function recordName(collection: CollectionName, record: AdminRecord) {
  if (collection === "skills") {
    const skill = record as Extract<AdminRecord, { category: string }>;
    return `${skill.category} / ${skill.name}`;
  }
  return (record as Extract<AdminRecord, { title: string }>).title;
}

function AdminRecordsPage({ collection }: { collection: CollectionName }) {
  const [records, setRecords] = useState<AdminRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<Record<string, string>>(() => emptyRecord(collection));
  const [feedback, setFeedback] = useState("");
  const [busy, setBusy] = useState(false);
  const [coverPreview, setCoverPreview] = useState("");
  const [uploading, setUploading] = useState(false);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  const refresh = async () => {
    setLoading(true);
    try {
      setRecords(await getAdminRecords(collection));
      setFeedback("");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "无法读取内容列表。");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { void refresh(); }, [collection]);

  const startNew = () => {
    setEditingId(null);
    setFormOpen(true);
    setForm(emptyRecord(collection));
    setCoverPreview("");
    setFeedback("");
  };

  const startEdit = (record: AdminRecord) => {
    setEditingId(record.id);
    setForm({ ...emptyRecord(collection), ...recordToForm(record) });
    setFormOpen(true);
    setCoverPreview(collection !== "skills" ? (record as Project | Post).cover_url ?? "" : "");
    setFeedback("");
  };

  const setField = (key: string, value: string) => setForm((current) => ({ ...current, [key]: value }));

  const uploadCover = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    setUploading(true);
    setFeedback("");
    try {
      const result = await uploadAdminFile(file, "project-cover");
      setField("cover_key", result.key);
      setCoverPreview(result.url);
      setFeedback("图片已上传，保存内容后会关联到此项目/文章。");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "图片上传失败。");
    } finally {
      setUploading(false);
    }
  };

  const uploadBodyImage = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file) return;
    const start = bodyRef.current?.selectionStart ?? form.body_markdown.length;
    const end = bodyRef.current?.selectionEnd ?? start;
    setUploading(true);
    setFeedback("");
    try {
      const result = await uploadAdminFile(file, "content-image");
      const snippet = `![${file.name.replace(/[\[\]]/g, "")}](${result.url})`;
      const next = `${form.body_markdown.slice(0, start)}${snippet}${form.body_markdown.slice(end)}`;
      setField("body_markdown", next);
      window.setTimeout(() => {
        if (!window.matchMedia("(pointer: coarse)").matches) bodyRef.current?.focus();
        bodyRef.current?.setSelectionRange(start + snippet.length, start + snippet.length);
        if (window.matchMedia("(pointer: coarse)").matches) bodyRef.current?.blur();
      }, 0);
      setFeedback("图片已上传并插入正文，保存后会在公开详情中显示。");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "图片上传失败。");
    } finally {
      setUploading(false);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBusy(true);
    setFeedback("");
    const payload: Record<string, unknown> = collection === "skills"
      ? { ...form, sort_order: Number(form.sort_order), is_visible: form.is_visible === "1" }
      : collection === "projects"
        ? {
            ...form,
            tech: form.tech.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
            tags: form.tags.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
            sort_order: Number(form.sort_order),
          }
        : {
            ...form,
            tags: form.tags.split(/[\n,]/).map((item) => item.trim()).filter(Boolean),
          };
    try {
      await saveAdminRecord(collection, payload, editingId ?? undefined);
      setEditingId(null);
      setFormOpen(false);
      setForm(emptyRecord(collection));
      setCoverPreview("");
      await refresh();
      setFeedback("内容已保存；公开页面重新加载后会读取最新数据。");
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "保存失败。");
    } finally {
      setBusy(false);
    }
  };

  const removeRecord = async (record: AdminRecord) => {
    if (!window.confirm(`确认删除“${recordName(collection, record)}”？此操作无法撤销。`)) return;
    try {
      await deleteAdminRecord(collection, record.id);
      setFeedback("内容已删除。");
      await refresh();
    } catch (reason) {
      setFeedback(reason instanceof Error ? reason.message : "删除失败。");
    }
  };

  return (
    <>
      <AdminHeader title={sectionNames[collection]} detail={`管理公开页面中的${sectionNames[collection]}内容。保存后数据写入数据库。`} />
      <div className="admin-list-toolbar">
        <span>{loading ? "正在读取…" : `${records.length} 条内容`}</span>
        <button className="button button-quiet" type="button" onClick={startNew}><Plus size={15} />新建{sectionNames[collection]}</button>
      </div>
      {feedback && <p className={`admin-feedback${feedback.includes("失败") || feedback.includes("无法") ? " is-error" : ""}`} role="status">{feedback}</p>}
      {loading ? <p className="admin-empty">正在读取内容…</p> : records.length === 0 ? <p className="admin-empty">还没有内容，使用“新建”开始添加。</p> : (
        <div className="admin-record-list">
          {records.map((record) => (
            <article className="admin-record" key={record.id}>
              <button className="admin-record-title" type="button" onClick={() => startEdit(record)}>
                <span>{recordName(collection, record)}</span>
                <small>{collection === "skills"
                  ? ((record as Extract<AdminRecord, { category: string }>).description || "未填写说明")
                  : `${(record as Extract<AdminRecord, { slug: string }>).slug} · ${(record as (Project | Post) & { status?: string }).status === "published" ? "已发布" : "草稿"}`}
                </small>
              </button>
              <div className="admin-record-actions">
                <button type="button" title="编辑" aria-label={`编辑${recordName(collection, record)}`} onClick={() => startEdit(record)}><ArrowUpRight size={16} /></button>
                <button type="button" title="删除" aria-label={`删除${recordName(collection, record)}`} onClick={() => void removeRecord(record)}><Trash2 size={16} /></button>
              </div>
            </article>
          ))}
        </div>
      )}

      {formOpen && (
        <form className="admin-editor admin-record-editor" onSubmit={submit}>
          <div className="admin-editor-heading">
            <h2>{editingId ? "编辑内容" : `新建${sectionNames[collection]}`}</h2>
            <button type="button" aria-label="关闭编辑器" title="关闭编辑器" onClick={() => setFormOpen(false)}><X size={17} /></button>
          </div>
          {collection === "skills" ? (
            <div className="admin-form-grid">
              <label className="admin-field">分类<input required value={form.category} onChange={(event) => setField("category", event.target.value)} /></label>
              <label className="admin-field">名称<input required value={form.name} onChange={(event) => setField("name", event.target.value)} /></label>
              <label className="admin-field admin-field-wide">简短说明<input value={form.description} onChange={(event) => setField("description", event.target.value)} /></label>
              <label className="admin-field">排序<input type="number" value={form.sort_order} onChange={(event) => setField("sort_order", event.target.value)} /></label>
              <label className="admin-checkbox"><input type="checkbox" checked={form.is_visible === "1"} onChange={(event) => setField("is_visible", event.target.checked ? "1" : "0")} />在公开页面显示</label>
            </div>
          ) : (
            <>
              <div className="admin-form-grid">
                <label className="admin-field">标题<input required maxLength={180} value={form.title} onChange={(event) => setField("title", event.target.value)} /></label>
                <label className="admin-field">链接标识（slug）<input required pattern="[a-z0-9]+(-[a-z0-9]+)*" value={form.slug} onChange={(event) => setField("slug", event.target.value)} /></label>
                {collection === "projects" ? (
                  <>
                    <label className="admin-field admin-field-wide">摘要<input required value={form.summary} onChange={(event) => setField("summary", event.target.value)} /></label>
                    <label className="admin-field">技术标签<input value={form.tech} onChange={(event) => setField("tech", event.target.value)} /></label>
                    <label className="admin-field">领域标签<input value={form.tags} onChange={(event) => setField("tags", event.target.value)} /></label>
                    <label className="admin-field">本人角色<input value={form.role} onChange={(event) => setField("role", event.target.value)} /></label>
                    <label className="admin-field">仓库 HTTPS 地址<input type="url" value={form.repo_url} onChange={(event) => setField("repo_url", event.target.value)} /></label>
                    <label className="admin-field">演示 HTTPS 地址<input type="url" value={form.demo_url} onChange={(event) => setField("demo_url", event.target.value)} /></label>
                    <label className="admin-field">开始时间<input type="text" placeholder="YYYY-MM" value={form.start_date} onChange={(event) => setField("start_date", event.target.value)} /></label>
                    <label className="admin-field">结束时间<input type="text" placeholder="YYYY-MM" value={form.end_date} onChange={(event) => setField("end_date", event.target.value)} /></label>
                    <label className="admin-field">排序<input type="number" value={form.sort_order} onChange={(event) => setField("sort_order", event.target.value)} /></label>
                  </>
                ) : (
                  <>
                    <label className="admin-field admin-field-wide">摘要<input value={form.excerpt} onChange={(event) => setField("excerpt", event.target.value)} /></label>
                    <label className="admin-field admin-field-wide">文章标签<input value={form.tags} onChange={(event) => setField("tags", event.target.value)} /></label>
                  </>
                )}
                <label className="admin-field">发布状态
                  <select value={form.status} onChange={(event) => setField("status", event.target.value)}>
                    <option value="draft">草稿</option>
                    <option value="published">公开发布</option>
                    {collection === "projects" && <option value="archived">归档</option>}
                  </select>
                </label>
                <div className="admin-field admin-field-wide">
                  <span className="admin-label">封面图片</span>
                  <input type="hidden" value={form.cover_key} />
                  {coverPreview && <img className="admin-cover-preview" src={coverPreview} alt="封面预览" />}
                  <button className="button button-quiet admin-inline-action" type="button" onClick={() => coverInputRef.current?.click()} disabled={uploading}>
                    <Upload size={15} />{uploading ? "上传中…" : "上传封面"}
                  </button>
                  <input ref={coverInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadCover(event)} />
                </div>
                <label className="admin-field admin-field-wide">正文（支持 Markdown）
                  <textarea ref={bodyRef} rows={12} maxLength={30000} value={form.body_markdown} onChange={(event) => setField("body_markdown", event.target.value)} />
                </label>
                <div className="admin-field admin-field-wide">
                  <span className="admin-label">正文图片</span>
                  <input ref={imageInputRef} className="visually-hidden" type="file" accept="image/png,image/jpeg,image/webp" onChange={(event) => void uploadBodyImage(event)} />
                  <button className="button button-quiet admin-inline-action" type="button" onClick={() => imageInputRef.current?.click()} disabled={uploading}>
                    <ImagePlus size={15} />{uploading ? "上传中…" : "上传并插入图片"}
                  </button>
                  <small className="admin-help">图片会作为 Markdown 图片语法插入光标位置，支持 PNG、JPEG、WebP，最大 5 MiB。</small>
                </div>
              </div>
            </>
          )}
          <div className="admin-form-actions">
            <button className="button button-primary" type="submit" disabled={busy || uploading}><Save size={16} />{busy ? "保存中…" : "保存"}</button>
            {!editingId && <button className="button button-quiet" type="button" onClick={startNew}><X size={15} />清空</button>}
          </div>
        </form>
      )}
    </>
  );
}

function AdminArea() {
  const location = useLocation();
  const navigate = useNavigate();
  const [authorized, setAuthorized] = useState<boolean | null>(null);

  useEffect(() => {
    let current = true;
    getAdminSession()
      .then((session) => { if (current) setAuthorized(session.authenticated); })
      .catch(() => { if (current) setAuthorized(false); });
    return () => { current = false; };
  }, []);

  useEffect(() => {
    if (authorized === false) navigate("/admin/login", { replace: true, state: { from: location.pathname } });
  }, [authorized, location.pathname, navigate]);

  const logout = async () => {
    try {
      await logoutAdmin();
    } finally {
      navigate("/admin/login", { replace: true });
    }
  };

  if (authorized === null || !authorized) {
    return <main className="login-screen"><p className="admin-loading">正在验证管理员会话…</p></main>;
  }

  const path = location.pathname.replace(/\/+$/, "") || "/admin";
  let content: ReactNode;
  if (path === "/admin" || path === "/admin/overview") content = <AdminDashboardPage />;
  else if (path === "/admin/profile") content = <ProfileEditor />;
  else if (path === "/admin/skills") content = <AdminRecordsPage key={path} collection="skills" />;
  else if (path === "/admin/projects") content = <AdminRecordsPage key={path} collection="projects" />;
  else if (path === "/admin/posts") content = <AdminRecordsPage key={path} collection="posts" />;
  else content = <AdminHeader title="页面不存在" detail="请从侧边栏选择管理内容。" />;

  return <AdminShell onLogout={() => void logout()}>{content}</AdminShell>;
}

export function AdminRouter() {
  const location = useLocation();
  if (location.pathname === "/admin/login") return <AdminLoginPage />;
  return <AdminArea />;
}
