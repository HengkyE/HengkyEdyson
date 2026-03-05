// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Add support for web
config.resolver.sourceExts.push('web.js', 'web.ts', 'web.tsx');

module.exports = config;
