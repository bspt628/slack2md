import { writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, basename } from "node:path";

const IMAGE_EXTENSIONS = new Set([
  "png", "jpg", "jpeg", "gif", "webp", "svg", "bmp", "ico",
]);

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

  if (!existsSync(assetsDir)) {
    mkdirSync(assetsDir, { recursive: true });
  }

  for (const { file } of files) {
    const filename = deduplicateFilename(file.name || `file-${file.id}`, assetsDir);
    const localPath = join(assetsDir, filename);

    try {
      const res = await fetch(file.url_private, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (!res.ok) {
        process.stderr.write(`\x1b[33mWarning: failed to download ${file.name} (${res.status})\x1b[0m\n`);
        continue;
      }

      const buffer = Buffer.from(await res.arrayBuffer());
      writeFileSync(localPath, buffer);
      fileMap.set(file.url_private, filename);
      process.stderr.write(`  Downloaded: ${filename}\n`);
    } catch (err) {
      process.stderr.write(`\x1b[33mWarning: failed to download ${file.name}: ${err.message}\x1b[0m\n`);
    }
  }

  return fileMap;
}

/**
 * Check if a filename looks like an image.
 */
export function isImage(filename) {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  return IMAGE_EXTENSIONS.has(ext);
}

/**
 * If a file with the same name already exists in the directory, add a numeric suffix.
 */
function deduplicateFilename(name, dir) {
  if (!existsSync(join(dir, name))) return name;

  const dot = name.lastIndexOf(".");
  const base = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : "";

  let i = 1;
  while (existsSync(join(dir, `${base}-${i}${ext}`))) {
    i++;
  }
  return `${base}-${i}${ext}`;
}
