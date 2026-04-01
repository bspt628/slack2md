import { writeFileSync, mkdirSync, existsSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { log, logWarning } from "./logger.js";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
]);

const MAX_CONCURRENT_DOWNLOADS = 5;

/**
 * Extract all files from messages.
 * Returns a flat array of { file, messageTs } objects.
 */
export function extractFiles(messages) {
  const files = [];
  for (const msg of messages) {
    if (!msg.files) continue;
    for (const file of msg.files) {
      if (file.url_private) {
        files.push({ file, messageTs: msg.ts });
      }
    }
  }
  return files;
}

/**
 * Download files from Slack and save them to assetsDir.
 * Returns a Map<url_private, localRelativePath> for rewriting links in Markdown.
 */
export async function downloadFiles(files, token, assetsDir) {
  const fileMap = new Map();
  if (files.length === 0) return fileMap;

  mkdirSync(assetsDir, { recursive: true });

  const existing = new Set(readdirSync(assetsDir));

  // Download in batches to limit concurrency
  for (let i = 0; i < files.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const batch = files.slice(i, i + MAX_CONCURRENT_DOWNLOADS);
    const results = await Promise.allSettled(
      batch.map(({ file }) => downloadOne(file, token, assetsDir, existing))
    );
    for (const result of results) {
      if (result.status === "fulfilled" && result.value) {
        const { url, filename } = result.value;
        fileMap.set(url, filename);
      }
    }
  }

  return fileMap;
}

async function downloadOne(file, token, assetsDir, existing) {
  const filename = deduplicateFilename(file.name || `file-${file.id}`, existing);
  const localPath = join(assetsDir, filename);

  const res = await fetch(file.url_private, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (!res.ok) {
    logWarning(`Warning: failed to download ${file.name} (${res.status})`);
    return null;
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  writeFileSync(localPath, buffer);
  existing.add(filename);
  log(`  Downloaded: ${filename}`);
  return { url: file.url_private, filename };
}

/**
 * Check if a filename looks like an image.
 */
export function isImage(filename) {
  const ext = (filename.split(".").pop() || "").toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * Pick a unique filename by checking against existing names in a Set.
 */
function deduplicateFilename(name, existing) {
  if (!existing.has(name)) return name;

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  let i = 1;
  while (existing.has(`${base}-${i}${ext}`)) {
    i++;
  }
  return `${base}-${i}${ext}`;
}
