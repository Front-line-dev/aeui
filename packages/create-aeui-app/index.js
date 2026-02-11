#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectName = process.argv[2];

if (!projectName) {
  console.error('Please specify the project name:');
  console.error('  npx create-aeui-app <project-name>');
  process.exit(1);
}

const templateDir = path.join(__dirname, 'template');
const targetDir = path.join(process.cwd(), projectName);

if (fs.existsSync(targetDir)) {
  console.error(`Directory ${projectName} already exists.`);
  process.exit(1);
}

console.log(`Creating a new AEUI app in ${targetDir}...`);
fs.mkdirSync(targetDir, { recursive: true });

function copyDir(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  fs.mkdirSync(dest, { recursive: true });

  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);

    if (entry.isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

copyDir(templateDir, targetDir);

// Update package.json name
const pkgFile = path.join(targetDir, 'package.json');
const pkg = JSON.parse(fs.readFileSync(pkgFile, 'utf-8'));
pkg.name = projectName;
fs.writeFileSync(pkgFile, JSON.stringify(pkg, null, 2));

console.log(`\nDone! Now run:\n`);
console.log(`  cd ${projectName}`);
console.log(`  npm install`);
console.log(`  npm run dev`);
