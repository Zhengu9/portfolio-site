CREATE TABLE IF NOT EXISTS profile (
  id INTEGER PRIMARY KEY CHECK (id = 1),
  display_name TEXT NOT NULL,
  headline TEXT NOT NULL,
  intro TEXT NOT NULL DEFAULT '',
  location TEXT,
  wechat_id TEXT NOT NULL DEFAULT 'zhengu9',
  avatar_key TEXT,
  resume_key TEXT,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_visible INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS experiences (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL,
  organization TEXT NOT NULL,
  role TEXT NOT NULL,
  start_date TEXT,
  end_date TEXT,
  description TEXT,
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_public INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS projects (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  summary TEXT NOT NULL,
  body_markdown TEXT NOT NULL DEFAULT '',
  role TEXT,
  tech_json TEXT NOT NULL DEFAULT '[]',
  tags_json TEXT NOT NULL DEFAULT '[]',
  cover_key TEXT,
  repo_url TEXT,
  demo_url TEXT,
  start_date TEXT,
  end_date TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published', 'archived')),
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  published_at TEXT
);

CREATE TABLE IF NOT EXISTS posts (
  id TEXT PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  title TEXT NOT NULL,
  excerpt TEXT NOT NULL DEFAULT '',
  body_markdown TEXT NOT NULL DEFAULT '',
  tags_json TEXT NOT NULL DEFAULT '[]',
  cover_key TEXT,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'published')),
  published_at TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS admin_sessions (
  id TEXT PRIMARY KEY,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS login_attempts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  identifier_hash TEXT NOT NULL,
  attempted_at TEXT NOT NULL,
  success INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS media_objects (
  key TEXT PRIMARY KEY,
  kind TEXT NOT NULL CHECK (kind IN ('avatar', 'project-cover', 'resume', 'content-image')),
  content_type TEXT NOT NULL,
  size_bytes INTEGER NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_skills_visible_order ON skills(is_visible, sort_order);
CREATE INDEX IF NOT EXISTS idx_projects_status_order ON projects(status, sort_order);
CREATE INDEX IF NOT EXISTS idx_posts_status_published ON posts(status, published_at);
CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON admin_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_login_attempts_identifier ON login_attempts(identifier_hash, attempted_at);

INSERT OR IGNORE INTO profile (id, display_name, headline, intro, location, wechat_id, updated_at)
VALUES (1, '谷久宁', '全栈开发工程师', '[待填写：个人简介]', '大连海事大学 · 计算机科学与技术', 'zhengu9', datetime('now'));

INSERT OR IGNORE INTO skills (id, category, name, description, sort_order, is_visible, created_at, updated_at) VALUES
  ('skill-python', '编程语言', 'Python', NULL, 1, 1, datetime('now'), datetime('now')),
  ('skill-java', '编程语言', 'Java', NULL, 2, 1, datetime('now'), datetime('now')),
  ('skill-cpp', '编程语言', 'C / C++', NULL, 3, 1, datetime('now'), datetime('now')),
  ('skill-javascript', 'Web 开发', 'JavaScript', NULL, 1, 1, datetime('now'), datetime('now')),
  ('skill-react', 'Web 开发', 'React', '本作品集前端', 2, 1, datetime('now'), datetime('now')),
  ('skill-typescript', 'Web 开发', 'TypeScript', '本作品集前端', 3, 1, datetime('now'), datetime('now')),
  ('skill-vite', 'Web 开发', 'Vite', '本作品集构建工具', 4, 1, datetime('now'), datetime('now')),
  ('skill-tailwind', 'Web 开发', 'Tailwind CSS', '本作品集样式工具', 5, 1, datetime('now'), datetime('now')),
  ('skill-rag', 'AI 与智能系统', 'RAG & Agent', NULL, 1, 1, datetime('now'), datetime('now')),
  ('skill-pytorch', 'AI 与智能系统', 'PyTorch', NULL, 2, 1, datetime('now'), datetime('now')),
  ('skill-ros', 'AI 与智能系统', 'ROS', NULL, 3, 1, datetime('now'), datetime('now'));

INSERT OR IGNORE INTO projects (id, slug, title, summary, body_markdown, tech_json, tags_json, status, sort_order, created_at, updated_at, published_at) VALUES
  ('resume-ship-diagnostics', 'ship-equipment-diagnostic-assistant', '船舶装备故障诊断智能问答系统', '面向船舶设备维护场景，结合 Agentic RAG 与知识图谱组织检索和故障问答。', '项目内容依据已提供简历整理。详细背景、个人贡献与实现说明待补充。', '["Agentic RAG","知识图谱"]', '["智能问答","设备诊断"]', 'published', 1, datetime('now'), datetime('now'), datetime('now')),
  ('resume-autonomous-navigation', 'autonomous-vehicle-navigation', '旷野智行无人车自主导航平台', '基于 ROS 集成视觉、激光雷达与路径规划，完成无人车自主导航实践。', '项目内容依据已提供简历整理。详细背景、个人贡献与实现说明待补充。', '["ROS","机器视觉","激光雷达"]', '["无人车","自主导航"]', 'published', 2, datetime('now'), datetime('now'), datetime('now')),
  ('resume-rag-security', 'rag-knowledge-security', '天盾 RAG 知识库安全防线', '针对 RAG 知识库的提示注入与恶意输入，设计风险检测和回答安全审查流程。', '项目内容依据已提供简历整理。详细背景、个人贡献与实现说明待补充。', '["RAG","安全检测"]', '["提示注入","内容安全"]', 'published', 3, datetime('now'), datetime('now'), datetime('now')),
  ('resume-chronosync', 'chronosync-schedule-assistant', 'ChronoSync 智能日程管理系统', '通过自然语言与 Agent 交互，支持日程创建、查询、删除及统计。', '项目内容依据已提供简历整理。详细背景、个人贡献与实现说明待补充。', '["Agent","RAG","自然语言处理"]', '["日程管理","全栈实践"]', 'published', 4, datetime('now'), datetime('now'), datetime('now')),
  ('resume-weatherlens', 'weatherlens-image-classifier', 'WeatherLens 天气图像分类系统', '使用 PyTorch 完成天气图像多类别分类训练，并比较不同训练策略。', '项目内容依据已提供简历整理。详细背景、个人贡献与实现说明待补充。', '["PyTorch","图像分类"]', '["深度学习","模型评估"]', 'published', 5, datetime('now'), datetime('now'), datetime('now'));
