# slack2md

Slack のメッセージやスレッドを Markdown ファイルに変換する CLI ツール。

- スレッド全体を1つの `.md` ファイルに出力
- ユーザー名・チャンネル名を自動解決
- Slack の mrkdwn 記法を標準 Markdown に変換
- リアクション・添付ファイル・リンクプレビューにも対応

## インストール

```bash
npm install -g slack2md
```

または、リポジトリをクローンして直接使う:

```bash
git clone https://github.com/uchidahiroto/slack2md.git
cd slack2md
npm install
npm link
```

## Slack App のセットアップ

1. [Slack API](https://api.slack.com/apps) にアクセスし、「Create New App」→「From scratch」を選択
2. 「OAuth & Permissions」ページで、User Token Scopes に以下を追加:
   - `channels:history` — パブリックチャンネルのメッセージ読み取り
   - `channels:read` — パブリックチャンネル情報の取得
   - `groups:history` — プライベートチャンネルのメッセージ読み取り
   - `groups:read` — プライベートチャンネル情報の取得
   - `users:read` — ユーザー名の解決
3. 「Install to Workspace」をクリックして認可
4. 表示される `xoxp-...` トークンをコピー

## 使い方

### 環境変数でトークンを設定（推奨）

```bash
export SLACK_TOKEN=xoxp-your-token-here
```

### スレッドを Markdown に変換

Slack でスレッドのリンクをコピーし、そのまま引数に渡す:

```bash
slack2md "https://your-workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456"
```

### チャンネルの直近メッセージを取得

```bash
slack2md "https://your-workspace.slack.com/archives/C01ABCD2EFG"
```

### 出力先を指定

```bash
slack2md -o meeting-notes.md "https://your-workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456"
```

### --token フラグで直接指定

```bash
slack2md --token xoxp-your-token "https://..."
```

## 出力例

```markdown
# #general

---

@tanaka -- 2026-04-01 10:00

ここにメッセージ本文が入る。
リンクは [表示テキスト](https://example.com) に変換される。

---

@suzuki -- 2026-04-01 10:05

返信メッセージがここに。
:thumbsup: (3)  :eyes: (1)
```

## ライブラリとして使う

```js
import { mrkdwnToMarkdown, parseSlackUrl } from "slack2md";

const md = mrkdwnToMarkdown("*hello* _world_ <https://example.com|link>");
// => "**hello** _world_ [link](https://example.com)"

const { channelId, threadTs } = parseSlackUrl(
  "https://workspace.slack.com/archives/C01ABC/p1234567890123456"
);
```

## mrkdwn → Markdown 変換ルール

| Slack mrkdwn | Markdown |
|---|---|
| `*bold*` | `**bold**` |
| `_italic_` | `_italic_` |
| `~strike~` | `~~strike~~` |
| `<url\|text>` | `[text](url)` |
| `<@U123>` | `@username` |
| `<#C123\|name>` | `#name` |
| `` `code` `` | `` `code` `` |
| ` ```block``` ` | ` ```block``` ` |

## License

MIT
