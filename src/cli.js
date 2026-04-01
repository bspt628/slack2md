import "dotenv/config";
import { program } from "commander";
import { writeFileSync, existsSync, mkdirSync } from "node:fs";
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
    .action(async (url, opts) => {
      try {
        await execute(url, opts);
      } catch (err) {
        console.error(`Error: ${err.message}`);
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

  console.error("Fetching channel info...");
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

  console.error(
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
  console.error(`Found ${messages.length} messages.`);

  // Resolve mentions
  const { userIds, channelIds } = extractMentionedIds(messages);
  console.error(`Resolving ${userIds.length} users, ${channelIds.length} channels...`);
  const [users, channels] = await Promise.all([
    resolveUsers(client, userIds),
    resolveChannels(client, channelIds),
  ]);

  // Output path (determine early so we know where to put assets)
  const outputPath = opts.output || generateFilename(channelName, threadTs);
  const absPath = resolve(outputPath);
  const dir = dirname(absPath);

  // Ensure parent directory exists
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }

  // Download attached files
  let fileMap = new Map();
  const assetsRelDir = "./assets";
  if (opts.download !== false) {
    const files = extractFiles(messages);
    if (files.length > 0) {
      const assetsDir = join(dir, "assets");
      console.error(`Downloading ${files.length} files...`);
      fileMap = await downloadFiles(files, token, assetsDir);
    }
  }

  // Format
  const markdown = formatMessages(messages, {
    channelName, users, channels, fileMap, assetsRelDir,
  });

  // Refuse to overwrite unless --force
  if (existsSync(absPath)) {
    if (!opts.force) {
      throw new Error(
        `File already exists: ${absPath}\n` +
          "  Re-run with --force to overwrite."
      );
    }
    console.error(`Overwriting existing file: ${absPath}`);
  }

  writeFileSync(absPath, markdown, "utf-8");
  console.error(`Written to ${absPath}`);
}

function generateFilename(channelName, threadTs) {
  const safe = channelName.replace(/[^a-zA-Z0-9_-]/g, "_");
  const date = new Date().toISOString().slice(0, 10);
  const suffix = threadTs ? `-thread-${threadTs.replace(".", "")}` : "";
  return `${safe}${suffix}-${date}.md`;
}
