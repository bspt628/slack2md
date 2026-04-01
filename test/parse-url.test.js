import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { parseSlackUrl } from "../src/parse-url.js";

describe("parseSlackUrl", () => {
  it("parses archive URL with thread", () => {
    const result = parseSlackUrl(
      "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456"
    );
    assert.equal(result.channelId, "C01ABCD2EFG");
    assert.equal(result.threadTs, "1234567890.123456");
  });

  it("parses archive URL without thread", () => {
    const result = parseSlackUrl(
      "https://workspace.slack.com/archives/C01ABCD2EFG"
    );
    assert.equal(result.channelId, "C01ABCD2EFG");
    assert.equal(result.threadTs, null);
  });

  it("parses client format URL", () => {
    const result = parseSlackUrl(
      "https://app.slack.com/client/T01234/C01ABCD2EFG/1234567890.123456"
    );
    assert.equal(result.channelId, "C01ABCD2EFG");
    assert.equal(result.threadTs, "1234567890.123456");
  });

  it("throws on invalid URL", () => {
    assert.throws(() => parseSlackUrl("https://example.com"), {
      message: /Could not parse Slack URL/,
    });
  });

  it("throws on invalid timestamp length", () => {
    assert.throws(
      () =>
        parseSlackUrl(
          "https://workspace.slack.com/archives/C01ABCD2EFG/p12345"
        ),
      { message: /Invalid Slack timestamp/ }
    );
  });
});
