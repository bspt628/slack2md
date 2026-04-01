import { WebClient } from "@slack/web-api";

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

/**
 * Resolve user IDs to display names. Returns a Map<userId, displayName>.
 */
export async function resolveUsers(client, userIds) {
  const users = new Map();
  const unique = [...new Set(userIds)];

  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((id) => client.users.info({ user: id }))
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        const user = results[j].value.user;
        users.set(
          batch[j],
          user.profile?.display_name || user.real_name || user.name
        );
      } else {
        console.error(`Warning: could not resolve user ${batch[j]}`);
      }
    }
  }

  return users;
}

/**
 * Resolve channel IDs to channel names. Returns a Map<channelId, channelName>.
 */
export async function resolveChannels(client, channelIds) {
  const channels = new Map();
  const unique = [...new Set(channelIds)];

  for (let i = 0; i < unique.length; i += 10) {
    const batch = unique.slice(i, i + 10);
    const results = await Promise.allSettled(
      batch.map((id) => client.conversations.info({ channel: id }))
    );
    for (let j = 0; j < results.length; j++) {
      if (results[j].status === "fulfilled") {
        channels.set(batch[j], results[j].value.channel.name);
      } else {
        console.error(`Warning: could not resolve channel ${batch[j]}`);
      }
    }
  }

  return channels;
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
    // Message author
    if (msg.user) userIds.add(msg.user);

    const text = msg.text ?? "";
    // User mentions
    for (const match of text.matchAll(/<@(U[A-Z0-9]+)/g)) {
      userIds.add(match[1]);
    }
    // Channel mentions
    for (const match of text.matchAll(/<#(C[A-Z0-9]+)/g)) {
      channelIds.add(match[1]);
    }
  }

  return {
    userIds: [...userIds],
    channelIds: [...channelIds],
  };
}
