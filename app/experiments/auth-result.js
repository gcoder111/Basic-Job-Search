import fs from "node:fs/promises";
import path from "node:path";

export function buildExperimentPaths(rootDir, portal) {
  return {
    authStateDir: path.join(rootDir, "auth-state"),
    resultsDir: path.join(rootDir, "results"),
    storageStatePath: path.join(rootDir, "auth-state", `${portal}.json`),
    resultPath: path.join(rootDir, "results", `${portal}-storage-state-result.json`),
  };
}

export function buildPersistentProfilePaths(rootDir, portal) {
  return {
    userDataDir: path.join(rootDir, "persistent-profiles", portal),
    resultPath: path.join(rootDir, "results", `${portal}-persistent-context-result.json`),
  };
}

export async function ensureExperimentDirectories(paths) {
  await Promise.all(
    [paths.authStateDir, paths.resultsDir, paths.userDataDir].filter(Boolean).map((target) =>
      fs.mkdir(target, { recursive: true }),
    ),
  );
}

export async function writeExperimentResult(resultPath, payload) {
  await fs.mkdir(path.dirname(resultPath), { recursive: true });
  await fs.writeFile(resultPath, JSON.stringify(payload, null, 2), "utf8");
}
