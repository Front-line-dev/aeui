// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { it, expect } from 'vitest';
import { root } from '../../conformance/check.mjs';

function files(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => entry.isDirectory()
    ? files(path.join(dir, entry.name)) : entry.name.endsWith('.md') ? [path.join(dir, entry.name)] : []);
}
function prose(text) { return text.replace(/^(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\1\s*$/gm, ''); }
function anchors(text) {
  const seen = new Map();
  return [...prose(text).matchAll(/^#{1,6} (.+)$/gm)].map(([, title]) => {
    const slug = title.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^\p{L}\p{N}\p{M}\s_-]/gu, '').replace(/ /g, '-');
    const count = seen.get(slug) || 0;
    seen.set(slug, count + 1);
    return count ? `${slug}-${count}` : slug;
  });
}

it('[INTERNAL-REPOSITORY.10] 문서의 로컬 링크와 heading은 실제 대상으로 연결되고 깨진 안내를 배포하지 않는다', () => {
  const failures = [];
  for (const file of [...files(path.join(root, 'docs')), path.join(root, 'README.md'), path.join(root, 'CONTRIBUTING.md')]) {
    for (const [, target] of prose(fs.readFileSync(file, 'utf8')).matchAll(/\]\(([^\s)]+)(?:\s+"[^"]*")?\)/g)) {
      if (/^[a-z][a-z\d+.-]*:/i.test(target)) continue;
      const [relative, fragment] = target.split('#');
      const resolved = relative ? path.resolve(path.dirname(file), decodeURIComponent(relative)) : file;
      if (!fs.existsSync(resolved)) failures.push(`${path.relative(root, file)} → ${target}`);
      else if (fragment && resolved.endsWith('.md') && !anchors(fs.readFileSync(resolved, 'utf8')).includes(decodeURIComponent(fragment))) failures.push(`${path.relative(root, file)} → ${target} (heading 없음)`);
    }
  }
  expect(failures).toEqual([]);
});
