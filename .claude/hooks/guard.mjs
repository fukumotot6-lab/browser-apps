// Claude Codeのフックから呼ばれる安全装置。方針は docs/conventions.md の「作業の安全装置」を参照。
//
// 人間の承認が必要な操作を検知して、実行前に確認を求める。コマンド文字列の
// パターン照合なので、すり抜けはありうる。規約を守る責任を置き換えるものではない。
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import process from 'node:process';

const root = path.resolve(import.meta.dirname, '../..');

// 人間が書いた原本と、その写し。Claude Codeが内容を変える理由がない。
const PROTECTED_PATTERNS = [
  /^requirements\.md$/i,
  /^apps\/[^/]+\/docs\/requirements\.md$/i,
];

const COMMAND_RULES = [
  {
    pattern: /\bgit\s+push\b.*(--force|--force-with-lease|\s-f\b|\s\+\S)/,
    reason: '強制プッシュは人間の承認が必要です。',
  },
  {
    pattern: /\bgit\s+push\b.*\bmain\b/,
    reason: 'mainブランチへのプッシュは人間の承認が必要です。',
  },
  {
    pattern: /\bgit\s+push\b|\bgh\s+pr\s+create\b/,
    reason: 'プッシュとPRの作成は公開される操作です。人間の承認が必要です。',
  },
  {
    pattern:
      /\bgit\s+(reset\s+--hard|clean\b|checkout\s+(--|\.)|restore\b(?!.*--staged)|rebase\b|filter-branch|filter-repo|commit\b.*--amend)/,
    reason:
      '作業ツリーの変更を破棄する操作、または履歴を書き換える操作です。対象を確認してください。',
  },
  {
    pattern: /\bgit\s+merge\b|\bgh\s+pr\s+merge\b/,
    reason: 'マージは人間が行います。',
  },
  {
    pattern: /\bgh\s+pr\s+(review\b.*(--approve|\s-a\b)|close\b)/,
    reason: 'PRの承認と、PRを閉じる判断は人間が行います。',
  },
  {
    // PRのコメントへの返信はAPIへの書き込みだが、リポジトリ設定の変更ではないので対象から外す。
    pattern:
      /\bgh\s+(repo\s+(edit|delete|rename|archive)|secret\b|variable\b|ruleset\b|workflow\s+(enable|disable|run)|api\b(?!.*\/(pulls|issues)\/(comments\/)?\d+\/(comments|replies)\b).*(-X|--method)[\s=]*(POST|PUT|PATCH|DELETE))/i,
    reason: 'リポジトリ設定の変更は、手順を示して人間に依頼します。',
  },
  {
    // 未追跡のファイルは削除すると元に戻せないので、1ファイルの削除でも確認する。
    pattern:
      /(^|[\s;&|(])(rm|rmdir|rd|del|erase|unlink|Remove-Item|ri)\s|\bgit\s+rm\b/i,
    reason:
      'ファイルまたはディレクトリを削除する操作です。対象を確認してください。',
  },
  {
    pattern: /\bnpm\s+audit\s+fix\b/,
    reason: '依存パッケージの変更は人間の承認が必要です。',
  },
];

const BULK_REWRITE =
  /\bprettier\b.*(--write|\s-w\b)|\bnpm\s+run\s+format\b(?!:)|\beslint\b.*--fix|\bsed\s+(-\w*i|--in-place)|\bperl\s+-\w*i/;

function git(...args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim();
}

function toRelative(file) {
  return path
    .relative(root, path.resolve(root, file))
    .split(path.sep)
    .join('/');
}

function isProtected(relativePath) {
  return PROTECTED_PATTERNS.some((pattern) => pattern.test(relativePath));
}

function listProtectedFiles() {
  const candidates = ['requirements.md'];
  const appsDir = path.join(root, 'apps');
  if (existsSync(appsDir)) {
    for (const app of readdirSync(appsDir)) {
      candidates.push(`apps/${app}/docs/requirements.md`);
    }
  }
  return candidates.filter((file) => existsSync(path.join(root, file)));
}

// 引用符の中身とヒアドキュメントの本文は、コミットメッセージなどの文章であることが
// 多い。そこに含まれる単語で誤検知しないよう、照合の前に取り除く。
function stripQuotedText(command) {
  return command
    .replace(/<<-?\s*(['"]?)(\w+)\1[\s\S]*?\n\s*\2\b/g, '')
    .replace(/@'[\s\S]*?\n'@/g, '')
    .replace(/'[^']*'/g, "''")
    .replace(/"[^"]*"/g, '""');
}

function findPackageChange(command) {
  const match = command.match(
    /\bnpm\s+(install|i|add|uninstall|remove|rm|update|up)\b([^;&|]*)/,
  );
  if (!match) return undefined;
  const packages = match[2].split(/\s+/).filter((t) => t && !t.startsWith('-'));
  return packages.length > 0 ? packages : undefined;
}

function findUnknownNpx(command) {
  const match = command.match(/\bnpx\s+((?:-\S+\s+)*)([^\s;&|]+)/);
  if (!match) return undefined;
  const name = match[2];
  const installed = existsSync(path.join(root, 'node_modules', '.bin', name));
  return installed ? undefined : name;
}

function snapshotDir() {
  const key = createHash('sha256').update(root).digest('hex').slice(0, 16);
  return path.join(tmpdir(), `claude-guard-${key}`);
}

function hashFile(file) {
  return createHash('sha256')
    .update(readFileSync(path.join(root, file)))
    .digest('hex');
}

// 保護対象ファイルのハッシュと控えを、コマンドの実行前に取る。フックの照合を
// すり抜けたコマンドが書き換えた場合でも、実行後に検知して元に戻せるようにするため。
function takeSnapshot() {
  const dir = snapshotDir();
  mkdirSync(dir, { recursive: true });
  const hashes = {};
  for (const file of listProtectedFiles()) {
    hashes[file] = hashFile(file);
    copyFileSync(
      path.join(root, file),
      path.join(dir, file.replaceAll('/', '__')),
    );
  }
  writeFileSync(path.join(dir, 'hashes.json'), JSON.stringify(hashes));
}

function findChangedProtectedFiles() {
  const dir = snapshotDir();
  const hashesPath = path.join(dir, 'hashes.json');
  if (!existsSync(hashesPath)) return [];
  const before = JSON.parse(readFileSync(hashesPath, 'utf8'));
  return Object.entries(before)
    .filter(([file, hash]) => {
      const exists = existsSync(path.join(root, file));
      return !exists || hashFile(file) !== hash;
    })
    .map(([file]) => ({
      file,
      backup: path.join(dir, file.replaceAll('/', '__')),
    }));
}

function ask(reason) {
  process.stdout.write(
    JSON.stringify({
      hookSpecificOutput: {
        hookEventName: 'PreToolUse',
        permissionDecision: 'ask',
        permissionDecisionReason: `[guard] ${reason}`,
      },
    }),
  );
}

function checkEdit(input) {
  const file = input.tool_input?.file_path ?? input.tool_input?.notebook_path;
  if (typeof file !== 'string') return;
  const relativePath = toRelative(file);
  if (isProtected(relativePath)) {
    ask(
      `${relativePath} は保護対象です（人間が書いた要件定義書、またはその写し）。本当に変更しますか。`,
    );
  }
}

function checkCommand(input) {
  takeSnapshot();

  const raw = input.tool_input?.command;
  if (typeof raw !== 'string') return;
  const command = stripQuotedText(raw);

  for (const rule of COMMAND_RULES) {
    if (rule.pattern.test(command)) return ask(rule.reason);
  }

  const packages = findPackageChange(command);
  if (packages) {
    return ask(
      `依存パッケージの追加・削除・更新は人間の承認が必要です: ${packages.join(' ')}`,
    );
  }

  const unknownNpx = findUnknownNpx(command);
  if (unknownNpx) {
    return ask(
      `npx がインストール済みでないパッケージ「${unknownNpx}」を取得して実行します。`,
    );
  }

  if (/\bgit\s+(commit|push)\b/.test(command)) {
    const branch = git('branch', '--show-current');
    if (branch === 'main') {
      return ask(
        '現在のブランチはmainです。直接のコミットとプッシュは人間の承認が必要です。',
      );
    }
  }

  if (BULK_REWRITE.test(command)) {
    const untracked = git('status', '--porcelain', '--untracked-files=all')
      .split('\n')
      .filter((line) => line.startsWith('??'))
      .map((line) => line.slice(3));
    if (untracked.length > 0) {
      const shown = untracked.slice(0, 10).join(', ');
      const rest =
        untracked.length > 10 ? ` ほか${untracked.length - 10}件` : '';
      return ask(
        `ファイルを一括で書き換えるコマンドですが、Gitで復元できない未追跡ファイルがあります: ${shown}${rest}。先に git add するか、対象のファイルを明示してください。`,
      );
    }
  }
}

function checkAfterCommand() {
  const changed = findChangedProtectedFiles();
  if (changed.length === 0) return;
  const detail = changed
    .map(({ file, backup }) => `${file}（実行前の控え: ${backup}）`)
    .join('、');
  process.stdout.write(
    JSON.stringify({
      decision: 'block',
      reason: `[guard] 保護対象のファイルが直前のコマンドで変更されました: ${detail}。作業を止め、控えから元に戻したうえで、人間に報告してください。`,
    }),
  );
}

try {
  const input = JSON.parse(readFileSync(0, 'utf8') || '{}');
  const mode = process.argv[2];
  if (mode === 'pre-edit') checkEdit(input);
  else if (mode === 'pre-command') checkCommand(input);
  else if (mode === 'post-command') checkAfterCommand();
  else throw new Error(`unknown mode: ${mode}`);
} catch (error) {
  // 安全装置そのものが壊れたときに、検査なしで通してしまわないようにする。
  const message = error instanceof Error ? error.message : String(error);
  if (process.argv[2] === 'post-command') {
    process.stdout.write(
      JSON.stringify({
        systemMessage: `[guard] 検査に失敗しました: ${message}`,
      }),
    );
  } else {
    ask(`検査に失敗しました（${message}）。操作の内容を確認してください。`);
  }
}
