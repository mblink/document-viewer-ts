// Refuses a release unless origin has a git tag for the package version that
// points at HEAD. npm publish checks nothing about git, so without this a
// version can reach the registry with no tag, or with a tag on other code.
// Tags have been written both bare (2.0.0-legacy) and v-prefixed
// (v2.1.0-legacy), so either is accepted.
import { execFileSync } from 'node:child_process';
import console from 'node:console';
import process from 'node:process';
import { readFileSync } from 'node:fs';

const git = (...args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

const { version } = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));
const names = [`v${version}`, version];
const head = git('rev-parse', 'HEAD');

// ls-remote prints "<sha>\trefs/tags/<name>" and, for annotated tags, a second
// "<sha>\trefs/tags/<name>^{}" line holding the commit the tag peels to.
const remote = new Map(
  git('ls-remote', '--tags', 'origin', ...names.flatMap((n) => [`refs/tags/${n}`, `refs/tags/${n}^{}`]))
    .split('\n')
    .filter(Boolean)
    .map((line) => {
      const [sha, ref] = line.split('\t');
      return [ref.replace(/^refs\/tags\//, ''), sha];
    }),
);

const found = names.find((n) => remote.has(n));

if (found === undefined) {
  console.error(`No git tag for ${version} on origin (looked for ${names.join(', ')}).`);
  console.error(`Tag the release commit and push it first:\n  git tag v${version} && git push origin v${version}`);
  process.exit(1);
}

const tagged = remote.get(`${found}^{}`) ?? remote.get(found);
if (tagged !== head) {
  console.error(`Tag ${found} points at ${tagged}, but HEAD is ${head}.`);
  console.error('Check out the tagged commit, or move the tag, before publishing.');
  process.exit(1);
}

console.log(`Tag ${found} on origin points at HEAD.`);
