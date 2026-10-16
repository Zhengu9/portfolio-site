import {
  ArrowDownRight,
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  CodeXml,
  Copy,
  Download,
  ExternalLink,
  Layers3,
  Menu,
  Orbit,
  PanelTop,
  QrCode,
  TerminalSquare,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import {
  BrowserRouter,
  Link,
  NavLink,
  Route,
  Routes,
  useLocation,
  useNavigate,
  useParams,
} from "react-router-dom";
import { useSiteContent } from "../hooks/useSiteContent";
import { useReveal } from "../hooks/useReveal";
import { AdminRouter } from "./AdminApp";
import type { Project, SiteContent } from "../types/content";
import { Starfield } from "../components/Starfield";
import { LightTrails } from "../components/LightTrails";
import { MarkdownContent } from "../components/MarkdownContent";
import { confirmedDisplayName, confirmedWechatId, rotatingCapabilities } from "../content/brand";
import { previewSkills } from "../content/previewSkills";
import { resumeProjects } from "../content/resumeProjects";

const navItems = [
  { to: "/#home", label: "关于" },
  { to: "/#skills", label: "能力" },
  { to: "/projects", label: "项目" },
  { to: "/blog", label: "博客" },
];

const contactHeadline = "开始交流。";
const contactCharacters = Array.from(contactHeadline);
const typewriterCharacterDelay = 130;
const typewriterCompletePause = 1800;
const typewriterResetPause = 240;

function getNavigationTarget(id: string) {
  return id === "skills"
    ? document.querySelector<HTMLElement>(".home-content-panel")
    : document.getElementById(id);
}

function usePageData() {
  const state = useSiteContent();
  useReveal(state.status);
  return state;
}

function TypewriterContactHeadline() {
  const [visibleCount, setVisibleCount] = useState(0);

  useEffect(() => {
    const panel = document.querySelector<HTMLElement>(".home-project-panel");
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!panel) return;

    let timerId = 0;
    let characterIndex = 0;
    let active: boolean | null = null;

    const clearTimer = () => window.clearTimeout(timerId);
    const typeNextCharacter = () => {
      characterIndex += 1;
      setVisibleCount(characterIndex);
      timerId = window.setTimeout(() => {
        if (characterIndex === contactCharacters.length) {
          setVisibleCount(0);
          characterIndex = 0;
          timerId = window.setTimeout(typeNextCharacter, typewriterResetPause);
          return;
        }
        typeNextCharacter();
      }, characterIndex === contactCharacters.length ? typewriterCompletePause : typewriterCharacterDelay);
    };
    const syncAnimation = () => {
      const shouldAnimate = panel.classList.contains("is-current") && !reducedMotion.matches;
      if (shouldAnimate === active) return;

      active = shouldAnimate;
      clearTimer();
      if (!active) {
        setVisibleCount(reducedMotion.matches ? contactCharacters.length : 0);
        return;
      }

      characterIndex = 0;
      setVisibleCount(0);
      timerId = window.setTimeout(typeNextCharacter, typewriterCharacterDelay);
    };

    const observer = new MutationObserver(syncAnimation);
    observer.observe(panel, { attributeFilter: ["class"], attributes: true });
    reducedMotion.addEventListener("change", syncAnimation);
    syncAnimation();

    return () => {
      clearTimer();
      observer.disconnect();
      reducedMotion.removeEventListener("change", syncAnimation);
    };
  }, []);

  return (
    <h2 aria-label={`从一个问题，${contactHeadline}`}>
      从一个问题，
      <em aria-hidden="true">
        {contactCharacters.slice(0, visibleCount).map((character, index) => (
          <span className="contact-typewriter-character" key={`${character}-${index}`}>
            {character}
          </span>
        ))}
        <span className="contact-typewriter-caret" />
      </em>
    </h2>
  );
}

function PublicHeader() {
  const [open, setOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();

  const close = () => setOpen(false);
  const goToSection = (id: string) => {
    close();
    if (location.pathname !== "/") {
      navigate(`/#${id}`);
      return;
    }
    getNavigationTarget(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <header className="topbar">
      <Link className="brand-mark" to="/" aria-label="返回首页">
        <span className="brand-glyph">G</span>
        <span className="brand-name">JIUNING GU</span>
      </Link>
      <nav className={`main-nav${open ? " is-open" : ""}`} aria-label="主导航">
        {navItems.map((item) =>
          item.to.startsWith("/#") ? (
            <button
              className="nav-link"
              key={item.to}
              onClick={() => goToSection(item.to.slice(2))}
              type="button"
            >
              {item.label}
            </button>
          ) : (
            <NavLink
              className={({ isActive }) => `nav-link${isActive ? " is-active" : ""}`}
              key={item.to}
              onClick={close}
              to={item.to}
            >
              {item.label}
            </NavLink>
          ),
        )}
      </nav>
      <button className="contact-pill" onClick={() => goToSection("contact")} type="button">
        <span className="status-dot" />
        <span>微信联系</span>
        <ArrowUpRight size={14} aria-hidden="true" />
      </button>
      <Link className="admin-entry" to="/admin/login" aria-label="管理员入口">
        管理员 <ExternalLink size={13} aria-hidden="true" />
      </Link>
      <button
        aria-expanded={open}
        aria-label={open ? "关闭导航菜单" : "打开导航菜单"}
        className="mobile-menu-button icon-button"
        onClick={() => setOpen((value) => !value)}
        type="button"
      >
        {open ? <X size={20} /> : <Menu size={20} />}
      </button>
    </header>
  );
}

function ApiState({ status, message }: { status: "loading" | "error"; message?: string }) {
  return (
    <div className={`api-state api-state-${status}`} role={status === "error" ? "alert" : "status"}>
      <span className="api-state-mark" aria-hidden="true">
        {status === "loading" ? "…" : "!"}
      </span>
      <span>{status === "loading" ? "正在载入作品集内容" : message}</span>
    </div>
  );
}

function Portrait({ url, name }: { url: string | null | undefined; name: string }) {
  if (!url) {
    return (
      <div className="portrait-fallback" aria-label={`${name}的头像待上传`}>
        <Orbit size={38} strokeWidth={1} aria-hidden="true" />
        <span>头像待上传</span>
      </div>
    );
  }

  return <img className="portrait-image" src={url} alt={`${name}的头像`} />;
}

function ProjectArtwork({ project, index }: { project: Project; index: number }) {
  if (project.cover_url) {
    return <img className="project-cover-image" src={project.cover_url} alt="" loading="lazy" />;
  }

  const motifs = [
    <Orbit key="orbit" size={74} strokeWidth={0.75} />,
    <Layers3 key="layers" size={76} strokeWidth={0.75} />,
    <PanelTop key="panel" size={74} strokeWidth={0.75} />,
    <BookOpen key="book" size={74} strokeWidth={0.75} />,
    <TerminalSquare key="terminal" size={74} strokeWidth={0.75} />,
  ];

  return (
    <div className={`project-artwork artwork-${index % 5}`} aria-hidden="true">
      <span className="artwork-index">FIELD NOTE / {String(index + 1).padStart(2, "0")}</span>
      <span className="artwork-motif">{motifs[index % motifs.length]}</span>
      <span className="artwork-baseline">{project.tags[0] ?? "PROJECT"}</span>
      <i className="artwork-star star-one" />
      <i className="artwork-star star-two" />
    </div>
  );
}

function ProjectCard({ project, index }: { project: Project; index: number }) {
  return (
    <article className="project-row" data-reveal>
      <Link className="project-art-link" to={`/projects/${project.slug}`}>
        <ProjectArtwork project={project} index={index} />
        <span className="project-open" aria-hidden="true">
          <ArrowUpRight size={18} />
        </span>
      </Link>
      <div className="project-copy">
        <div className="project-meta">
          <span>项目 {String(index + 1).padStart(2, "0")}</span>
          {project.role && <span>{project.role}</span>}
        </div>
        <h3>
          <Link to={`/projects/${project.slug}`}>{project.title}</Link>
        </h3>
        <p>{project.summary}</p>
        <div className="tag-list" aria-label="项目标签">
          {project.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
        </div>
      </div>
    </article>
  );
}

function SectionHeading({
  index,
  eyebrow,
  title,
  aside,
}: {
  index: string;
  eyebrow: string;
  title: string;
  aside?: string;
}) {
  return (
    <div className="section-heading" data-reveal>
      <div>
        <p className="section-kicker"><span>{index}</span>{eyebrow}</p>
        <h2>{title}</h2>
      </div>
      {aside && <p className="section-aside">{aside}</p>}
    </div>
  );
}

function SkillGroups({ skills }: { skills: SiteContent["skills"] }) {
  if (skills.length === 0) {
    return <p className="content-placeholder">[待填写：全栈开发与 Web 技能内容]</p>;
  }

  const groups = skills.reduce<Record<string, typeof skills>>((result, skill) => {
    (result[skill.category] ??= []).push(skill);
    return result;
  }, {});

  return (
    <div className="skill-groups">
      {Object.entries(groups).map(([category, entries], groupIndex) => (
        <section className="skill-group" data-reveal key={category}>
          <div className="skill-group-label">
            <span>{String(groupIndex + 1).padStart(2, "0")}</span>
            <h3>{category}</h3>
          </div>
          <div className="skill-items">
            {entries.map((skill) => (
              <article className="skill-item" key={skill.id}>
                <div className="skill-item-heading">
                  <h4>{skill.name}</h4>
                  <ArrowUpRight size={14} aria-hidden="true" />
                </div>
                {skill.description && <p>{skill.description}</p>}
              </article>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function RotatingCapability() {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    const motionPreference = window.matchMedia("(prefers-reduced-motion: reduce)");
    let intervalId = 0;
    const syncMotion = () => {
      window.clearInterval(intervalId);
      if (!motionPreference.matches) {
        intervalId = window.setInterval(() => {
          setActiveIndex((index) => (index + 1) % rotatingCapabilities.length);
        }, 1900);
      }
    };
    syncMotion();
    motionPreference.addEventListener("change", syncMotion);
    return () => {
      window.clearInterval(intervalId);
      motionPreference.removeEventListener("change", syncMotion);
    };
  }, []);

  return (
    <div className="hero-capability" aria-label={`技术能力：${rotatingCapabilities.join("、")}`}>
          <span className="capability-prefix" aria-hidden="true">核心技术</span>
      <span className="capability-window" aria-hidden="true">
        <span className="capability-word" key={activeIndex}>
          {rotatingCapabilities[activeIndex]}
        </span>
      </span>
      <span className="sr-only">{rotatingCapabilities.join("、")}</span>
    </div>
  );
}

function HomePage() {
  const state = usePageData();
  const [copied, setCopied] = useState(false);
  const [copyFailed, setCopyFailed] = useState(false);
  const content = state.status === "ready" ? state.content : null;
  const profile = content?.profile;
  const projects = content ? content.projects : resumeProjects;
  const skills = content ? content.skills : previewSkills;
  const education = content?.experiences.filter((item) => item.type === "education") ?? [];

  useEffect(() => {
    const panels = Array.from(document.querySelectorAll<HTMLElement>(".home-page-panel"));
    const header = document.querySelector<HTMLElement>(".topbar");
    let activeIndex = 0;
    let locked = false;

    const goToPage = (index: number) => {
      const nextIndex = Math.max(0, Math.min(index, panels.length - 1));
      if (nextIndex === activeIndex || locked) return;
      activeIndex = nextIndex;
      locked = true;
      panels.forEach((panel, panelIndex) => panel.classList.toggle("is-current", panelIndex === nextIndex));
      const top = Math.max(
        0,
        window.scrollY + panels[nextIndex].getBoundingClientRect().top - (header?.offsetHeight ?? 0),
      );
      const behavior = window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
      window.scrollTo({ top, behavior });
      window.setTimeout(() => { locked = false; }, 820);
    };

    const syncActivePage = () => {
      if (locked) return;
      const marker = (header?.offsetHeight ?? 0) + window.innerHeight * 0.45;
      const nextIndex = panels.findIndex((panel) => {
        const bounds = panel.getBoundingClientRect();
        return marker >= bounds.top && marker < bounds.bottom;
      });
      if (nextIndex >= 0) {
        activeIndex = nextIndex;
        panels.forEach((panel, panelIndex) => panel.classList.toggle("is-current", panelIndex === nextIndex));
      }
    };

    const onWheel = (event: WheelEvent) => {
      if (event.ctrlKey || Math.abs(event.deltaY) < 12) return;
      event.preventDefault();
      goToPage(activeIndex + (event.deltaY > 0 ? 1 : -1));
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target instanceof HTMLElement ? event.target : null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      if (event.key === " " && target?.closest("a, button")) return;
      if (["PageDown", "ArrowDown", " "].includes(event.key)) {
        event.preventDefault();
        goToPage(activeIndex + 1);
      } else if (["PageUp", "ArrowUp"].includes(event.key)) {
        event.preventDefault();
        goToPage(activeIndex - 1);
      } else if (event.key === "Home") {
        event.preventDefault();
        goToPage(0);
      } else if (event.key === "End") {
        event.preventDefault();
        goToPage(panels.length - 1);
      }
    };
    panels.forEach((panel, index) => panel.classList.toggle("is-current", index === 0));
    window.addEventListener("wheel", onWheel, { passive: false });
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("scroll", syncActivePage, { passive: true });
    return () => {
      window.removeEventListener("wheel", onWheel);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("scroll", syncActivePage);
    };
  }, []);

  const copyWechat = async () => {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(confirmedWechatId);
      } else {
        throw new Error("Clipboard API unavailable");
      }
      setCopied(true);
      setCopyFailed(false);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      const field = document.createElement("textarea");
      field.value = confirmedWechatId;
      field.setAttribute("readonly", "");
      field.style.position = "fixed";
      field.style.opacity = "0";
      document.body.appendChild(field);
      field.select();
      const succeeded = document.execCommand("copy");
      field.remove();
      setCopied(succeeded);
      setCopyFailed(!succeeded);
      window.setTimeout(() => {
        setCopied(false);
        setCopyFailed(false);
      }, 2200);
    }
  };

  return (
    <div className="home-pages">
      <section className="home-page-panel home-hero-panel" id="home">
        <div className="page-motion">
          <LightTrails variant="hero" />
          <div className="hero section-wrap">
            <div className="hero-copy">
              <p className="hero-kicker"><span className="pulse-dot" /> 全栈开发 · AI 应用 · 智能系统</p>
              <h1>
                <span className="hero-name">{profile?.display_name ?? confirmedDisplayName}</span>
                <span className="hero-role">{profile?.headline ?? "全栈开发工程师"}</span>
              </h1>
              <RotatingCapability />
              <p className="hero-intro">
                {profile?.intro ?? "[待填写：用简短的话介绍你的技术方向与关注的问题]"}
              </p>
              <div className="hero-actions">
                <Link className="button button-primary" to="/projects">
                  浏览项目 <ArrowDownRight size={16} aria-hidden="true" />
                </Link>
                {profile?.resume_url ? (
                  <a className="button button-quiet" href={profile.resume_url} download>
                    下载简历 <Download size={15} aria-hidden="true" />
                  </a>
                ) : (
                  <span className="button button-quiet button-disabled" aria-disabled="true">
                    简历待上传 <Download size={15} aria-hidden="true" />
                  </span>
                )}
              </div>
              {state.status === "loading" && <ApiState status="loading" />}
              <div className="hero-footnote">
                <span>大连海事大学 · 计算机科学与技术（拔尖实验班）</span>
              </div>
            </div>
            <div className="hero-portrait-wrap">
              <span className="portrait-coordinate">38°52′N&nbsp; 121°33′E</span>
              <div className="portrait-frame">
                <span className="portrait-frame-index">PROFILE / 01</span>
                <Portrait url={profile?.avatar_url} name={profile?.display_name ?? "个人"} />
                <span className="portrait-frame-caption">JIUNING&nbsp; GU</span>
              </div>
              <span className="portrait-orbit orbit-a" aria-hidden="true" />
              <span className="portrait-orbit orbit-b" aria-hidden="true" />
              <span className="portrait-side-note">BUILD WITH INTENT</span>
            </div>
            <a className="scroll-cue" href="#about">
              <span>向下探索</span><span className="scroll-line" />
            </a>
          </div>
        </div>
      </section>

      <section className="home-page-panel home-content-panel">
        <div className="page-motion">
          <section className="intro-band section-wrap" id="about">
            <SectionHeading index="01" eyebrow="PROFILE" title="把复杂问题，拆成清晰的系统。" />
            <div className="intro-content" data-reveal>
              <p className="intro-lead">
                {profile?.intro ?? "[待填写：个人介绍]"}
              </p>
              <div className="education-note">
                <span className="education-mark">EDU</span>
                <div>
              {education.map((item) => (
                    <div className="education-entry" key={item.id}>
                      <strong>{item.organization}</strong>
                      <span>{item.role}</span>
                      <small>{item.start_date} — {item.end_date ?? "至今"}</small>
                    </div>
                  ))}
              {education.length === 0 && (
                <div className="education-entry">
                  <strong>大连海事大学</strong>
                  <span>计算机科学与技术 · 拔尖实验班</span>
                </div>
              )}
                </div>
              </div>
            </div>
          </section>

          <section className="skills-section section-wrap" id="skills">
            <SectionHeading
              index=""
              eyebrow="CAPABILITIES"
              title="从浏览器，到服务与数据。"
            />
            <SkillGroups skills={skills} />
          </section>

          <section className="home-selected-work section-wrap" aria-labelledby="selected-work-title">
            <div className="selected-work-heading">
              <div>
                <p className="section-kicker">SELECTED WORK</p>
                <h2 id="selected-work-title">从想法到可运行的系统。</h2>
              </div>
              <Link className="text-link" to="/projects">查看全部项目 <ArrowRight size={15} /></Link>
            </div>
            <div className="home-project-grid">
              {projects.map((project, index) => (
                <ProjectCard key={project.id} project={project} index={index} />
              ))}
            </div>
          </section>
        </div>
      </section>

      <section className="home-page-panel home-project-panel">
        <div className="page-motion">
          <LightTrails variant="contact" />
          <section className="contact-page section-wrap" id="contact">
            <div className="contact-page-heading">
              <div>
                <p className="section-kicker">LET'S CONNECT</p>
                <TypewriterContactHeadline />
              </div>
            </div>

            <div className="contact-layout">
              <div className="wechat-card">
                <div className="wechat-card-top">
                  <span className="wechat-label">WECHAT ID</span>
                </div>
                <div className="wechat-id-row">
                  <strong>{confirmedWechatId}</strong>
                  <button className="copy-button copy-button-large" onClick={copyWechat} type="button">
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? "已复制" : "复制微信号"}
                  </button>
                </div>
                <p className={`copy-feedback${copyFailed ? " is-error" : ""}`} aria-live="polite">
                  {copyFailed ? "复制未成功，请手动复制微信号。" : copied ? "微信号已复制到剪贴板。" : "欢迎添加微信，一起交流技术与想法。"}
                </p>
                <div className="contact-topics">
                  <span>FULL-STACK</span><span>AI APPLICATIONS</span><span>ROBOTICS</span>
                </div>
              </div>

              <div className="wechat-qr-panel">
                {profile?.wechat_qr_url
                  ? <img className="wechat-qr-image" src={profile.wechat_qr_url} alt="微信二维码" />
                  : <div className="qr-placeholder" role="img" aria-label="微信二维码待上传">
                      <div className="qr-placeholder-frame"><QrCode size={42} strokeWidth={1} /></div>
                      <span>二维码待上传</span>
                    </div>}
                <div className="qr-caption">
                  <span className="wechat-label">SCAN TO ADD</span>
                  <p>{profile?.wechat_qr_url ? "扫码添加微信" : "微信二维码将在上传真实图片后显示"}</p>
                </div>
              </div>
            </div>

            <div className="contact-bottom">
              <Link className="contact-admin-link" to="/admin/login">管理员入口 <ArrowUpRight size={15} /></Link>
            </div>
          </section>
        </div>
      </section>
    </div>
  );
}

function ProjectListPage() {
  const state = usePageData();
  const projects = state.status === "ready" ? state.content.projects : resumeProjects;
  return (
    <section className="inner-page section-wrap">
      <PageTitle index="PROJECT ARCHIVE" title="项目实践" subtitle="五个项目，从领域问题到可运行的系统。" />
      {state.status === "loading" && <ApiState status="loading" />}
      {projects.length > 0 ? (
        <div className="project-list">
          {projects.map((project, index) => (
            <ProjectCard key={project.id} project={project} index={index} />
          ))}
        </div>
      ) : <p className="content-placeholder">[待填写：项目内容]</p>}
    </section>
  );
}

function ProjectDetailPage() {
  const { slug } = useParams();
  const state = usePageData();
  const project = (state.status === "ready" ? state.content.projects : [])
    .find((item) => item.slug === slug)
    ?? null;

  if (state.status === "loading") return <section className="inner-page section-wrap"><ApiState status="loading" /></section>;
  if (state.status === "error" && !project) return <section className="inner-page section-wrap"><ApiState status="error" message={state.message} /></section>;
  if (!project) return <section className="inner-page section-wrap"><PageTitle index="PROJECT" title="项目未找到" subtitle="这个项目可能尚未发布。" /><Link className="text-link" to="/projects">返回项目列表 <ArrowRight size={16} /></Link></section>;

  return (
    <article className="inner-page project-detail section-wrap">
      <Link className="back-link" to="/projects">← 返回项目</Link>
      <PageTitle index="PROJECT DETAIL" title={project.title} subtitle={project.summary} />
      <ProjectArtwork project={project} index={0} />
      <div className="detail-meta">
        {project.role && <span><small>角色</small>{project.role}</span>}
        <span><small>周期</small>{project.start_date ?? "[待补充]"} — {project.end_date ?? "[待补充]"}</span>
      </div>
      <div className="tag-list">{project.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
      <MarkdownContent content={project.body_markdown || "[待填写：项目背景、方案、本人贡献与结果]"} />
      {(project.repo_url || project.demo_url) && (
        <div className="project-links">
          {project.repo_url && <a href={project.repo_url} target="_blank" rel="noreferrer"><CodeXml size={16} />源代码</a>}
          {project.demo_url && <a href={project.demo_url} target="_blank" rel="noreferrer"><ArrowUpRight size={16} />在线演示</a>}
        </div>
      )}
    </article>
  );
}

function BlogPage() {
  const state = usePageData();
  return (
    <section className="inner-page section-wrap">
      <PageTitle index="BLOG" title="博客" subtitle="目前没有公开文章。" />
      {state.status === "loading" && <ApiState status="loading" />}
      {state.status === "ready" && state.content.posts.length > 0 ? (
        <div className="note-list note-list-page">
          {state.content.posts.map((post) => (
            <Link className="note-row" key={post.id} to={`/blog/${post.slug}`}>
              <span>{post.title}<small>{post.excerpt}</small></span>
              <ArrowUpRight size={16} />
            </Link>
          ))}
        </div>
      ) : state.status === "ready" || state.status === "error" ? (
        <div className="empty-state"><BookOpen size={22} /><p>目前没有公开文章。</p></div>
      ) : null}
    </section>
  );
}

function BlogDetailPage() {
  const { slug } = useParams();
  const state = usePageData();
  const post = state.status === "ready" ? state.content.posts.find((item) => item.slug === slug) ?? null : null;

  if (state.status === "loading") return <section className="inner-page section-wrap"><ApiState status="loading" /></section>;
  if (state.status === "error") return <section className="inner-page section-wrap"><ApiState status="error" message={state.message} /></section>;
  if (!post) return (
    <section className="inner-page section-wrap">
      <PageTitle index="BLOG" title="文章未找到" subtitle="这篇文章可能尚未发布。" />
      <Link className="text-link" to="/blog">返回博客 <ArrowRight size={16} /></Link>
    </section>
  );

  return (
    <article className="inner-page project-detail section-wrap">
      <Link className="back-link" to="/blog">← 返回博客</Link>
      <PageTitle index="BLOG" title={post.title} subtitle={post.excerpt} />
      {post.cover_url && <img className="blog-cover-image" src={post.cover_url} alt="" />}
      <div className="tag-list">{post.tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}</div>
      <MarkdownContent content={post.body_markdown} />
    </article>
  );
}

function PageTitle({ index, title, subtitle }: { index: string; title: string; subtitle: string }) {
  return (
    <header className="page-title" data-reveal>
      <p className="section-kicker"><span>↗</span>{index}</p>
      <h1>{title}</h1>
      <p>{subtitle}</p>
    </header>
  );
}

function SiteFooter() {
  return (
    <footer className="site-footer">
      <span>© {new Date().getFullYear()} 谷久宁</span>
      <span>全栈开发工程师 <i /> 个人作品集</span>
      <Link to="/admin/login">管理入口</Link>
    </footer>
  );
}

function PublicLayout() {
  const location = useLocation();
  const isAdmin = location.pathname.startsWith("/admin");
  useEffect(() => {
    document.documentElement.classList.toggle("home-paging", location.pathname === "/");
    document.documentElement.classList.toggle("admin-page", location.pathname.startsWith("/admin"));
    return () => {
      document.documentElement.classList.remove("home-paging");
      document.documentElement.classList.remove("admin-page");
    };
  }, [location.pathname]);
  useEffect(() => {
    if (location.pathname !== "/" || !location.hash) return;
    const frame = window.requestAnimationFrame(() => {
      getNavigationTarget(decodeURIComponent(location.hash.slice(1)))
        ?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [location.hash, location.pathname]);

  if (isAdmin) {
    return <AdminRouter />;
  }

  return (
    <div className={`site-shell${location.pathname === "/" ? " is-home" : ""}`}>
      <Starfield />
      <PublicHeader />
      <main id="main-content">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/projects" element={<ProjectListPage />} />
          <Route path="/projects/:slug" element={<ProjectDetailPage />} />
          <Route path="/blog" element={<BlogPage />} />
          <Route path="/blog/:slug" element={<BlogDetailPage />} />
          <Route path="*" element={<section className="inner-page section-wrap"><PageTitle index="404" title="页面未找到" subtitle="这个地址暂时没有对应内容。" /></section>} />
        </Routes>
      </main>
      <SiteFooter />
    </div>
  );
}

export function App() {
  return (
    <BrowserRouter>
      <PublicLayout />
    </BrowserRouter>
  );
}
