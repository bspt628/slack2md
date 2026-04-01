import { replaceEmojiCodes } from "./emoji.js";

/**
 * Convert Slack mrkdwn to standard Markdown.
 *
 * @param {string} text - Slack mrkdwn text
 * @param {object} context - Resolved names for users/channels
 * @param {Map<string,string>} context.users - userId -> displayName
 * @param {Map<string,string>} context.channels - channelId -> channelName
 * @returns {string} Markdown text
 */
export function mrkdwnToMarkdown(text, context = {}) {
  if (!text) return "";

  const users = context.users ?? new Map();
  const channels = context.channels ?? new Map();

  let md = text;

  // Slack API already uses real angle brackets for links/mentions (<@U123>, <https://...>)
  // and only encodes user-typed literal < > as &lt; &gt;. Decoding entities first is safe
  // because &lt;https://...&gt; can never appear in Slack API output.
  md = md.replace(/^&gt;\s?/gm, "> "); // blockquotes first (before &gt; is decoded)
  md = md.replace(/&amp;/g, "&");
  md = md.replace(/&lt;/g, "<");
  md = md.replace(/&gt;/g, ">");

  // User mentions: <@U12345> or <@U12345|name>
  md = md.replace(/<@(U[A-Z0-9]+)(?:\|([^>]*))?>/g, (_, id, label) => {
    const name = label || users.get(id) || id;
    return `@${name}`;
  });

  // Channel mentions: <#C12345|channel-name>
  md = md.replace(/<#(C[A-Z0-9]+)(?:\|([^>]*))?>/g, (_, id, label) => {
    const name = label || channels.get(id) || id;
    return `#${name}`;
  });

  // Links: <url|text> -> [text](url)  or  <url> -> url
  md = md.replace(/<(https?:\/\/[^|>]+)\|([^>]+)>/g, "[$2]($1)");
  md = md.replace(/<(https?:\/\/[^>]+)>/g, "$1");

  // Mailto: <mailto:foo@bar.com|foo@bar.com>
  md = md.replace(/<mailto:([^|>]+)\|([^>]+)>/g, "[$2](mailto:$1)");

  // Bold: *text* -> **text** (but not inside code blocks)
  // Use negative lookahead/behind for * to avoid matching ***bold italic***
  md = convertOutsideCode(md, (segment) => {
    return segment.replace(/(?<![*\w])\*([^\s*](?:[^*]*[^\s*])?)\*(?![*\w])/g, "**$1**");
  });

  // Italic: _text_ (same in Markdown, but ensure spacing)
  // Already compatible — Slack _text_ works as Markdown _text_

  // Strikethrough: ~text~ -> ~~text~~
  md = convertOutsideCode(md, (segment) => {
    return segment.replace(/(?<!\w)~([^\s~](?:[^~]*[^\s~])?)~(?!\w)/g, "~~$1~~");
  });

  // Bullet lists: Slack uses plain text bullets
  md = md.replace(/^[•◦]\s/gm, "- ");
  md = md.replace(/^(\s+)[•◦]\s/gm, "$1- ");

  // Emoji shortcodes: :emoji_name: -> Unicode emoji (outside code blocks)
  md = convertOutsideCode(md, (segment) => replaceEmojiCodes(segment));

  return md;
}

/**
 * Apply a transformation only to text segments outside of code blocks/spans.
 */
function convertOutsideCode(text, transform) {
  // Split by code blocks (```) and inline code (`)
  const parts = text.split(/(```[\s\S]*?```|`[^`]+`)/g);
  return parts
    .map((part, i) => {
      // Odd indices are code blocks/spans — leave them alone
      if (i % 2 === 1) return part;
      return transform(part);
    })
    .join("");
}
