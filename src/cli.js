import "dotenv/config";
import { program } from "commander";
import { writeFileSync } from "node:fs";
import { resolve } from "node:path";
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

export function run() {
  program
    .name("slack2md")
    .description("Convert Slack messages and threads to Markdown")
    .version("0.1.0")
    .argument("<url>", "Slack message or thread URL")
    .option("-o, --output <path>", "Output file path")
    .option("-t, --token <token>", "Slack User Token (or set SLACK_TOKEN env)")
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
      "Slack token is required. Set SLACK_TOKEN env or use --token flag."
    );
  }

  const { channelId, threadTs } = parseSlackUrl(url);
  const client = createClient(token);

  console.error("Fetching channel info...");
  const channelInfo = await getChannelInfo(client, channelId);
  const channelName = channelInfo.name || channelId;

  console.error(
    threadTs
      ? `Fetching thread in #${channelName}...`
      : `Fetching messages from #${channelName}...`
  );
  const messages = await fetchMessages(client, channelId, threadTs);

  if (messages.length === 0) {
    throw new Error("No messages found.");
  }
  console.error(`Found ${messages.length} messages.`);

  // Resolve mentions
  const { userIds, channelIds } = extractMentionedIds(messages);
  console.error(`Resolving ${userIds.length} users, ${channelIds.length} channels...`);
  const [users, channels] = await Promise.all([
    resolveUsers(client, userIds),
    resolveChannels(client, channelIds),
  ]);

  // Format
  const markdown = formatMessages(messages, { channelName, users, channels });

  // Output
  const outputPath = opts.output || generateFilename(channelName, threadTs);
  const absPath = resolve(outputPath);
  writeFileSync(absPath, markdown, "utf-8");
  console.error(`Written to ${absPath}`);
}

function generateFilename(channelName, threadTs) {
  const date = new Date().toISOString().slice(0, 10);
  const suffix = threadTs ? `-thread-${threadTs.replace(".", "")}` : "";
  return `${channelName}${suffix}-${date}.md`;
}
