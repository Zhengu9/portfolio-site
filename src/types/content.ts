export interface Profile {
  display_name: string;
  headline: string;
  intro: string;
  location: string | null;
  wechat_id: string;
  wechat_qr_url: string | null;
  avatar_url: string | null;
  resume_url: string | null;
  updated_at?: string;
}

export interface Skill {
  id: string;
  category: string;
  name: string;
  description: string | null;
  sort_order: number;
}

export interface Experience {
  id: string;
  type: string;
  organization: string;
  role: string;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
}

export interface Project {
  id: string;
  slug: string;
  title: string;
  summary: string;
  body_markdown: string;
  role: string | null;
  tech: string[];
  tags: string[];
  cover_url: string | null;
  repo_url: string | null;
  demo_url: string | null;
  start_date: string | null;
  end_date: string | null;
}

export interface Post {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  body_markdown: string;
  tags: string[];
  cover_url: string | null;
  published_at: string | null;
}

export interface SiteContent {
  profile: Profile | null;
  skills: Skill[];
  experiences: Experience[];
  projects: Project[];
  posts: Post[];
}
