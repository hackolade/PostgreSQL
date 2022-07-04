const esbuild = require('esbuild');
const path = require('path');
const { nativeNodeModulesPlugin } = require('esbuild-native-node-modules-plugin');
const { copy } = require('esbuild-plugin-copy');

esbuild.build({
	entryPoints: [
		path.resolve(__dirname, 'forward_engineering/api.js'),
		path.resolve(__dirname, 'reverse_engineering/api.js'),
	],
	bundle: true,
	platform: 'node',
	outdir: 'build',
	minify: true,
	sourcemap: false,
	logLevel: 'info',
	plugins: [
		nativeNodeModulesPlugin,
		copy({
			assets: [
				'validation/*',
				'types/*',
				'reverse_engineering/connection_settings_modal/*',
				'reverse_engineering/config.json',
				'properties_pane/*',
				'polyglot/*',
				'localization/*',
				'lib/*',
				'forward_engineering/config.json',
				'central_pane/*',
				'adapter/*',
				'jsonSchemaProperties.json',
				'LICENSE',
				'logo.png',
				'README.md',
			].map(path => ({
				from: [path],
				to: [path],
			})),
		}),
	],
	external: ['pg-native'],
});
