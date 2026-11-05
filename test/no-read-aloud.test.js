const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const PUBLIC = path.join(__dirname, '..', 'public');
const EXTENSIONS = new Set(['.html', '.js', '.css']);
const FORBIDDEN = ['朗读', 'speechSynthesis', 'data-read', 'elderReadPage', 'read-aloud'];

function walk(directory) {
  return fs.readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    return entry.isDirectory() ? walk(full) : [full];
  });
}

test('前端不再包含语音朗读入口与实现', () => {
  const offenders = [];
  for (const file of walk(PUBLIC)) {
    if (!EXTENSIONS.has(path.extname(file).toLowerCase())) continue;
    const source = fs.readFileSync(file, 'utf8');
    for (const phrase of FORBIDDEN) {
      if (source.includes(phrase)) offenders.push(`${path.relative(PUBLIC, file)}: ${phrase}`);
    }
  }
  assert.deepEqual(offenders, []);
});
