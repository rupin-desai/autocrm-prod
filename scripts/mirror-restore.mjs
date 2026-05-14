import fs from "node:fs";
import path from "node:path";
import {
  assertLocalMongoUri,
  getMongoDatabaseName,
  loadMirrorEnv,
  mirrorDir,
  repoRoot,
  requireEnv,
  runTool,
} from "./mirror-utils.mjs";

loadMirrorEnv();

const localUri = requireEnv("LOCAL_MONGO_URI");
assertLocalMongoUri(localUri);

const latestMetaPath = path.join(mirrorDir, "latest.json");
if (!fs.existsSync(latestMetaPath)) {
  throw new Error("No local snapshot metadata found. Run npm run mirror:pull first.");
}

const latestMeta = JSON.parse(fs.readFileSync(latestMetaPath, "utf8"));
const archivePath = path.resolve(repoRoot, latestMeta.archive);
if (!fs.existsSync(archivePath)) {
  throw new Error(`Snapshot archive not found: ${path.relative(repoRoot, archivePath)}`);
}

const sourceDb = latestMeta.sourceDb;
const targetDb = getMongoDatabaseName(localUri, "LOCAL_MONGO_URI");

runTool(
  "mongorestore",
  [
    "--uri",
    localUri,
    "--drop",
    "--gzip",
    `--archive=${archivePath}`,
    `--nsFrom=${sourceDb}.*`,
    `--nsTo=${targetDb}.*`,
  ],
  `Restoring snapshot ${path.relative(repoRoot, archivePath)} into local database "${targetDb}"`,
);

console.log(`Restore complete: ${targetDb}`);
