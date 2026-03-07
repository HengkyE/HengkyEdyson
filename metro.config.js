// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for web
config.resolver.sourceExts.push('web.js', 'web.ts', 'web.tsx');

// When a file under 3Sekawan/ imports from '@/', resolve to 3Sekawan/ (so 3Sekawan runs when mounted in main app)
const projectRoot = __dirname;
const threeSekawanRoot = path.join(projectRoot, '3Sekawan');
const defaultResolve = config.resolver.resolveRequest;
config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    if (moduleName.startsWith('@/') && context.originModulePath && path.normalize(context.originModulePath).includes(threeSekawanRoot)) {
      const candidate = path.join(threeSekawanRoot, moduleName.slice(2));
      const exts = ['.tsx', '.ts', '.jsx', '.js'];
      for (const ext of exts) {
        const p = candidate + ext;
        if (fs.existsSync(p)) return { type: 'sourceFile', filePath: p };
      }
      if (fs.existsSync(candidate + '/index.tsx')) return { type: 'sourceFile', filePath: candidate + '/index.tsx' };
      if (fs.existsSync(candidate + '/index.ts')) return { type: 'sourceFile', filePath: candidate + '/index.ts' };
    }
  } catch (_) {
    // fall through to default
  }
  // Fall back to default resolver (required for expo-router _error.bundle and other internals)
  if (typeof defaultResolve === 'function') {
    return defaultResolve(context, moduleName, platform);
  }
  return null;
};

module.exports = config;
