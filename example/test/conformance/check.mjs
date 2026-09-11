import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { parseSync, traverse } from '@babel/core';

export const root = fileURLToPath(new URL('../../../', import.meta.url));
export const contracts = JSON.parse(fs.readFileSync(new URL('./contracts.json', import.meta.url), 'utf8'));
export const groupOf = id => id.replace(/\.\d+$/, '');
export const idOf = title => title.match(/^\[([A-Z][A-Z-]*\.\d+)\] /)?.[1];

function walk(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const name = path.join(dir, entry.name);
    return entry.isDirectory() ? walk(name) : [name];
  });
}

function calleeRoot(node) {
  if (node?.type === 'Identifier') return node.name;
  if (node?.type === 'MemberExpression') return calleeRoot(node.object);
  if (node?.type === 'CallExpression') return calleeRoot(node.callee);
}

export function check() {
  const cases = [], failures = [], ids = new Set();
  const coverage = JSON.parse(fs.readFileSync(new URL('./coverage.json', import.meta.url), 'utf8'));
  const userDocs = fs.readdirSync(path.join(root, 'docs/user-scenario')).filter(file => file.endsWith('.md')).map(file => `docs/user-scenario/${file}`);
  if (JSON.stringify(userDocs.sort()) !== JSON.stringify(coverage.map(record => record.source).sort())) failures.push('사용자 문서 목록 변경: coverage.json 재검토 필요');
  const reviewIds = new Set();
  for (const record of coverage) {
    const source = fs.readFileSync(path.join(root, record.source), 'utf8');
    if (createHash('sha256').update(source).digest('hex') !== record.sha256) failures.push(`${record.source}: 문서 변경 — 계약 추출과 coverage 검토 후 hash 갱신`);
    const headings = source.split('\n').filter(line => line.startsWith('## ')).map(line => line.slice(3));
    if (JSON.stringify(headings) !== JSON.stringify(record.sections.map(section => section.heading))) failures.push(`${record.source}: 미분류 절 존재`);
    for (const section of record.sections) {
      for (const id of section.contracts) if (!contracts[id]) failures.push(`${record.source}/${section.heading}: 미등록 계약 ${id}`);
      if (!section.contracts.length && !section.review) failures.push(`${record.source}/${section.heading}: 검증/검토 연결 누락`);
      if (section.review) {
        const review = section.review;
        if (reviewIds.has(review.id) || !review.reason || review.result !== 'reviewed') failures.push(`${review.id}: 중복 또는 미완료 검토`);
        reviewIds.add(review.id);
      }
    }
  }
  for (const [id, contract] of Object.entries(contracts)) {
    const source = fs.readFileSync(path.join(root, contract.source), 'utf8');
    if (!source.includes(contract.quote) || !source.split('\n').some(line => /^#{1,6} /.test(line) && line.replace(/^#+ /, '').includes(contract.section))) {
      failures.push(`${id}: 계약 문장/절 변경 — ${contract.source}`);
    }
    if (!contract.purpose || !contract.forbids) failures.push(`${id}: 목적/금지 결과 누락`);
  }
  for (const dir of ['src/conformance', 'extra']) {
    for (const file of walk(path.join(root, 'example/test', dir)).filter(file => /\.(test|spec)\.[cm]?[jt]sx?$/.test(file))) {
      const source = fs.readFileSync(file, 'utf8');
      const ast = parseSync(source, { configFile: false, babelrc: false, parserOpts: { plugins: ['jsx'] } });
      traverse(ast, {
        CallExpression({ node }) {
          if (!['it', 'test'].includes(calleeRoot(node.callee))) return;
          const title = node.arguments[0];
          if (title?.type !== 'StringLiteral' || !node.arguments.some(arg => /FunctionExpression$/.test(arg.type))) return;
          const id = idOf(title.value), contract = contracts[groupOf(id || '')];
          if (!id || !contract) failures.push(`${path.relative(root, file)}:${node.loc.start.line}: 계약 ID 누락/미등록`);
          else {
            if (ids.has(id)) failures.push(`${id}: 중복 test ID`);
            ids.add(id);
            const tier = dir === 'extra' ? 'extra' : 'default';
            cases.push({ id, title: title.value, tier, file: path.relative(root, file), line: node.loc.start.line });
            if (contract.tier !== tier) failures.push(`${id}: ${tier} 파일과 ${contract.tier} 계약 분류 불일치`);
          }
          if (/\.(skip|todo|only)\b/.test(source.slice(node.callee.start, node.callee.end))) failures.push(`${id}: skip/todo/only는 적합성 통과가 아님`);
        },
      });
    }
  }
  for (const id of Object.keys(contracts)) {
    if (!cases.some(test => groupOf(test.id) === id)) failures.push(`${id}: 실행 가능한 검증 없음`);
  }
  if (failures.length) throw new Error(failures.join('\n'));
  return cases;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try { console.log(`계약 연결 ${check().length}개 확인`); }
  catch (error) { console.error(error.message); process.exitCode = 1; }
}
