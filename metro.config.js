const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);
// Allow bundling of TFLite model assets
config.resolver.assetExts.push('tflite');

module.exports = config;
