// SessionStart / SubagentStart フック: どの依頼でどのスキルを使うかの短い案内（lib/skill-guide.md）を、メインセッションと
// サブエージェントの最初に追加コンテキストとして差し込む。スキルは説明文だけで選ばれるので、小さいモデルは
// 呼ばずに自力で答えがち。依頼の言い回しとスキルの対応を、開始時に目の前に置いておく。
// `.claude/itsumo.json` の `guide: false` か ITSUMO_DISABLE=guide で止める。開始を失敗させることはない。
import { readFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';

const EVENTS = new Set(['SessionStart', 'SubagentStart']);
const GUIDE = new URL('../lib/skill-guide.md', import.meta.url);

/** `event` に対するフックの JSON 応答。対象外のイベントか、無効の設定なら null。 */
export function contextFor(event, config, text = readFileSync(GUIDE, 'utf8')) {
  if (!EVENTS.has(event) || !config.guide) return null;
  return { hookSpecificOutput: { hookEventName: event, additionalContext: text.replace(/\r\n/g, '\n').trim() } };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}');
      const answer = contextFor(input?.hook_event_name, loadConfig(projectRoot()));
      if (answer) console.log(JSON.stringify(answer));
    } catch {
      // 開始は決して失敗させない。
    }
  });
