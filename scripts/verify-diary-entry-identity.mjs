import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, rmSync } from 'node:fs';

const outDir = '.tmp/diary-entry-identity-test';
if (existsSync(outDir)) {
  rmSync(outDir, { recursive: true, force: true });
}

execFileSync(
  process.execPath,
  [
    'node_modules/typescript/bin/tsc',
    'src/utils/diaryIdentity.ts',
    '--outDir',
    outDir,
    '--module',
    'NodeNext',
    '--moduleResolution',
    'NodeNext',
    '--target',
    'ES2022',
    '--skipLibCheck',
    '--strict',
  ],
  { stdio: 'inherit' }
);

const identity = await import(`../${outDir}/utils/diaryIdentity.js`);
const {
  createDiaryEntryId,
  createDiaryTimestampForDate,
  getDiaryDateId,
  getEntriesForDate,
  shouldDisplayEntryTime,
} = identity;

const now = new Date('2026-06-13T21:37:50+08:00');
const timestamp = createDiaryTimestampForDate('2026-06-12', now);
const timestampDate = new Date(timestamp);
assert.equal(timestampDate.getFullYear(), 2026);
assert.equal(timestampDate.getMonth(), 5);
assert.equal(timestampDate.getDate(), 12);
assert.equal(timestampDate.getHours(), 21);
assert.equal(timestampDate.getMinutes(), 37);
assert.equal(timestampDate.getSeconds(), 0);
assert.equal(timestampDate.getMilliseconds(), 0);

assert.equal(createDiaryEntryId(timestamp, new Set()), '2026-06-12-2137');
assert.equal(createDiaryEntryId(timestamp, new Set(['2026-06-12-2137'])), '2026-06-12-2137-2');
assert.equal(
  createDiaryEntryId(timestamp, new Set(['2026-06-12-2137', '2026-06-12-2137-2'])),
  '2026-06-12-2137-3'
);

const legacyEntry = {
  id: '2026-06-12',
  date: new Date('2026-06-12T00:00:00+08:00').getTime(),
  content: 'legacy',
  wordCount: 6,
};
const timedEntry = {
  id: '2026-06-12-2137',
  date: timestamp,
  createdAt: timestamp,
  content: 'timed',
  wordCount: 5,
};
const otherEntry = {
  id: '2026-06-11-2200',
  date: new Date('2026-06-11T22:00:00+08:00').getTime(),
  createdAt: new Date('2026-06-11T22:00:00+08:00').getTime(),
  content: 'other',
  wordCount: 5,
};

assert.equal(getDiaryDateId(legacyEntry), '2026-06-12');
assert.equal(getDiaryDateId(timedEntry), '2026-06-12');
assert.equal(shouldDisplayEntryTime(legacyEntry), false);
assert.equal(shouldDisplayEntryTime(timedEntry), true);

const selectedEntries = getEntriesForDate([legacyEntry, otherEntry, timedEntry], new Date('2026-06-12T08:00:00+08:00'));
assert.deepEqual(selectedEntries.map((entry) => entry.id), ['2026-06-12-2137', '2026-06-12']);

console.log('diary entry identity checks passed');
