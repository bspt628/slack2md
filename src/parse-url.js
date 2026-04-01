/**
 * Parse a Slack URL into channelId and optional threadTs.
 *
 * Supported formats:
 *   https://<workspace>.slack.com/archives/<channelId>
 *   https://<workspace>.slack.com/archives/<channelId>/p<timestamp>
 *   https://app.slack.com/client/<teamId>/<channelId>/<threadTs>
 *
 * Thread timestamp in URL: p1234567890123456 -> 1234567890.123456
 */
export function parseSlackUrl(url) {
  // archives format (most common when copying link from Slack)
  const archiveMatch = url.match(
    /slack\.com\/archives\/([A-Z0-9]+)(?:\/p(\d+))?/
  );
  if (archiveMatch) {
    const channelId = archiveMatch[1];
    const threadTs = archiveMatch[2] ? pToTs(archiveMatch[2]) : null;
    return { channelId, threadTs };
  }

  // client format
  const clientMatch = url.match(
    /slack\.com\/client\/[A-Z0-9]+\/([A-Z0-9]+)(?:\/(\d+\.\d+))?/
  );
  if (clientMatch) {
    return {
      channelId: clientMatch[1],
      threadTs: clientMatch[2] ?? null,
    };
  }

  throw new Error(
    `Could not parse Slack URL: ${url}\n` +
      "Expected format: https://<workspace>.slack.com/archives/<channelId>/p<timestamp>"
  );
}

/**
 * Convert Slack URL timestamp (1234567890123456) to API timestamp (1234567890.123456).
 * Expects exactly 16 digits: 10 digits (seconds) + 6 digits (microseconds).
 */
function pToTs(p) {
  if (p.length !== 16) {
    throw new Error(
      `Invalid Slack timestamp format: expected 16 digits, got ${p.length} ("${p}")`
    );
  }
  const seconds = p.slice(0, 10);
  const micro = p.slice(10);
  return `${seconds}.${micro}`;
}
