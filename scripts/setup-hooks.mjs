// Points git at the versioned hooks in .githooks/ (e.g. the pre-commit test run).
// Runs automatically after `npm install`. It never fails the install: on hosts without
// a git checkout (some CI/deploy builders) there's nothing to set up, which is fine.
import { execSync } from 'node:child_process';

try {
  execSync('git rev-parse --is-inside-work-tree', { stdio: 'ignore' });
  execSync('git config core.hooksPath .githooks', { stdio: 'ignore' });
  console.log('Git hooks enabled: tests will run before each commit.');
} catch {
  // Not a git checkout, or git isn't installed. Skip quietly.
}
