// Learn more https://docs.expo.dev/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Exclude test files from bundling
config.resolver = {
  ...config.resolver,
  blockList: [
    // Exclude test files
    /\.test\.(ts|tsx|js|jsx)$/,
    /__tests__\/.*/,
    /coverage\/.*/,
  ],
};

module.exports = config;

