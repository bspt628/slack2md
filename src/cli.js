import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import {
  createClient,
  fetchMessages,
  resolveUsers,
  resolveChannels,
  getChannelInfo,
  extractMentionedIds,
} from "./slack.js";
import { parseSlackUrl } from "./parse-url.js";
import { formatMessages } from "./format.js";
import { extractFiles, downloadFiles } from "./files.js";
import { log, logError, logWarning } from "./logger.js";

// Load .env from cwd first, then fall back to package directory
config();
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

/**
 * Read URLs from a file, one per line.
 * Blank lines and lines starting with # are ignored.
 */
export function readUrlsFromFile(filePath) {
  const absPath = resolve(filePath);
  const content = readFileSync(absPath, "utf-8");
  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"));
}

export function run() {
  program
    .name("slack2md")
    .description("Convert Slack messages and threads to Markdown")
    .version("0.1.0")
    .argument("[urls...]", "Slack message or thread URLs")
    .option("-o, --output <path>", "Output file path (only for single URL)")
    .option("-t, --token <token>", "Slack User Token (or set SLACK_TOKEN env)")
    .option("-l, --limit <number>", "Max messages to fetch for channel history (default: 100)", parseInt)
    .option("-f, --force", "Overwrite existing file")
    .option("--no-download", "Skip downloading attached files")
    .option("--file <path>", "Read URLs from a file (one URL per line)")
    .action(async (urls, opts) => {
      if (opts.limit !== undefined && (!Number.isFinite(opts.limit) || opts.limit <= 0)) {
        logError("Invalid value for --limit: expected a positive integer.");
        process.exit(1);
      }

      // Collect URLs from arguments and --file
      let allUrls = [...urls];

      if (opts.file) {
        try {
          const fileUrls = readUrlsFromFile(opts.file);
          allUrls = allUrls.concat(fileUrls);
        } catch (err) {
          logError(`Error reading URL file: ${err.message}`);
          process.exit(1);
        }
      }

      if (allUrls.length === 0) {
        logError("No URLs provided. Pass URLs as arguments or use --file <path>.");
        process.exit(1);
      }

      if (allUrls.length > 1 && opts.output) {
        logError("The --output option cannot be used with multiple URLs.");
        process.exit(1);
      }

      try {
        await executeAll(allUrls, opts);
      } catch (err) {
        logError(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  program.parse();
}

async function executeAll(urls, opts) {
  // Validate token before entering the loop to fail fast on config errors
  const token = opts.token || process.env.SLACK_TOKEN;
  if (!token) {
    throw new Error(
      "Slack token is required.\n" +
        "  Set SLACK_TOKEN in .env file, export as env variable, or use --token flag.\n" +
        "  See README for Slack App setup instructions."
    );
  }

  const errors = [];

  for (const [index, url] of urls.entries()) {
    if (urls.length > 1) {
      log(`\n[${index + 1}/${urls.length}] Processing: ${url}`);
    }
    try {
      await execute(url, opts);
    } catch (err) {
      const msg = String(err?.message ?? err).replace(/\s+/g, " ").trim();
      const errorMsg = `${url}: ${msg}`;
      errors.push(errorMsg);
      if (urls.length > 1) {
        logWarning(`Failed: ${msg}`);
      } else {
        throw err;
      }
    }
  }

  if (errors.length > 0) {
    logError(`\n${errors.length} URL(s) failed:`);
    for (const err of errors) {
      logError(`  - ${err}`);
    }
    process.exit(1);
  }
}

async function execute(url, opts) {
  const token = opts.token || process.env.SLACK_TOKEN;
  if (!token) {
    throw new Error(
      "Slack token is required.\n" +
        "  Set SLACK_TOKEN in .env file, export as env variable, or use --token flag.\n" +
        "  See README for Slack App setup instructions."
    );
  }

  const { channelId, threadTs } = parseSlackUrl(url);
  const client = createClient(token);

  log("Fetching channel info...");
  let channelInfo;
  try {
    channelInfo = await getChannelInfo(client, channelId);
  } catch (err) {
    if (err.data?.error === "channel_not_found") {
      throw new Error(
        `Channel ${channelId} not found. Check that the URL is correct and you have access to this channel.`
      );
    }
    throw err;
  }
  const channelName = channelInfo.name || channelId;

  log(
    threadTs
      ? `Fetching thread in #${channelName}...`
      : `Fetching messages from #${channelName}...`
  );
  const messages = await fetchMessages(client, channelId, threadTs, {
    limit: opts.limit,
  });

  if (messages.length === 0) {
    throw new Error(
      "No messages found. The thread may have been deleted, or you may lack access."
    );
  }
  log(`Found ${messages.length} messages.`);

  // Resolve mentions
  const { userIds, channelIds } = extractMentionedIds(messages);
  log(`Resolving ${userIds.length} users, ${channelIds.length} channels...`);
  const [users, channels] = await Promise.all([
    resolveUsers(client, userIds),
    resolveChannels(client, channelIds),
  ]);

  // Output path (determine early so we know where to put assets)
  const outputPath = opts.output || generateFilename(channelName, threadTs);
  const absPath = resolve(outputPath);
  const dir = dirname(absPath);

  mkdirSync(dir, { recursive: true });

  // Download attached files
  let fileMap = new Map();
  if (opts.download !== false) {
    const files = extractFiles(messages);
    if (files.length > 0) {
      const assetsDir = join(dir, "assets");
      log(`Downloading ${files.length} files...`);
      fileMap = await downloadFiles(files, token, assetsDir);
    }
  }

  // Format
  const markdown = formatMessages(messages, {
    channelName, users, channels, fileMap,
  });

  // Refuse to overwrite unless --force
  try {
    writeFileSync(absPath, markdown, { encoding: "utf-8", flag: opts.force ? "w" : "wx" });
  } catch (err) {
    if (err.code === "EEXIST") {
      throw new Error(
        `File already exists: ${absPath}\n` +
          "  Re-run with --force to overwrite."
      );
    }
    throw err;
  }
  log(`Written to ${absPath}`);
}

function generateFilename(channelName, threadTs) {
  const safe = channelName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const suffix = threadTs ? `-thread-${threadTs.replace(".", "")}` : "";
  return `${safe}${suffix}-${date}.md`;
}
