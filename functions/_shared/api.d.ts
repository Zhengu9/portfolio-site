interface D1Result<T = Record<string, unknown>> {
  results?: T[];
  success?: boolean;
  meta?: { changes?: number; last_row_id?: number };
  changes?: number;
}

interface D1Statement {
  bind(...values: unknown[]): D1Statement;
  first<T = Record<string, unknown>>(columnName?: string): Promise<T | null>;
  all<T = Record<string, unknown>>(): Promise<D1Result<T>>;
  run(): Promise<D1Result>;
}

interface PortfolioEnv {
  DB: { prepare(sql: string): D1Statement };
  MEDIA: {
    put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, options?: unknown): Promise<unknown>;
    get(key: string): Promise<{ body: ReadableStream } | null>;
  };
  ADMIN_USERNAME: string;
  ADMIN_PASSWORD_HASH: string;
  SESSION_SECRET: string;
  SITE_ORIGIN?: string;
}

export function handleApiRequest(request: Request, env: PortfolioEnv): Promise<Response>;
export function handleMediaRequest(request: Request, env: PortfolioEnv, key: string): Promise<Response>;
