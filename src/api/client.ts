import type { SiteContent } from "../types/content";

interface ApiResponse<T> {
  data: T;
}

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

export async function apiRequest<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const response = await fetch(path, {
    ...init,
    credentials: "same-origin",
    headers: {
      Accept: "application/json",
      ...(init.body instanceof FormData ? {} : { "Content-Type": "application/json" }),
      ...init.headers,
    },
  });
  const contentType = response.headers.get("content-type") ?? "";
  if (!contentType.includes("application/json")) {
    throw new ApiError(
      "本地预览未连接内容服务，项目数据暂不可用。",
      response.status || 503,
    );
  }
  const payload = (await response.json().catch(() => null)) as
    | ApiResponse<T>
    | { error?: { message?: string } }
    | null;

  if (!response.ok) {
    throw new ApiError(
      payload && "error" in payload
        ? (payload.error?.message ?? "内容服务暂时不可用，请稍后重试。")
        : "内容服务暂时不可用，请稍后重试。",
      response.status,
    );
  }

  return payload && "data" in payload ? payload.data : (payload as T);
}

export function getSiteContent(signal?: AbortSignal): Promise<SiteContent> {
  return apiRequest<SiteContent>("/api/public/site", { signal });
}
