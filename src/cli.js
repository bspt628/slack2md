import { config } from "dotenv";
import { fileURLToPath } from "node:url";
import { program } from "commander";
import { writeFileSync, mkdirSync } from "node:fs";
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
import { log, logError } from "./logger.js";

// Load .env from cwd first, then fall back to package directory
config();
const __dirname = dirname(fileURLToPath(import.meta.url));
config({ path: resolve(__dirname, "..", ".env") });

export function run() {
  program
    .name("slack2md")
    .description("Convert Slack messages and threads to Markdown")
    .version("0.1.0")
    .argument("<url>", "Slack message or thread URL")
    .option("-o, --output <path>", "Output file path")
    .option("-t, --token <token>", "Slack User Token (or set SLACK_TOKEN env)")
    .option("-l, --limit <number>", "Max messages to fetch for channel history (default: 100)", parseInt)
    .option("-f, --force", "Overwrite existing file")
    .option("--no-download", "Skip downloading attached files")
    .option("--since <date>", "Fetch messages from this date (e.g. 2026-03-01)")
    .option("--until <date>", "Fetch messages up to this date (e.g. 2026-03-31)")
    .action(async (url, opts) => {
      if (opts.limit !== undefined && (!Number.isFinite(opts.limit) || opts.limit <= 0)) {
        logError("Invalid value for --limit: expected a positive integer.");
        process.exit(1);
      }

      // Parse --since / --until to Unix timestamps
      if (opts.since) {
        const ts = parseDateToTimestamp(opts.since);
        if (ts === null) {
          logError("Invalid value for --since: expected a date string (e.g. 2026-03-01).");
          process.exit(1);
        }
        opts.oldest = ts;
      }
      if (opts.until) {
        const ts = parseDateToTimestamp(opts.until, true);
        if (ts === null) {
          logError("Invalid value for --until: expected a date string (e.g. 2026-03-31).");
          process.exit(1);
        }
        opts.latest = ts;
      }

      try {
        await execute(url, opts);
      } catch (err) {
        logError(`Error: ${err.message}`);
        process.exit(1);
      }
    });

  program.parse();
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
    oldest: opts.oldest,
    latest: opts.latest,
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

/**
 * Parse a date string (YYYY-MM-DD) into a Unix timestamp string.
 * When endOfDay is true, the timestamp is set to 23:59:59.999 of the given date.
 * Returns null if the date string is invalid.
 */
export function parseDateToTimestamp(dateStr, endOfDay = false) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return null;
  }
  const date = new Date(dateStr + "T00:00:00");
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  if (endOfDay) {
    date.setHours(23, 59, 59, 999);
  }
  return String(date.getTime() / 1000);
}
