// @vitest-environment node
import fs from 'node:fs';
import path from 'node:path';
import { parseSync, traverse } from '@babel/core';
import { it, expect } from 'vitest';
import { root } from '../../conformance/check.mjs';

const sourceDir = path.join(root, 'packages/core/src');
const spec = fs.readFileSync(path.join(root, 'docs/internal-implement/17-source-layout.md'), 'utf8');

it('[INTERNAL-STRUCTURE.10] 명세의 모듈 export 경계를 유지하고 private 심볼을 외부로 내보내지 않는다', async () => {
  const rows = [...spec.matchAll(/^\| `([\w-]+\.js)` \| ([^|]+)\|([^\n]*)/gm)];
  for (const [, file, exports, privateCell] of rows) {
    if (file === 'index.js') continue; // re-export 조립은 package 소비에서 별도 확인한다.
    const expected = exports.includes('default function') ? ['default'] : [...exports.matchAll(/`(\w+)`/g)].map(match => match[1]);
    const actual = await import(path.join(sourceDir, file));
    expect(Object.keys(actual).sort(), `${file}: export`).toEqual(expected.sort());
    const ast = parseSync(fs.readFileSync(path.join(sourceDir, file), 'utf8'), { configFile: false, babelrc: false });
    let bindings;
    traverse(ast, { Program(p) { bindings = p.scope.bindings; } });
    for (const [, name] of privateCell.matchAll(/`(\w+)`/g)) {
      expect(bindings, `${file}: private ${name}`).toHaveProperty(name);
      expect(Object.hasOwn(actual, name)).toBe(false);
    }
  }
});

it('[INTERNAL-STRUCTURE.11] 하위 모듈은 조립 모듈을 역참조하지 않고 private 상태를 자기 파일에 둔다', () => {
  const privateOwners = new Map([['componentSetups', 'component-type.js'], ['runtimeContextStack', 'runtime-context.js']]);
  const found = new Set();
  for (const file of fs.readdirSync(sourceDir).filter(file => file.endsWith('.js'))) {
    const ast = parseSync(fs.readFileSync(path.join(sourceDir, file), 'utf8'), { configFile: false, babelrc: false });
    traverse(ast, {
      'ImportDeclaration|ExportNamedDeclaration|ExportAllDeclaration'(p) {
        const target = p.node.source?.value;
        if (!target?.startsWith('.') || ['index.js', 'core.js'].includes(file)) return;
        expect(['app-runtime.js', 'core.js', 'index.js'], `${file} -> ${target}`).not.toContain(path.basename(target));
      },
      VariableDeclarator(p) {
        for (const [name, owner] of privateOwners) {
          if (p.node.id.name === name) { expect(file).toBe(owner); found.add(name); }
        }
      },
    });
  }
  expect([...found].sort()).toEqual([...privateOwners.keys()].sort());
});
