// Learn more https://docs.expo.dev/guides/customizing-metro
const path = require('path');
const fs = require('fs');
const { getDefaultConfig } = require('expo/metro-config');
const metroResolve = require('metro-resolver').resolve;

const projectRoot = __dirname;
const threeSekawanRoot = path.join(projectRoot, '3Sekawan');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(projectRoot);

// Ensure all node_modules resolution uses project root (3Sekawan has no node_modules)
config.resolver.nodeModulesPaths = [path.join(projectRoot, 'node_modules')];

// Add support for web
config.resolver.sourceExts.push('web.js', 'web.ts', 'web.tsx');

// Node.js built-in modules that don't exist in the browser — resolve to empty module on web
const NODE_BUILTINS = new Set([
  'async_hooks', 'util', 'path', 'fs', 'os', 'stream', 'buffer', 'events', 'url', 'querystring',
  'crypto', 'http', 'https', 'net', 'tls', 'zlib', 'child_process', 'cluster',
  'dgram', 'dns', 'module', 'readline', 'repl', 'vm', 'assert', 'constants',
  'tty', 'perf_hooks', 'timers', 'string_decoder', 'sys',
]);

// When a file imports from '@/', resolve relative to the right root:
// - from 3Sekawan/ → resolve under 3Sekawan/
// - from main app  → resolve under project root
function resolveAtAlias(rootDir, moduleName) {
  const candidate = path.join(rootDir, moduleName.slice(2));
  // Path already has an extension (e.g. .png, .svg) — use as-is if it exists
  if (path.extname(candidate) && fs.existsSync(candidate)) {
    return { type: 'sourceFile', filePath: candidate };
  }
  const exts = ['.tsx', '.ts', '.jsx', '.js'];
  for (const ext of exts) {
    const p = candidate + ext;
    if (fs.existsSync(p)) return { type: 'sourceFile', filePath: p };
  }
  if (fs.existsSync(candidate + '/index.tsx')) return { type: 'sourceFile', filePath: candidate + '/index.tsx' };
  if (fs.existsSync(candidate + '/index.ts')) return { type: 'sourceFile', filePath: candidate + '/index.ts' };
  return null;
}

config.resolver.resolveRequest = (context, moduleName, platform) => {
  try {
    // On web, Node.js built-ins must resolve to empty module or a shim
    if (platform === 'web') {
      const bare = moduleName.replace(/^node:/, '');
      // util needs TextEncoder/TextDecoder — use a shim that re-exports globals
      if (bare === 'util') {
        const utilShim = path.join(projectRoot, 'metro-polyfills/util-web.js');
        if (fs.existsSync(utilShim)) {
          return { type: 'sourceFile', filePath: utilShim };
        }
      }
      // async_hooks needs AsyncLocalStorage — use a minimal shim so it's a constructor
      if (bare === 'async_hooks') {
        const asyncHooksShim = path.join(projectRoot, 'metro-polyfills/async_hooks-web.js');
        if (fs.existsSync(asyncHooksShim)) {
          return { type: 'sourceFile', filePath: asyncHooksShim };
        }
      }
      // tty needs isatty — use a shim (returns false in browser)
      if (bare === 'tty') {
        const ttyShim = path.join(projectRoot, 'metro-polyfills/tty-web.js');
        if (fs.existsSync(ttyShim)) {
          return { type: 'sourceFile', filePath: ttyShim };
        }
      }
      if (NODE_BUILTINS.has(bare) && config.resolver.emptyModulePath) {
        return { type: 'sourceFile', filePath: config.resolver.emptyModulePath };
      }
    }
    if (moduleName.startsWith('@/') && context.originModulePath) {
      const origin = path.normalize(context.originModulePath);
      const from3Sekawan = origin.includes(threeSekawanRoot);
      // 3Sekawan uses root's components and edysonpos; everything else from 3Sekawan
      const useRootFor3Sekawan = moduleName.startsWith('@/components') || moduleName.startsWith('@/edysonpos');
      const root = from3Sekawan ? (useRootFor3Sekawan ? projectRoot : threeSekawanRoot) : projectRoot;
      const result = resolveAtAlias(root, moduleName);
      if (result) return result;
    }
  } catch (_) {
    // fall through to default
  }
  // Fall back to Metro's default resolver. Use metroResolve with context.resolveRequest
  // set to metroResolve so we don't re-enter the custom resolver chain.
  // Do not return null here — Metro expects a resolution object with .type; null causes "Cannot read properties of null (reading 'type')".
  const fallbackContext = { ...context, resolveRequest: metroResolve };
  return metroResolve(fallbackContext, moduleName, platform);
};

module.exports = config;
