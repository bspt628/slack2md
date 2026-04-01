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
git clone https://github.com/bspt628/slack2md.git
cd slack2md
npm install
npm link
```

## Slack App の作成手順

このツールを使うには、Slack App を作成して User Token を取得する必要があります。

### 1. Slack App を新規作成

1. https://api.slack.com/apps を開く
2. 「Create New App」をクリック
3. 「From scratch」を選択
4. App Name に任意の名前を入力（例: `slack2md`）
5. 使いたいワークスペースを選択して「Create App」

### 2. User Token Scopes を設定

左メニューの「OAuth & Permissions」を開き、ページ下部の「User Token Scopes」セクションで「Add an OAuth Scope」をクリックして以下を追加:

| スコープ | 用途 |
|---|---|
| `channels:history` | パブリックチャンネルのメッセージ読み取り |
| `channels:read` | パブリックチャンネル情報の取得 |
| `groups:history` | プライベートチャンネルのメッセージ読み取り |
| `groups:read` | プライベートチャンネル情報の取得 |
| `users:read` | ユーザー名の解決（メンションの表示名変換） |

注意: 「Bot Token Scopes」ではなく「User Token Scopes」に追加してください。User Token はあなた自身のアクセス権限で動作するため、自分が参加しているすべてのチャンネルのメッセージを取得できます。

DM も取得したい場合は以下も追加:

| スコープ | 用途 |
|---|---|
| `im:history` | 1対1 DM の読み取り |
| `mpim:history` | グループ DM の読み取り |

### 3. ワークスペースにインストール

1. 同じ「OAuth & Permissions」ページの上部にある「Install to Workspace」をクリック
2. 権限の確認画面で「Allow」をクリック
3. 「User OAuth Token」として `xoxp-...` で始まるトークンが表示される
4. このトークンをコピーする

### 4. トークンを環境変数に設定

プロジェクトルート（または任意の作業ディレクトリ）に `.env` ファイルを作成:

```bash
cp .env.example .env
```

`.env` を編集してトークンを設定:

```
SLACK_TOKEN=xoxp-your-token-here
```

または、シェルの環境変数として設定:

```bash
# ~/.bashrc や ~/.zshrc に追加
export SLACK_TOKEN=xoxp-your-token-here
```

`.env` ファイルは `.gitignore` に含まれているため、誤ってコミットされることはありません。

## 使い方

### スレッドを Markdown に変換

Slack でスレッドのリンクをコピーし、そのまま引数に渡す:

```bash
slack2md "https://your-workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456"
```

Slack でリンクをコピーするには: メッセージにカーソルを合わせ → 「...」メニュー → 「Copy link」

### チャンネルの直近メッセージを取得

デフォルトで直近100件のメッセージを取得します:

```bash
slack2md "https://your-workspace.slack.com/archives/C01ABCD2EFG"
```

`--limit` で取得件数を変更できます:

```bash
slack2md --limit 500 "https://your-workspace.slack.com/archives/C01ABCD2EFG"
```

### 出力先を指定

```bash
slack2md -o meeting-notes.md "https://your-workspace.slack.com/archives/C01ABCD2EFG/p1234567890123456"
```

出力先を省略した場合、`<チャンネル名>-thread-<タイムスタンプ>-<日付>.md` のようなファイル名で自動生成されます。同名のファイルが既に存在する場合はエラーになります（`--force` で上書き可能）。

### --token フラグで直接指定

`.env` を使わず、コマンドで直接トークンを渡すこともできます:

```bash
slack2md --token xoxp-your-token "https://..."
```

トークンの優先順位: `--token` フラグ > `SLACK_TOKEN` 環境変数 > `.env` ファイル

## 出力例

```markdown
# #general

---

@tanaka -- 2026-04-01 10:00 (UTC+09:00)

ここにメッセージ本文が入る。
リンクは [表示テキスト](https://example.com) に変換される。

---

@suzuki -- 2026-04-01 10:05 (UTC+09:00)

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
