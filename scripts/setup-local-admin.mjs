import { randomBytes, pbkdf2Sync } from "node:crypto";
import { existsSync, writeFileSync } from "node:fs";

const path = new URL("../.dev.vars", import.meta.url);
const force = process.argv.includes("--force");
if (existsSync(path) && !force) {
  console.error(".dev.vars already exists. Use --force to rotate local credentials.");
  process.exit(1);
}

const username = "admin";
const password = randomBytes(18).toString("base64url");
const salt = randomBytes(16);
const iterations = 240_000;
const derivedKey = pbkdf2Sync(password, salt, iterations, 32, "sha256").toString("base64url");
const passwordHash = `$pbkdf2-sha256$${iterations}$${salt.toString("base64url")}$${derivedKey}`;
const sessionSecret = randomBytes(32).toString("base64url");

writeFileSync(
  path,
  [
    `ADMIN_USERNAME=${username}`,
    `ADMIN_PASSWORD_HASH=${passwordHash}`,
    `SESSION_SECRET=${sessionSecret}`,
    `E2E_ADMIN_PASSWORD=${password}`,
    "",
  ].join("\n"),
  { mode: 0o600 },
);

console.log("Local admin credentials generated.");
console.log(`Username: ${username}`);
console.log(`Password: ${password}`);
console.log("Keep these local credentials private. They are not used in the production Pages deployment.");
