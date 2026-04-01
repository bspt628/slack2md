import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import { parseDateToTimestamp } from "../src/cli.js";
import { fetchMessages } from "../src/slack.js";

describe("parseDateToTimestamp", () => {
  it("parses a valid date string to a Unix timestamp", () => {
    const ts = parseDateToTimestamp("2026-03-01");
    assert.ok(ts !== null);
    const date = new Date(parseFloat(ts) * 1000);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 2); // March = 2
    assert.equal(date.getDate(), 1);
    assert.equal(date.getHours(), 0);
    assert.equal(date.getMinutes(), 0);
  });

  it("returns end-of-day timestamp when endOfDay is true", () => {
    const ts = parseDateToTimestamp("2026-03-31", true);
    assert.ok(ts !== null);
    const date = new Date(parseFloat(ts) * 1000);
    assert.equal(date.getFullYear(), 2026);
    assert.equal(date.getMonth(), 2);
    assert.equal(date.getDate(), 31);
    assert.equal(date.getHours(), 23);
    assert.equal(date.getMinutes(), 59);
    assert.equal(date.getSeconds(), 59);
  });

  it("returns null for invalid date format", () => {
    assert.equal(parseDateToTimestamp("03-01-2026"), null);
    assert.equal(parseDateToTimestamp("2026/03/01"), null);
    assert.equal(parseDateToTimestamp("not-a-date"), null);
    assert.equal(parseDateToTimestamp(""), null);
  });

  it("returns null for invalid date values", () => {
    assert.equal(parseDateToTimestamp("2026-13-01"), null);
    assert.equal(parseDateToTimestamp("2026-00-01"), null);
  });

  it("returns a string", () => {
    const ts = parseDateToTimestamp("2026-06-15");
    assert.equal(typeof ts, "string");
  });
});

describe("fetchMessages with date parameters", () => {
  it("passes oldest/latest to conversations.history", async () => {
    const historyMock = mock.fn(() =>
      Promise.resolve({
        messages: [{ ts: "1709290000.000000", text: "hello" }],
        response_metadata: {},
      })
    );

    const fakeClient = {
      conversations: {
        history: historyMock,
      },
    };

    await fetchMessages(fakeClient, "C123", null, {
      limit: 10,
      oldest: "1709251200",
      latest: "1709337600",
    });

    assert.equal(historyMock.mock.calls.length, 1);
    const callArgs = historyMock.mock.calls[0].arguments[0];
    assert.equal(callArgs.oldest, "1709251200");
    assert.equal(callArgs.latest, "1709337600");
    assert.equal(callArgs.channel, "C123");
  });

  it("does not include oldest/latest when not specified", async () => {
    const historyMock = mock.fn(() =>
      Promise.resolve({
        messages: [{ ts: "1709290000.000000", text: "hello" }],
        response_metadata: {},
      })
    );

    const fakeClient = {
      conversations: {
        history: historyMock,
      },
    };

    await fetchMessages(fakeClient, "C123", null, { limit: 10 });

    const callArgs = historyMock.mock.calls[0].arguments[0];
    assert.equal(callArgs.oldest, undefined);
    assert.equal(callArgs.latest, undefined);
  });

  it("filters thread replies by timestamp range", async () => {
    const repliesMock = mock.fn(() =>
      Promise.resolve({
        messages: [
          { ts: "1709200000.000000", text: "before range" },
          { ts: "1709290000.000000", text: "in range" },
          { ts: "1709400000.000000", text: "after range" },
        ],
        response_metadata: {},
      })
    );

    const fakeClient = {
      conversations: {
        replies: repliesMock,
      },
    };

    const messages = await fetchMessages(fakeClient, "C123", "1709200000.000000", {
      oldest: "1709250000",
      latest: "1709350000",
    });

    // Only the "in range" message should remain
    assert.equal(messages.length, 1);
    assert.equal(messages[0].text, "in range");
  });

  it("passes oldest/latest to conversations.replies for threads", async () => {
    const repliesMock = mock.fn(() =>
      Promise.resolve({
        messages: [{ ts: "1709290000.000000", text: "reply" }],
        response_metadata: {},
      })
    );

    const fakeClient = {
      conversations: {
        replies: repliesMock,
      },
    };

    await fetchMessages(fakeClient, "C123", "1709200000.000000", {
      oldest: "1709251200",
      latest: "1709337600",
    });

    const callArgs = repliesMock.mock.calls[0].arguments[0];
    assert.equal(callArgs.oldest, "1709251200");
    assert.equal(callArgs.latest, "1709337600");
  });
});
