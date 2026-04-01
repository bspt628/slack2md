import { describe, it, before, after } from "node:test";
import assert from "node:assert/strict";
import { readUrlsFromFile } from "../src/cli.js";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

const testDir = join(tmpdir(), "slack2md-cli-test-" + Date.now());

describe("readUrlsFromFile", () => {
  before(() => {
    mkdirSync(testDir, { recursive: true });
  });

  after(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  it("reads URLs from a file, one per line", () => {
    const filePath = join(testDir, "urls.txt");
    writeFileSync(filePath, [
      "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456",
      "https://workspace.slack.com/archives/C99XYZ0000/p6543210987654321",
    ].join("\n"));

    const urls = readUrlsFromFile(filePath);
    assert.equal(urls.length, 2);
    assert.equal(urls[0], "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456");
    assert.equal(urls[1], "https://workspace.slack.com/archives/C99XYZ0000/p6543210987654321");
  });

  it("ignores blank lines", () => {
    const filePath = join(testDir, "urls-blank.txt");
    writeFileSync(filePath, [
      "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456",
      "",
      "   ",
      "https://workspace.slack.com/archives/C99XYZ0000/p6543210987654321",
      "",
    ].join("\n"));

    const urls = readUrlsFromFile(filePath);
    assert.equal(urls.length, 2);
  });

  it("ignores comment lines starting with #", () => {
    const filePath = join(testDir, "urls-comments.txt");
    writeFileSync(filePath, [
      "# This is a comment",
      "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456",
      "# Another comment",
      "https://workspace.slack.com/archives/C99XYZ0000/p6543210987654321",
    ].join("\n"));

    const urls = readUrlsFromFile(filePath);
    assert.equal(urls.length, 2);
    assert.equal(urls[0], "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456");
    assert.equal(urls[1], "https://workspace.slack.com/archives/C99XYZ0000/p6543210987654321");
  });

  it("trims whitespace from each line", () => {
    const filePath = join(testDir, "urls-whitespace.txt");
    writeFileSync(filePath, [
      "  https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456  ",
      "\thttps://workspace.slack.com/archives/C99XYZ0000/p6543210987654321\t",
    ].join("\n"));

    const urls = readUrlsFromFile(filePath);
    assert.equal(urls.length, 2);
    assert.equal(urls[0], "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456");
    assert.equal(urls[1], "https://workspace.slack.com/archives/C99XYZ0000/p6543210987654321");
  });

  it("handles Windows-style line endings (CRLF)", () => {
    const filePath = join(testDir, "urls-crlf.txt");
    writeFileSync(filePath,
      "https://workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456\r\n" +
      "https://workspace.slack.com/archives/C99XYZ0000/p6543210987654321\r\n"
    );

    const urls = readUrlsFromFile(filePath);
    assert.equal(urls.length, 2);
  });

  it("returns empty array for empty file", () => {
    const filePath = join(testDir, "urls-empty.txt");
    writeFileSync(filePath, "");

    const urls = readUrlsFromFile(filePath);
    assert.equal(urls.length, 0);
  });

  it("throws on non-existent file", () => {
    assert.throws(() => readUrlsFromFile(join(testDir, "nonexistent.txt")), {
      code: "ENOENT",
    });
  });
});
