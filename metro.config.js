const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');

const config = getDefaultConfig(__dirname);

// inlineRem 16 (o padrão do NativeWind é 14): com 14, min-h-12 vira 42 dp em vez dos
// 48 dp mínimos de alvo de toque; com 16 as classes valem o mesmo que na web.
module.exports = withNativeWind(config, { input: './global.css', inlineRem: 16 });
