import fs from "node:fs/promises";
import path from "node:path";
import { getPortalAuthStrategy } from "../config/portal-auth-strategies.js";

async function pathExists(targetPath) {
  try {
    await fs.access(targetPath);
    return true;
  } catch {
    return false;
  }
}

export function resolveWorkspacePaths(workspaceRoot) {
  return {
    authStateDir: path.join(workspaceRoot, "auth-state"),
    persistentProfilesDir: path.join(workspaceRoot, "persistent-profiles"),
    resultsDir: path.join(workspaceRoot, "results"),
    runsDir: path.join(workspaceRoot, "data", "runs"),
  };
}

export async function getPortalAuthState({ workspaceRoot, portalKey }) {
  const strategy = getPortalAuthStrategy(portalKey);

  if (!strategy) {
    return {
      portalKey,
      sessionStrategy: "public",
      available: true,
      authPath: null,
    };
  }

  const paths = resolveWorkspacePaths(workspaceRoot);
  const authPath =
    strategy.sessionStrategy === "storageState"
      ? path.join(paths.authStateDir, strategy.authArtifactName)
      : path.join(paths.persistentProfilesDir, strategy.authArtifactName);

  return {
    portalKey,
    sessionStrategy: strategy.sessionStrategy,
    available: await pathExists(authPath),
    authPath,
  };
}
