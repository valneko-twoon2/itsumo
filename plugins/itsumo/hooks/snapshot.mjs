// SessionStart フック: セッション開始時の未コミットのファイルとその内容を記録する（lib/snapshot.mjs）。Stop フックは、
// この記録と内容が同じファイルを催促しない: セッションの前からあったユーザー自身の変更は、エージェントのものではない。
// 何も出力せず、開始を失敗させることはない。
import { pathToFileURL } from 'node:url';
import { loadConfig, projectRoot } from '../lib/config.mjs';
import { worktreeRoots } from '../lib/git.mjs';
import { saveSnapshot } from '../lib/snapshot.mjs';

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
let raw = '';
if (isMain) process.stdin.on('data', (c) => (raw += c));
if (isMain)
  process.stdin.on('end', () => {
    try {
      const input = JSON.parse(raw || '{}');
      const project = projectRoot();
      const { stop } = loadConfig(project);
      if (!stop.commit) return;
      saveSnapshot(input?.session_id, worktreeRoots(project), stop.ignore);
    } catch {
      // 開始は決して失敗させない。
    }
  });
