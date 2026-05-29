const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

// Let metro resolve packages from both app and workspace root
config.watchFolders = [workspaceRoot];
config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// Disable experimentalImportSupport to prevent importExportLiveBindingsPlugin
// from crashing on React Native 0.85's Flow `component(...)` type syntax.
// The plugin's ReferencedIdentifier visitor incorrectly replaces identifiers
// inside unstripped Flow type annotations, producing an invalid AST node.
// Falling back to @babel/plugin-transform-modules-commonjs (via babel-preset-expo)
// handles module transforms correctly without this crash.
config.transformer.getTransformOptions = async () => ({
  transform: {
    experimentalImportSupport: false,
    inlineRequires: false,
  },
});

module.exports = config;
