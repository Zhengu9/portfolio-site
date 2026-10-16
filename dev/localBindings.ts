import { mkdirSync, readFileSync, existsSync } from "node:fs";
import { createReadStream } from "node:fs";
import { writeFile } from "node:fs/promises";
import { dirname, resolve, sep } from "node:path";
import { Readable } from "node:stream";
import { fileURLToPath } from "node:url";
import { DatabaseSync, type SQLInputValue } from "node:sqlite";

const projectRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function readLocalVars() {
  const path = resolve(projectRoot, ".dev.vars");
  if (!existsSync(path)) {
    throw new Error("Missing .dev.vars. Run `npm run setup:admin` to create local admin credentials.");
  }
  return Object.fromEntries(
    readFileSync(path, "utf8")
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith("#"))
      .map((line) => {
        const separator = line.indexOf("=");
        return [line.slice(0, separator), line.slice(separator + 1)];
      }),
  );
}

class LocalD1Statement {
  private values: unknown[] = [];

  constructor(private readonly database: DatabaseSync, private readonly sql: string) {}

  bind(...values: unknown[]) {
    this.values = values;
    return this;
  }

  async first<T = Record<string, unknown>>(columnName?: string): Promise<T | null> {
    const row = this.database.prepare(this.sql).get(...this.values as SQLInputValue[]) as Record<string, unknown> | undefined;
    const value = columnName ? row?.[columnName] ?? null : row ?? null;
    return value as T | null;
  }

  async all<T = Record<string, unknown>>() {
    return { results: this.database.prepare(this.sql).all(...this.values as SQLInputValue[]) as T[], success: true };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values as SQLInputValue[]);
    return {
      success: true,
      meta: { changes: Number(result.changes), last_row_id: Number(result.lastInsertRowid) },
    };
  }
}

class LocalD1 {
  constructor(private readonly database: DatabaseSync) {}

  prepare(sql: string) {
    return new LocalD1Statement(this.database, sql);
  }

  async batch(statements: LocalD1Statement[]) {
    this.database.exec("BEGIN");
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.run());
      this.database.exec("COMMIT");
      return results;
    } catch (error) {
      this.database.exec("ROLLBACK");
      throw error;
    }
  }
}

class LocalR2 {
  constructor(private readonly root: string) {}

  private pathFor(key: string) {
    const path = resolve(this.root, key);
    if (!path.startsWith(`${this.root}${sep}`)) throw new Error("Invalid local media key");
    return path;
  }

  async put(key: string, value: ArrayBuffer | ArrayBufferView | ReadableStream, _options?: unknown) {
    const path = this.pathFor(key);
    mkdirSync(dirname(path), { recursive: true });
    const bytes = value instanceof ReadableStream
      ? Buffer.from(await new Response(value).arrayBuffer())
      : value instanceof ArrayBuffer
        ? Buffer.from(value)
        : Buffer.from(value.buffer, value.byteOffset, value.byteLength);
    await writeFile(path, bytes);
    return { key };
  }

  async get(key: string) {
    const path = this.pathFor(key);
    if (!existsSync(path)) return null;
    return { body: Readable.toWeb(createReadStream(path)) };
  }
}

export function createLocalBindings() {
  const vars = readLocalVars();
  const localRoot = resolve(projectRoot, ".local");
  const databasePath = resolve(localRoot, "portfolio.sqlite");
  const mediaPath = resolve(localRoot, "media");
  mkdirSync(localRoot, { recursive: true });
  mkdirSync(mediaPath, { recursive: true });

  const database = new DatabaseSync(databasePath);
  database.exec(readFileSync(resolve(projectRoot, "migrations/0001_initial.sql"), "utf8"));

  return {
    env: {
      DB: new LocalD1(database),
      MEDIA: new LocalR2(mediaPath),
      ADMIN_USERNAME: vars.ADMIN_USERNAME,
      ADMIN_PASSWORD_HASH: vars.ADMIN_PASSWORD_HASH,
      SESSION_SECRET: vars.SESSION_SECRET,
      SITE_ORIGIN: process.env.SITE_ORIGIN,
    },
    close: () => database.close(),
  };
}
