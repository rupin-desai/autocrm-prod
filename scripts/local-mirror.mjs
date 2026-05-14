import { spawn } from "node:child_process";
import { assertLocalMongoUri, loadMirrorEnv, repoRoot, runTool } from "./mirror-utils.mjs";

loadMirrorEnv();

process.env.LOCAL_MONGO_URI ||= "mongodb://127.0.0.1:27017/mauli-car-world";
process.env.MONGODB_URI = process.env.LOCAL_MONGO_URI;
process.env.NODE_ENV = "development";
process.env.LOCAL_MIRROR_MODE = "true";
process.env.LOCAL_DISABLE_WHATSAPP_OTP = "true";
process.env.LOCAL_DEFAULT_SHOP ||= "beed";
process.env.PORT ||= "5000";

assertLocalMongoUri(process.env.LOCAL_MONGO_URI);

runTool(
  "docker",
  ["compose", "-f", "docker/docker-compose.db.yml", "up", "-d"],
  "Starting local MongoDB docker container",
);

console.log("Starting app in local mirror mode at http://localhost:5000");

const npxCommand = process.platform === "win32" ? "npx.cmd" : "npx";
const app = spawn(npxCommand, ["tsx", "server/index.ts"], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
  shell: process.platform === "win32",
});

app.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  }

  process.exit(code ?? 0);
});

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    app.kill(signal);
  });
}
