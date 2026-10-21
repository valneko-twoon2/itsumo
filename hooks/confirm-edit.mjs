// PreToolUse フック（Write / Edit / MultiEdit）: 手で書き換えると困るファイルの編集の前に、ユーザーへ確認させる
// （permissionDecision: "ask"）。対象は、秘密を持ちやすいファイル（.env、鍵、証明書。`.env.example` などの見本は除く）、
// ロックファイル、生成物のフォルダ（node_modules、dist など）の中。一覧は `.claude/itsumo.json` の `protect.files` / `protect.dirs`。
// `protect.edits: false` か ITSUMO_DISABLE=protect で止める。失敗しても作業は止めない。
import { isAbsolute, relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';
import { protectedReason } from '../lib/protect.mjs';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const file = JSON.parse(raw || '{}')?.tool_input?.file_path;
      if (typeof file !== 'string') return;
      const project = projectRoot();
      const { protect } = loadConfig(project);
      if (!protect.edits) return;
      const path = resolve(project, file);
      const rel = relative(project, path);
      // プロジェクトの外のファイルは、フォルダ名の一致で判定する（絶対パスのまま）。
      const why = protectedReason(rel.startsWith('..') || isAbsolute(rel) ? path : rel, protect);
      if (!why) return;
      const reason = `itsumo: ${file} を編集する前に確認する。${why}。`;
      process.stdout.write(JSON.stringify({ hookSpecificOutput: { hookEventName: 'PreToolUse', permissionDecision: 'ask', permissionDecisionReason: reason } }));
    } catch {
      // フック自体の失敗で作業を止めない。
    }
  });
