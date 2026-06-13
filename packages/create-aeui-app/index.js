#!/usr/bin/env node
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const projectName = args[0];

function printUsage() {
  console.error('Please specify the project name:');
  console.error('  npx create-aeui-app <project-name>');
}

function isValidPackageName(name) {
  if (typeof name !== 'string') return false;
  if (!name || name.length > 214) return false;
  if (name === 'node_modules' || name === 'favicon.ico') return false;
  if (name.startsWith('.') || name.startsWith('_')) return false;
  if (name.includes('/') || name.includes('\\')) return false;
  return /^[a-z0-9][a-z0-9._-]*$/.test(name);
}

if (args.includes('--help') || args.includes('-h')) {
  printUsage();
  process.exit(0);
}

if (!projectName) {
  printUsage();
  process.exit(1);
}

if (args.length > 1) {
  console.error('Only one project name can be provided.');
  printUsage();
  process.exit(1);
}

const templateDir = path.join(__dirname, 'template');
const targetDir = path.join(process.cwd(), projectName);

if (!isValidPackageName(projectName)) {
  console.error(`Invalid project name: ${projectName}`);
  console.error('Use a lowercase npm package name without spaces or path separators.');
  process.exit(1);
}

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
    const destName = entry.name === 'gitignore' ? '.gitignore' : entry.name;
    const destPath = path.join(dest, destName);

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
