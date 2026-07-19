const path = require('path');
const { getDefaultConfig } = require('expo/metro-config');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '..');
const config = getDefaultConfig(projectRoot);

// Các gói npm được hoist lên thư mục gốc của monorepo. Khai báo rõ hai vị trí
// giúp cả bundle ban đầu lẫn kết nối tải lại của máy ảo tìm đúng expo-router.
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

module.exports = config;
