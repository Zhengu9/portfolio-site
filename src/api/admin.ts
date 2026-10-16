import { apiRequest } from "./client";
import type { Post, Profile, Project, Skill } from "../types/content";

export type EditableProfile = Profile & {
  avatar_key: string | null;
  resume_key: string | null;
  wechat_qr_key: string | null;
};

export interface AdminDashboard {
  skills: number;
  projects: number;
  posts: number;
}

export type CollectionName = "skills" | "projects" | "posts";
export type AdminRecord = Skill | Project | Post;
export type UploadKind = "avatar" | "project-cover" | "resume" | "content-image" | "wechat-qr";

export function getAdminSession() {
  return apiRequest<{ authenticated: boolean }>("/api/admin/auth/session");
}

export function loginAdmin(username: string, password: string) {
  return apiRequest<{ authenticated: true; expires_at: string }>("/api/admin/auth/login", {
    method: "POST",
    headers: { "X-Login-Name": username },
    body: JSON.stringify({ username, password }),
  });
}

export function logoutAdmin() {
  return apiRequest<{ authenticated: false }>("/api/admin/auth/logout", { method: "POST" });
}

export function getAdminDashboard() {
  return apiRequest<AdminDashboard>("/api/admin/dashboard");
}

export function getAdminProfile() {
  return apiRequest<EditableProfile>("/api/admin/profile");
}

export function saveAdminProfile(profile: EditableProfile) {
  return apiRequest<EditableProfile>("/api/admin/profile", {
    method: "PUT",
    body: JSON.stringify(profile),
  });
}

export function getAdminRecords<T extends AdminRecord>(collection: CollectionName) {
  return apiRequest<T[]>(`/api/admin/${collection}`);
}

export function saveAdminRecord<T extends AdminRecord>(
  collection: CollectionName,
  record: Record<string, unknown>,
  id?: string,
) {
  return apiRequest<T>(`/api/admin/${collection}${id ? `/${encodeURIComponent(id)}` : ""}`, {
    method: id ? "PUT" : "POST",
    body: JSON.stringify(record),
  });
}

export function deleteAdminRecord(collection: CollectionName, id: string) {
  return apiRequest<{ deleted: true }>(`/api/admin/${collection}/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
}

export function uploadAdminFile(file: File, kind: UploadKind) {
  const form = new FormData();
  form.set("file", file);
  form.set("kind", kind);
  return apiRequest<{ key: string; url: string; content_type: string; size_bytes: number }>(
    "/api/admin/uploads",
    { method: "POST", body: form },
  );
}
