import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
export const repoRoot = path.resolve(scriptDir, "..");
export const mirrorDir = path.join(repoRoot, ".mirror");

export function loadMirrorEnv() {
  dotenv.config({ path: path.join(repoRoot, ".env") });
  dotenv.config({ path: path.join(repoRoot, ".env.local-mirror"), override: true });

  process.env.LOCAL_MONGO_URI ||= "mongodb://127.0.0.1:27017/mauli-car-world";
}

export function requireEnv(name) {
  const value = process.env[name]?.trim();
  if (!value) {
    throw new Error(`${name} is required. Add it to .env.local-mirror or your shell environment.`);
  }

  return value;
}

export function getMongoDatabaseName(uri, envName) {
  const parsed = new URL(uri);
  const dbName = decodeURIComponent(parsed.pathname.replace(/^\/+/, "").split("/")[0] || "");

  if (!dbName) {
    throw new Error(`${envName} must include a database name, for example mongodb://host:27017/mauli-car-world`);
  }

  return dbName;
}

export function assertLocalMongoUri(uri) {
  const parsed = new URL(uri);
  if (parsed.protocol === "mongodb+srv:") {
    throw new Error("LOCAL_MONGO_URI must point at local MongoDB, not mongodb+srv.");
  }

  const allowedHosts = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0", "host.docker.internal", "mongodb"]);
  const hosts = parsed.host.split(",");
  const remoteHost = hosts.find((host) => !allowedHosts.has(extractHostname(host)));
  if (remoteHost) {
    throw new Error(`LOCAL_MONGO_URI must point at local MongoDB. Refusing host: ${remoteHost}`);
  }
}

export function runTool(command, args, label) {
  if (label) {
    console.log(label);
  }

  const result = spawnSync(command, args, {
    cwd: repoRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.error) {
    if (result.error.code === "ENOENT") {
      throw new Error(`${command} was not found on PATH. Install MongoDB Database Tools and try again.`);
    }

    throw result.error;
  }

  if (result.status !== 0) {
    process.exit(result.status ?? 1);
  }
}

export function ensureMirrorDir() {
  fs.mkdirSync(mirrorDir, { recursive: true });
}

function extractHostname(host) {
  const trimmed = host.trim();
  if (trimmed.startsWith("[")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  return trimmed.split(":")[0];
}
