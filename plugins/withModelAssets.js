const { withDangerousMod, withXcodeProject } = require('@expo/config-plugins');
const fs = require('fs');
const path = require('path');

const SOURCE_RELATIVE = ['assets', 'models'];

function getModelFiles(projectRoot) {
  const sourceDir = path.join(projectRoot, ...SOURCE_RELATIVE);
  if (!fs.existsSync(sourceDir)) {
    console.warn('[model-assets] assets/models 폴더가 없어 건너뜁니다.');
    return { sourceDir, files: [] };
  }

  const files = fs.readdirSync(sourceDir).filter((file) => file.endsWith('.gguf'));
  if (files.length === 0) {
    console.warn('[model-assets] 동기화할 GGUF 모델이 없어 건너뜁니다.');
  }

  return { sourceDir, files };
}

function copyFile(source, destination) {
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.copyFileSync(source, destination);
}

function syncAndroidModels(projectRoot, sourceDir, files) {
  const androidTarget = path.join(projectRoot, 'android', 'app', 'src', 'main', 'assets', 'models');
  for (const file of files) {
    const sourceLabel = `./${path.posix.join(...SOURCE_RELATIVE, file)}`;
    const destination = path.join(androidTarget, file);
    const destLabel = path.relative(projectRoot, destination);
    console.log(`[model-assets] Copying   ${sourceLabel} ➜ ${destLabel}`);
    copyFile(path.join(sourceDir, file), destination);
  }
}

function getIosProjectName(projectRoot) {
  const iosDir = path.join(projectRoot, 'ios');
  if (!fs.existsSync(iosDir)) return null;
  const project = fs.readdirSync(iosDir).find((name) => name.endsWith('.xcodeproj'));
  if (!project) return null;
  return project.replace('.xcodeproj', '');
}

function syncIosModels(projectRoot, sourceDir, files) {
  const projectName = getIosProjectName(projectRoot);
  const supportTarget =
    projectName !== null ? path.join(projectRoot, 'ios', projectName, 'Supporting', 'models') : null;
  const sharedTarget = path.join(projectRoot, 'ios', 'models');

  for (const file of files) {
    const sourceLabel = `./${path.posix.join(...SOURCE_RELATIVE, file)}`;
    const sourcePath = path.join(sourceDir, file);

    if (supportTarget) {
      const destination = path.join(supportTarget, file);
      const destLabel = path.relative(projectRoot, destination);
      console.log(`[model-assets] Copying   ${sourceLabel} ➜ ${destLabel}`);
      copyFile(sourcePath, destination);
    } else {
      console.warn('[model-assets] iOS Supporting 폴더를 찾지 못해 건너뜁니다.');
    }

    const sharedDestination = path.join(sharedTarget, file);
    const sharedLabel = path.relative(projectRoot, sharedDestination);
    console.log(`[model-assets] Copying   ${sourceLabel} ➜ ${sharedLabel}`);
    copyFile(sourcePath, sharedDestination);
  }
}

const withModelAssets = (config) => {
  const projectHasFile = (project, relativePath) => {
    const section = project.pbxFileReferenceSection();
    return Object.values(section).some(
      (ref) => typeof ref === 'object' && ref?.path === relativePath
    );
  };

  config = withDangerousMod(config, ['android', async (cfg) => {
    const { sourceDir, files } = getModelFiles(cfg.modRequest.projectRoot);
    if (files.length > 0) {
      syncAndroidModels(cfg.modRequest.projectRoot, sourceDir, files);
    }
    return cfg;
  }]);

  config = withDangerousMod(config, ['ios', async (cfg) => {
    const { sourceDir, files } = getModelFiles(cfg.modRequest.projectRoot);
    if (files.length > 0) {
      syncIosModels(cfg.modRequest.projectRoot, sourceDir, files);
    }
    return cfg;
  }]);

  config = withXcodeProject(config, (cfg) => {
    const { files } = getModelFiles(cfg.modRequest.projectRoot);
    if (files.length === 0) {
      return cfg;
    }

    const project = cfg.modResults;
    const supportingGroup = project.pbxGroupByName('Supporting') || project.pbxGroupByName('Resources');
    if (!supportingGroup) {
      console.warn('[model-assets] Xcode Supporting 그룹을 찾지 못했습니다.');
      return cfg;
    }

    let modelsGroup = project.pbxGroupByName('models');
    if (!modelsGroup) {
      modelsGroup = project.addPbxGroup([], 'models', 'models');
      project.addToPbxGroup(modelsGroup.uuid, supportingGroup.uuid);
    }

    for (const file of files) {
      const relativePath = `models/${file}`;
      const alreadyExists = projectHasFile(project, relativePath);
      if (alreadyExists) continue;
      const fileEntry = project.addFile(relativePath, modelsGroup.uuid);
      if (fileEntry) {
        project.addToPbxBuildFileSection(fileEntry);
        project.addToPbxResourcesBuildPhase(fileEntry);
        console.log(`[model-assets] Added ${relativePath} to Xcode resources`);
      }
    }

    return cfg;
  });

  return config;
};

module.exports = withModelAssets;
