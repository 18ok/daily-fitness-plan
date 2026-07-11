import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));

function hasCommit(ref) {
  const result = spawnSync('git', ['rev-parse', '--verify', '--quiet', `${ref}^{commit}`], {
    cwd: root,
    stdio: 'ignore',
  });
  return result.status === 0;
}

function checkDiff(args) {
  const result = spawnSync('git', ['diff', '--check', ...args], {
    cwd: root,
    encoding: 'utf8',
  });
  if (result.stdout) process.stdout.write(result.stdout);
  if (result.stderr) process.stderr.write(result.stderr);
  if (result.status !== 0) process.exit(result.status ?? 1);
}

const target = ['main', 'origin/main'].find(hasCommit);
if (!target) {
  throw new Error('Cannot verify maintenance diff: neither main nor origin/main resolves to a commit.');
}

const mergeBase = execFileSync('git', ['merge-base', 'HEAD', target], {
  cwd: root,
  encoding: 'utf8',
}).trim();

checkDiff([`${mergeBase}..HEAD`]);
checkDiff([]);
checkDiff(['--cached']);

console.log(`ok - maintenance diff whitespace (${target} merge base ${mergeBase.slice(0, 12)})`);
