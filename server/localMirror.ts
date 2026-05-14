import type { NextFunction, Request, Response } from "express";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);
const ALLOWED_MUTATION_PATHS = new Set([
  "/api/auth/login",
  "/api/auth/logout",
]);

const LOCAL_MONGO_HOSTS = new Set([
  "localhost",
  "127.0.0.1",
  "::1",
  "0.0.0.0",
  "host.docker.internal",
  "mongodb",
]);

export function isLocalMirrorMode() {
  return process.env.NODE_ENV !== "production" && process.env.LOCAL_MIRROR_MODE === "true";
}

export function localMirrorReadOnlyGuard(req: Request, res: Response, next: NextFunction) {
  if (!isLocalMirrorMode()) {
    return next();
  }

  if (!req.path.startsWith("/api") || !MUTATING_METHODS.has(req.method)) {
    return next();
  }

  if (ALLOWED_MUTATION_PATHS.has(req.path)) {
    return next();
  }

  return res.status(403).json({
    error: "Local mirror is read-only.",
    message: "Mutating API requests are blocked while LOCAL_MIRROR_MODE=true.",
  });
}

export function assertLocalMirrorMongoTarget(uri: string) {
  if (!isLocalMirrorMode()) {
    return;
  }

  const parsed = new URL(uri);
  if (parsed.protocol === "mongodb+srv:") {
    throw new Error("LOCAL_MIRROR_MODE=true requires LOCAL_MONGO_URI to point at local MongoDB, not mongodb+srv.");
  }

  const hosts = parsed.host.split(",");
  const remoteHost = hosts.find((host) => !LOCAL_MONGO_HOSTS.has(extractHostname(host)));
  if (remoteHost) {
    throw new Error(`LOCAL_MIRROR_MODE=true requires local MongoDB. Refusing host: ${remoteHost}`);
  }
}

function extractHostname(host: string) {
  const trimmed = host.trim();
  if (trimmed.startsWith("[")) {
    return trimmed.slice(1, trimmed.indexOf("]"));
  }

  return trimmed.split(":")[0];
}
