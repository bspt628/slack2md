import { mrkdwnToMarkdown } from "./convert.js";

/**
 * Format a list of Slack messages into a single Markdown document.
 *
 * @param {object[]} messages - Slack message objects
 * @param {object} options
 * @param {string} options.channelName - Channel name for the heading
 * @param {Map<string,string>} options.users - userId -> displayName
 * @param {Map<string,string>} options.channels - channelId -> channelName
 * @returns {string} Markdown document
 */
export function formatMessages(messages, { channelName, users, channels }) {
  const context = { users, channels };
  const lines = [];

  lines.push(`# #${channelName}`);
  lines.push("");

  for (const msg of messages) {
    // Skip join/leave and other subtypes without useful text
    if (msg.subtype && !["bot_message", "file_share", "thread_broadcast"].includes(msg.subtype)) {
      continue;
    }

    const author = resolveAuthor(msg, users);
    const time = formatTimestamp(msg.ts);

    lines.push(`---`);
    lines.push("");
    lines.push(`${author} -- ${time}`);
    lines.push("");

    const body = mrkdwnToMarkdown(msg.text, context);
    if (body) {
      lines.push(body);
      lines.push("");
    }

    // Attachments (link previews, etc.)
    if (msg.attachments) {
      for (const att of msg.attachments) {
        if (att.title && att.title_link) {
          lines.push(`> [${att.title}](${att.title_link})`);
        } else if (att.text) {
          const attText = mrkdwnToMarkdown(att.text, context);
          lines.push(`> ${attText.replace(/\n/g, "\n> ")}`);
        }
      }
      lines.push("");
    }

    // Files
    if (msg.files) {
      for (const file of msg.files) {
        const name = file.name || "file";
        if (file.url_private) {
          lines.push(`[${name}](${file.url_private}) (Slack authentication required)`);
        } else {
          lines.push(`${name}`);
        }
      }
      lines.push("");
    }

    // Reactions
    if (msg.reactions?.length) {
      const reactionStr = msg.reactions
        .map((r) => `:${r.name}: (${r.count})`)
        .join("  ");
      lines.push(reactionStr);
      lines.push("");
    }
  }

  return lines.join("\n").trim() + "\n";
}

function resolveAuthor(msg, users) {
  if (msg.user) {
    return `@${users.get(msg.user) || msg.user}`;
  }
  if (msg.bot_id && msg.username) {
    return `@${msg.username} (bot)`;
  }
  return "@unknown";
}

function formatTimestamp(ts) {
  const date = new Date(parseFloat(ts) * 1000);
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  const h = String(date.getHours()).padStart(2, "0");
  const min = String(date.getMinutes()).padStart(2, "0");
  const offset = date.getTimezoneOffset();
  const sign = offset <= 0 ? "+" : "-";
  const absH = String(Math.floor(Math.abs(offset) / 60)).padStart(2, "0");
  const absM = String(Math.abs(offset) % 60).padStart(2, "0");
  return `${y}-${m}-${d} ${h}:${min} (UTC${sign}${absH}:${absM})`;
}
