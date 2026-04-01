import { writeFileSync, mkdirSync, readdirSync } from "node:fs";
import { join, basename } from "node:path";
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
 * Returns a Map<url_private, filename> for rewriting links in Markdown.
 * Filenames are relative to assetsDir.
 */
export async function downloadFiles(files, token, assetsDir) {
  const fileMap = new Map();
  if (files.length === 0) return fileMap;

  mkdirSync(assetsDir, { recursive: true });

  const existing = new Set(readdirSync(assetsDir));

  // Reserve all filenames upfront to avoid race conditions in concurrent downloads
  const planned = files.map(({ file }) => {
    const safeName = sanitizeFilename(file.name || `file-${file.id}`);
    const filename = deduplicateFilename(safeName, existing);
    existing.add(filename);
    return { file, filename };
  });

  // Download in batches to limit concurrency
  for (let i = 0; i < planned.length; i += MAX_CONCURRENT_DOWNLOADS) {
    const batch = planned.slice(i, i + MAX_CONCURRENT_DOWNLOADS);
    const results = await Promise.allSettled(
      batch.map(({ file, filename }) => downloadOne(file, token, assetsDir, filename))
    );
    for (let j = 0; j < results.length; j++) {
      const result = results[j];
      if (result.status === "fulfilled" && result.value) {
        const { url, filename } = result.value;
        fileMap.set(url, filename);
      } else if (result.status === "rejected") {
        logWarning(`Warning: failed to download ${batch[j].file.name}: ${result.reason}`);
      }
    }
  }

  return fileMap;
}

async function downloadOne(file, token, assetsDir, filename) {
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
 * Strip path separators and dangerous sequences from a filename.
 */
function sanitizeFilename(name) {
  return basename(name);
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
