import fs from "node:fs";
import path from "node:path";
import {
  ensureMirrorDir,
  getMongoDatabaseName,
  loadMirrorEnv,
  mirrorDir,
  repoRoot,
  requireEnv,
  runTool,
} from "./mirror-utils.mjs";

loadMirrorEnv();
ensureMirrorDir();

const prodUri = requireEnv("PROD_MIRROR_URI");
const sourceDb = getMongoDatabaseName(prodUri, "PROD_MIRROR_URI");
const timestamp = new Date().toISOString().replace(/[:.]/g, "-");
const archivePath = path.join(mirrorDir, `prod-${sourceDb}-${timestamp}.archive.gz`);
const latestArchivePath = path.join(mirrorDir, "prod-latest.archive.gz");
const latestMetaPath = path.join(mirrorDir, "latest.json");

runTool(
  "mongodump",
  ["--uri", prodUri, `--archive=${archivePath}`, "--gzip"],
  `Pulling production snapshot from database "${sourceDb}" into ${path.relative(repoRoot, archivePath)}`,
);

fs.copyFileSync(archivePath, latestArchivePath);
fs.writeFileSync(
  latestMetaPath,
  JSON.stringify(
    {
      archive: path.relative(repoRoot, latestArchivePath),
      originalArchive: path.relative(repoRoot, archivePath),
      sourceDb,
      pulledAt: new Date().toISOString(),
    },
    null,
    2,
  ),
);

console.log(`Snapshot ready: ${path.relative(repoRoot, latestArchivePath)}`);
