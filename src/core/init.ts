import { randomUUID } from "node:crypto";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

async function exists(candidate: string): Promise<boolean> {
  try {
    await access(candidate);
    return true;
  } catch {
    return false;
  }
}

export async function initializeStack(root: string, namespace: string, name: string): Promise<string> {
  const resolved = path.resolve(root);
  await mkdir(resolved, { recursive: true });
  const manifestPath = path.join(resolved, "stack.json");
  if (await exists(manifestPath)) throw new Error(`Refusing to overwrite existing ${manifestPath}.`);
  const manifest = {
    apiVersion: "stacks.dev/v0alpha1",
    kind: "Stack",
    metadata: {
      id: randomUUID(),
      namespace,
      name,
      description: "Describe the worldview and body of work represented by this Stack.",
    },
    workspace: {
      directory: ".stack-workspace",
      stateDirectory: ".stacks",
    },
    context: {
      always: [],
    },
    components: [],
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await mkdir(path.join(resolved, "docs"), { recursive: true });
  await mkdir(path.join(resolved, "proposals"), { recursive: true });

  const gitignorePath = path.join(resolved, ".gitignore");
  const required = [".stacks/", ".stack-workspace/", "stack.local.json"];
  let current = "";
  try {
    current = await readFile(gitignorePath, "utf8");
  } catch {
    // New file.
  }
  const additions = required.filter((entry) => !current.split(/\r?\n/u).includes(entry));
  if (additions.length > 0) {
    const prefix = current.length > 0 && !current.endsWith("\n") ? "\n" : "";
    await writeFile(gitignorePath, `${current}${prefix}${additions.join("\n")}\n`, "utf8");
  }
  return manifestPath;
}
