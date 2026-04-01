import { WebClient } from "@slack/web-api";
import { logWarning } from "./logger.js";

export function createClient(token) {
  return new WebClient(token);
}

/**
 * Fetch messages from a channel. If threadTs is provided, fetch the thread replies.
 */
export async function fetchMessages(client, channelId, threadTs, { limit } = {}) {
  if (threadTs) {
    return fetchThread(client, channelId, threadTs);
  }
  return fetchChannelHistory(client, channelId, limit);
}

async function fetchThread(client, channelId, threadTs) {
  const messages = [];
  let cursor;

  do {
    const res = await client.conversations.replies({
      channel: channelId,
      ts: threadTs,
      limit: 200,
      cursor,
    });
    messages.push(...res.messages);
    cursor = res.response_metadata?.next_cursor;
  } while (cursor);

  return messages;
}

const DEFAULT_CHANNEL_LIMIT = 100;

async function fetchChannelHistory(client, channelId, limit) {
  const max = limit ?? DEFAULT_CHANNEL_LIMIT;
  const messages = [];
  let cursor;

  do {
    const batchSize = Math.min(200, max - messages.length);
    const res = await client.conversations.history({
      channel: channelId,
      limit: batchSize,
      cursor,
    });
    messages.push(...(res.messages ?? []));
    cursor = res.response_metadata?.next_cursor;
  } while (cursor && messages.length < max);

  // API returns newest first — reverse to chronological order
  return messages.slice(0, max).reverse();
}

async function batchResolve(ids, fetcher, extractor, label) {
  const map = new Map();
  const unique = [...new Set(ids)];

  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const results = await Promise.allSettled(batch.map(fetcher));
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        map.set(batch[j], extractor(results[j].value));
      } else {
        logWarning(`Warning: could not resolve ${label} ${batch[j]}`);
      }
    }
  }

  return map;
}

/**
 * Resolve user IDs to display names. Returns a Map<userId, displayName>.
 */
export async function resolveUsers(client, userIds) {
  return batchResolve(
    userIds,
    (id) => client.users.info({ user: id }),
    (res) => res.user.profile?.display_name || res.user.real_name || res.user.name,
    "user"
  );
}

/**
 * Resolve channel IDs to channel names. Returns a Map<channelId, channelName>.
 */
export async function resolveChannels(client, channelIds) {
  return batchResolve(
    channelIds,
    (id) => client.conversations.info({ channel: id }),
    (res) => res.channel.name,
    "channel"
  );
}

/**
 * Get channel info (name, etc.)
 */
export async function getChannelInfo(client, channelId) {
  const res = await client.conversations.info({ channel: channelId });
  return res.channel;
}

/**
 * Extract user IDs and channel IDs referenced in messages.
 */
export function extractMentionedIds(messages) {
  const userIds = new Set();
  const channelIds = new Set();

  for (const msg of messages) {
    if (msg.user) userIds.add(msg.user);

    const text = msg.text ?? "";
    for (const match of text.matchAll(/<@(U[A-Z0-9]+)/g)) {
      userIds.add(match[1]);
    }
    for (const match of text.matchAll(/<#(C[A-Z0-9]+)/g)) {
      channelIds.add(match[1]);
    }
  }

  return {
    userIds: [...userIds],
    channelIds: [...channelIds],
  };
}
