import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const docsRoot = path.join(root, "docs");
const catalog = JSON.parse(await readFile(path.join(docsRoot, "catalog.json"), "utf8"));
if (catalog.schemaVersion !== "0.1" || !Array.isArray(catalog.documents)) throw new Error("docs/catalog.json must use schemaVersion 0.1 and contain documents.");

const allowedCategories = new Set(["use", "current", "decisions", "archive"]);
const allowedLifecycles = new Set(["current", "proposed", "decision", "archive"]);
const paths = new Set();
const ids = new Set();
for (const document of catalog.documents) {
  if (!document || typeof document.path !== "string" || typeof document.id !== "string") throw new Error("Every documentation catalog entry requires path and id.");
  if (!allowedCategories.has(document.category)) throw new Error(`Unknown documentation category for ${document.path}: ${document.category}`);
  if (!allowedLifecycles.has(document.lifecycle)) throw new Error(`Unknown documentation lifecycle for ${document.path}: ${document.lifecycle}`);
  if (!Number.isFinite(document.order)) throw new Error(`Documentation order must be numeric for ${document.path}.`);
  if (paths.has(document.path)) throw new Error(`Duplicate documentation path: ${document.path}`);
  if (ids.has(document.id)) throw new Error(`Duplicate documentation id: ${document.id}`);
  paths.add(document.path);
  ids.add(document.id);
}

async function markdownFiles(directory) {
  const result = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const absolute = path.join(directory, entry.name);
    if (entry.isDirectory()) result.push(...await markdownFiles(absolute));
    else if (entry.isFile() && entry.name.endsWith(".md")) result.push(path.relative(root, absolute).replaceAll("\\", "/"));
  }
  return result;
}

const markdown = new Set(await markdownFiles(docsRoot));
const uncataloged = [...markdown].filter((file) => !paths.has(file)).sort();
const missing = [...paths].filter((file) => !markdown.has(file)).sort();
if (uncataloged.length || missing.length) {
  throw new Error(`Documentation catalog drift.${uncataloged.length ? ` Uncataloged: ${uncataloged.join(", ")}.` : ""}${missing.length ? ` Missing: ${missing.join(", ")}.` : ""}`);
}

const brokenLinks = [];
for (const file of markdown) {
  const absolute = path.join(root, file);
  const content = await readFile(absolute, "utf8");
  for (const match of content.matchAll(/\[[^\]]*\]\(([^)]+)\)/gu)) {
    const href = match[1].trim().replace(/^<|>$/gu, "").split("#", 1)[0].split("?", 1)[0];
    if (!href || /^(?:[a-z]+:|\/)/iu.test(href) || !href.toLowerCase().endsWith(".md")) continue;
    const target = path.resolve(path.dirname(absolute), decodeURIComponent(href));
    try { if (!(await stat(target)).isFile()) brokenLinks.push(`${file} -> ${href}`); }
    catch { brokenLinks.push(`${file} -> ${href}`); }
  }
}
if (brokenLinks.length) throw new Error(`Broken relative Markdown links: ${brokenLinks.sort().join(", ")}.`);

const counts = Object.fromEntries([...allowedLifecycles].map((lifecycle) => [lifecycle, catalog.documents.filter((document) => document.lifecycle === lifecycle).length]));
process.stdout.write(`Documentation catalog verified: ${catalog.documents.length} files (${Object.entries(counts).map(([key, value]) => `${value} ${key}`).join(", ")}).\n`);
