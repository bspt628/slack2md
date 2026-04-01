import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { resolveEmoji, replaceEmojiCodes } from "../src/emoji.js";
import { mrkdwnToMarkdown } from "../src/convert.js";

describe("resolveEmoji", () => {
  it("resolves standard emoji names", () => {
    assert.equal(resolveEmoji("heart"), "❤️");
    assert.equal(resolveEmoji("fire"), "🔥");
    assert.equal(resolveEmoji("rocket"), "🚀");
    assert.equal(resolveEmoji("wave"), "👋");
  });

  it("resolves Slack-specific aliases", () => {
    assert.equal(resolveEmoji("thumbsup"), "👍");
    assert.equal(resolveEmoji("thumbsdown"), "👎");
    assert.equal(resolveEmoji("thinking_face"), "🤔");
    assert.equal(resolveEmoji("hugging_face"), "🤗");
  });

  it("resolves Unicode fallback emoji", () => {
    assert.equal(resolveEmoji("face_with_monocle"), "🧐");
    assert.equal(resolveEmoji("shushing_face"), "🤫");
    assert.equal(resolveEmoji("hot_face"), "🥵");
    assert.equal(resolveEmoji("cold_face"), "🥶");
  });

  it("returns undefined for custom/unknown emoji", () => {
    assert.equal(resolveEmoji("__unknown_emoji_test_only__"), undefined);
    assert.equal(resolveEmoji("__nonexistent_custom_emoji__"), undefined);
  });
});

describe("replaceEmojiCodes", () => {
  it("replaces known emoji codes in text", () => {
    assert.equal(replaceEmojiCodes("Hello :wave:"), "Hello 👋");
    assert.equal(replaceEmojiCodes(":fire: hot :fire:"), "🔥 hot 🔥");
  });

  it("leaves custom emoji codes unchanged", () => {
    assert.equal(
      replaceEmojiCodes(":custom_emoji:"),
      ":custom_emoji:"
    );
  });

  it("handles mixed known and custom emoji", () => {
    const result = replaceEmojiCodes(":thumbsup: :company_logo: :heart:");
    assert.equal(result, "👍 :company_logo: ❤️");
  });

  it("handles empty and null input", () => {
    assert.equal(replaceEmojiCodes(""), "");
    assert.equal(replaceEmojiCodes(null), null);
    assert.equal(replaceEmojiCodes(undefined), undefined);
  });

  it("does not replace emoji-like patterns inside words", () => {
    // The regex requires : delimiters so normal text is unaffected
    assert.equal(replaceEmojiCodes("no emoji here"), "no emoji here");
  });
});

describe("mrkdwnToMarkdown emoji integration", () => {
  it("converts emoji codes in message text", () => {
    assert.equal(
      mrkdwnToMarkdown("Great job :thumbsup:"),
      "Great job 👍"
    );
  });

  it("preserves emoji codes inside code spans", () => {
    assert.equal(
      mrkdwnToMarkdown("Use `:thumbsup:` for approval"),
      "Use `:thumbsup:` for approval"
    );
  });

  it("preserves emoji codes inside code blocks", () => {
    assert.equal(
      mrkdwnToMarkdown("```\n:thumbsup:\n```"),
      "```\n:thumbsup:\n```"
    );
  });

  it("converts multiple emoji in one message", () => {
    const result = mrkdwnToMarkdown(":wave: hello :heart:");
    assert.equal(result, "👋 hello ❤️");
  });
});
