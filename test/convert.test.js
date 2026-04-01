import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { mrkdwnToMarkdown } from "../src/convert.js";

describe("mrkdwnToMarkdown", () => {
  it("converts bold", () => {
    assert.equal(mrkdwnToMarkdown("*hello*"), "**hello**");
  });

  it("converts strikethrough", () => {
    assert.equal(mrkdwnToMarkdown("~deleted~"), "~~deleted~~");
  });

  it("preserves italic", () => {
    assert.equal(mrkdwnToMarkdown("_italic_"), "_italic_");
  });

  it("converts links with label", () => {
    assert.equal(
      mrkdwnToMarkdown("<https://example.com|Example>"),
      "[Example](https://example.com)"
    );
  });

  it("converts bare links", () => {
    assert.equal(
      mrkdwnToMarkdown("<https://example.com>"),
      "https://example.com"
    );
  });

  it("converts user mentions", () => {
    const users = new Map([["U123", "tanaka"]]);
    assert.equal(mrkdwnToMarkdown("<@U123>", { users }), "@tanaka");
  });

  it("converts channel mentions", () => {
    const channels = new Map([["C456", "general"]]);
    assert.equal(mrkdwnToMarkdown("<#C456|general>", { channels }), "#general");
  });

  it("decodes HTML entities", () => {
    assert.equal(mrkdwnToMarkdown("a &amp; b"), "a & b");
    assert.equal(mrkdwnToMarkdown("1 &lt; 2"), "1 < 2");
    assert.equal(mrkdwnToMarkdown("3 &gt; 2"), "3 > 2");
  });

  it("converts blockquotes", () => {
    assert.equal(mrkdwnToMarkdown("&gt; quoted text"), "> quoted text");
  });

  it("preserves code spans", () => {
    assert.equal(mrkdwnToMarkdown("`*not bold*`"), "`*not bold*`");
  });

  it("preserves code blocks", () => {
    assert.equal(
      mrkdwnToMarkdown("```\n*not bold*\n```"),
      "```\n*not bold*\n```"
    );
  });

  it("does not double-wrap already starred text", () => {
    // Slack doesn't use ** but if text has ** we should not break it
    const result = mrkdwnToMarkdown("*bold*");
    assert.equal(result, "**bold**");
    // Should not produce ****
    assert.ok(!result.includes("****"));
  });

  it("converts bullet lists", () => {
    assert.equal(mrkdwnToMarkdown("• item 1\n• item 2"), "- item 1\n- item 2");
  });

  it("converts mailto links", () => {
    assert.equal(
      mrkdwnToMarkdown("<mailto:test@example.com|test@example.com>"),
      "[test@example.com](mailto:test@example.com)"
    );
  });
});
