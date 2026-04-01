import { get as getEmoji } from "node-emoji";

/**
 * Slack-specific emoji aliases that differ from the node-emoji (gemoji) names.
 * Maps Slack shortcode -> node-emoji shortcode. Direct Unicode mappings belong
 * in SLACK_UNICODE_FALLBACK.
 */
const SLACK_ALIASES = {
  thumbsup: "+1",
  thumbsdown: "-1",
  thinking_face: "thinking",
  hugging_face: "hugs",
  face_with_rolling_eyes: "roll_eyes",
  partying_face: "partying",
  woozy_face: "woozy",
  pleading_face: "pleading",
  simple_smile: "slightly_smiling_face",
  hankey: "poop",
};

/**
 * Direct Unicode fallback for Slack emoji names that node-emoji does not cover.
 */
const SLACK_UNICODE_FALLBACK = {
  face_with_monocle: "\u{1F9D0}",
  shushing_face: "\u{1F92B}",
  hot_face: "\u{1F975}",
  cold_face: "\u{1F976}",
};

/**
 * Resolve a single Slack emoji name to its Unicode character.
 * Returns undefined if the name is not recognized (e.g. custom workspace emoji).
 *
 * @param {string} name - Emoji shortcode without colons (e.g. "thumbsup")
 * @returns {string|undefined} Unicode emoji character, or undefined
 */
export function resolveEmoji(name) {
  // Try direct lookup first
  let result = getEmoji(name);
  if (result) return result;

  // Try Slack-specific alias
  const alias = SLACK_ALIASES[name];
  if (alias) {
    result = getEmoji(alias);
    if (result) return result;
  }

  // Try direct Unicode fallback
  const fallback = SLACK_UNICODE_FALLBACK[name];
  if (fallback) return fallback;

  return undefined;
}

/**
 * Replace all `:emoji_name:` patterns in text with Unicode emoji.
 * Unknown names (custom workspace emoji) are left as-is.
 *
 * @param {string|null|undefined} text - Text containing emoji shortcodes
 * @returns {string|null|undefined} Text with known emoji converted to Unicode, or the input as-is if falsy
 */
export function replaceEmojiCodes(text) {
  if (!text) return text;

  return text.replace(/:([a-z0-9_+\-]+):/g, (match, name) => {
    const emoji = resolveEmoji(name);
    return emoji ?? match;
  });
}
