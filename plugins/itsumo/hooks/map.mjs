// SessionStart / SubagentStart フック: プロジェクトのアーキテクチャマップ（.claude/itsumo.json の `map` のうち存在する
// 最初のページ。既定は docs/architecture/README.md）を、メインセッションとすべてのサブエージェントの最初に追加コンテキスト
// として差し込む。組み込みの Explore や Plan はプロジェクトの指示を読まないし、読むエージェントでも「ここにある」と
// 指されるだけのマップは飛ばしがち。開始を失敗させることはない: ページが無ければ何も出さない。
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';

const EVENTS = new Set(['SessionStart', 'SubagentStart']);

/** `event` に対するフックの JSON 応答。対象外のイベントか、マップのページが無ければ null。 */
export function contextFor(event, root, config = loadConfig(root)) {
  if (!EVENTS.has(event) || !config.map) return null;
  const pages = Array.isArray(config.map) ? config.map : [config.map];
  const rel = pages.find((p) => typeof p === 'string' && existsSync(join(root, p)));
  if (!rel) return null;
  let page = readFileSync(join(root, rel), 'utf8').replace(/\r\n/g, '\n').trim();
  const limit = Number(config.mapLimit) || 12000;
  if (Buffer.byteLength(page) > limit) page = `${Buffer.from(page).subarray(0, limit).toString('utf8')}\n\n[${limit} バイトで切った。続きは ${rel} を読むこと]`;
  const additionalContext = `このリポジトリのアーキテクチャマップ（${rel}）。何かを探す前にまず読むこと。ファイル一覧ではなく案内なので、ファイルそのものはツリーを検索して見つける。\n\n${page}`;
  return { hookSpecificOutput: { hookEventName: event, additionalContext } };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}');
      const answer = contextFor(input?.hook_event_name, resolve(projectRoot()));
      if (answer) console.log(JSON.stringify(answer));
    } catch {
      // 開始は決して失敗させない。
    }
  });
