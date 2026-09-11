import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import os from 'node:os';
import { check, root, contracts, groupOf, idOf } from './check.mjs';

const tier = process.argv[2] || 'default';
if (!['default', 'extra'].includes(tier)) throw new Error('default 또는 extra를 지정하세요.');
const output = path.join(root, '.conformance');
fs.mkdirSync(output, { recursive: true });
const logPath = path.join(output, `${tier}.log`);
fs.writeFileSync(logPath, '');
const started = Date.now();
const results = [];
let cases;
let failure;
const reportPath = path.join(output, `${tier}-vitest.json`);
const compilerReports = tier === 'default' ? ['swc', 'babel'].map(compiler => ({
  compiler, path: path.join(output, `${tier}-${compiler}-vitest.json`),
})) : [{ compiler: 'swc', path: reportPath }];
const browserReportPath = path.join(output, 'extra-browser.json');
fs.rmSync(reportPath, { force: true });
for (const report of compilerReports) fs.rmSync(report.path, { force: true });
fs.rmSync(path.join(output, `${tier}-summary.json`), { force: true });
if (tier === 'extra') fs.rmSync(browserReportPath, { force: true });

async function step(label, args, cwd = root, env = {}) {
  const begin = Date.now();
  const log = fs.openSync(logPath, 'a');
  fs.writeSync(log, `\n${label}\n`);
  console.log(`${label} 실행 중`);
  try {
    const code = await new Promise((resolve, reject) => {
      const child = spawn(process.execPath, args, {
        cwd, stdio: ['ignore', log, log],
        env: { ...process.env, FORCE_COLOR: '0', AEUI_CONFORMANCE: tier, ...env },
      });
      child.on('error', reject);
      child.on('exit', (code, signal) => resolve(signal ? 1 : code));
    });
    results.push({ label, code, seconds: (Date.now() - begin) / 1000 });
    if (code !== 0) throw new Error(`${label} 실패`);
  } finally { fs.closeSync(log); }
}

try {
  cases = check();
  await step('코어 빌드', [path.join(root, 'node_modules/rollup/dist/bin/rollup'), '-c'], path.join(root, 'packages/core'));
  for (const report of compilerReports) {
    await step(tier === 'default' ? `기본 적합성 (${report.compiler})` : 'extra 패키지 소비', [
      'node_modules/vitest/vitest.mjs', 'run', '--root', 'example/test', '--config', `vite.${tier === 'extra' ? 'extra.' : ''}config.js`,
      '--reporter=json', `--outputFile=${report.path}`,
    ], root, { AEUI_TEST_COMPILER: report.compiler });
  }
  if (tier === 'extra') {
    await step('extra 브라우저', ['node_modules/@playwright/test/cli.js', 'test', '-c', 'example/test/playwright.config.js']);
  }
} catch (error) {
  failure = error.message;
  console.error(error.message);
  if (fs.existsSync(logPath)) console.error(fs.readFileSync(logPath, 'utf8').split('\n').slice(-25).join('\n').slice(-3500));
  process.exitCode = 1;
} finally {
  const assertions = compilerReports.flatMap(report => fs.existsSync(report.path)
    ? JSON.parse(fs.readFileSync(report.path, 'utf8')).testResults.flatMap(file => file.assertionResults) : []);
  const browserReport = tier === 'extra' && fs.existsSync(browserReportPath) ? JSON.parse(fs.readFileSync(browserReportPath, 'utf8')) : null;
  function browserTests(suite) {
    return [
      ...(suite.specs || []).flatMap(spec => spec.tests.map(test => ({ title: spec.title,
        failureMessages: test.results.flatMap(result => (result.errors || []).map(error => error.message)),
        status: test.results.length && test.results.every(result => result.status === 'passed') ? 'passed'
          : test.results.some(result => ['failed', 'timedOut', 'interrupted'].includes(result.status)) ? 'failed' : 'skipped',
      }))),
      ...(suite.suites || []).flatMap(browserTests),
    ];
  }
  if (browserReport) assertions.push(...browserTests(browserReport));
  const executedIds = new Set(assertions.map(test => idOf(test.title)));
  const missing = (cases || []).filter(test => test.tier === tier && !executedIds.has(test.id));
  const summary = {
    tier, startedAt: new Date(started).toISOString(), seconds: (Date.now() - started) / 1000, steps: results,
    failure: failure || null,
    environment: { node: process.version, platform: process.platform, arch: process.arch,
      vite: JSON.parse(fs.readFileSync(path.join(root, 'node_modules/vite/package.json'), 'utf8')).version },
    passed: assertions.filter(test => test.status === 'passed').length,
    failed: assertions.filter(test => test.status === 'failed').length,
    skipped: assertions.filter(test => test.status === 'pending' || test.status === 'skipped').length,
    missing: missing.map(test => test.id),
    success: !process.exitCode && !missing.length && assertions.length > 0 && assertions.every(test => test.status === 'passed'),
    // 다른 실행의 결과를 합쳐 전체 적합성으로 표시하지 않는다.
    contracts: Object.fromEntries(Object.entries(contracts).map(([id, contract]) => {
      const tests = assertions.filter(test => groupOf(idOf(test.title) || '') === id);
      return [id, { kind: contract.kind, tier: contract.tier,
        status: tests.some(test => test.status === 'failed') ? 'failed'
          : missing.some(test => groupOf(test.id) === id) ? 'not-run'
          : tests.length && tests.every(test => test.status === 'passed') ? 'passed' : 'not-run' }];
    })),
  };
  if (!summary.success) process.exitCode = 1;
  if (!summary.success) {
    for (const test of assertions.filter(test => test.status === 'failed').slice(0, 5)) {
      console.error(`${test.title}\n${(test.failureMessages || []).join('\n').slice(0, 1200)}`);
    }
    if (missing.length) console.error(`미실행 ID: ${missing.map(test => test.id).join(', ')}`);
  }
  fs.writeFileSync(path.join(output, `${tier}-summary.json`), JSON.stringify(summary, null, 2) + '\n');
  console.log(`${tier} ${summary.success ? '성공' : '실패'}: ${summary.passed} 통과, ${summary.failed} 실패, ${summary.skipped + missing.length} 미실행 (${summary.seconds.toFixed(1)}초)`);
  if (tier === 'default') console.log('패키지 설치·브라우저·전체 예제: extra에서 별도 실행');
  console.log(`상세 결과: .conformance/${tier}-summary.json · .conformance/${tier}.log`);
  if (tier === 'extra') {
    const contextFile = path.join(output, 'extra-context.json');
    if (fs.existsSync(contextFile)) {
      const { temp } = JSON.parse(fs.readFileSync(contextFile, 'utf8'));
      if (path.dirname(temp) === os.tmpdir() && path.basename(temp).startsWith('aeui-consumer-')) fs.rmSync(temp, { recursive: true, force: true });
      fs.rmSync(contextFile);
    }
  }
}
