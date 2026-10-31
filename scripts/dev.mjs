import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";

const tsxCli = fileURLToPath(
  new URL("../node_modules/tsx/dist/cli.mjs", import.meta.url),
);

const child = spawn(process.execPath, [tsxCli, "server/index.ts"], {
  stdio: "inherit",
  env: { ...process.env, NODE_ENV: "development" },
});

child.on("exit", (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code ?? 1);
  }
});

child.on("error", (error) => {
  console.error("Failed to start development server:", error);
  process.exit(1);
});
