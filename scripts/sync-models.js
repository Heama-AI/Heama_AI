#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

const projectRoot = path.resolve(__dirname, '..');
const sourceDir = path.join(projectRoot, 'assets', 'models');

if (!fs.existsSync(sourceDir)) {
  console.error('⚠️  assets/models 폴더가 없습니다.');
  process.exit(1);
}

const modelFiles = fs
  .readdirSync(sourceDir)
  .filter((file) => file.endsWith('.gguf'));

if (modelFiles.length === 0) {
  console.warn('ℹ️  동기화할 GGUF 모델이 없습니다.');
  process.exit(0);
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

const androidTarget = path.join(
  projectRoot,
  'android',
  'app',
  'src',
  'main',
  'assets',
  'models'
);

let iosProjectName = null;
const iosDir = path.join(projectRoot, 'ios');
if (fs.existsSync(iosDir)) {
  const xcodeproj = fs
    .readdirSync(iosDir)
    .find((name) => name.endsWith('.xcodeproj'));
  if (xcodeproj) {
    iosProjectName = xcodeproj.replace('.xcodeproj', '');
  }
}

if (!iosProjectName) {
  console.error('⚠️  iOS 프로젝트(.xcodeproj)를 찾을 수 없습니다.');
  process.exit(1);
}

const iosTarget = path.join(
  iosDir,
  iosProjectName,
  'Supporting',
  'models'
);

for (const file of modelFiles) {
  const sourcePath = path.join(sourceDir, file);
  const sourceLabel = `./assets/models/${file}`;

  const androidDestination = path.join(androidTarget, file);
  const androidLabel = path.relative(projectRoot, androidDestination);
  console.log(`Copying   ${sourceLabel} ➜ ${androidLabel}`);
  copyFile(sourcePath, androidDestination);

  const iosDestination = path.join(iosTarget, file);
  const iosLabel = path.relative(projectRoot, iosDestination);
  console.log(`Copying   ${sourceLabel} ➜ ${iosLabel}`);
  copyFile(sourcePath, iosDestination);

  console.log(`✅ ${file} 동기화 완료\n`);
}

console.log('\n완료! 네이티브 프로젝트에 모델이 복사되었습니다.');
