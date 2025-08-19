const esbuild = require("esbuild");

const production = process.argv.includes('--production');
const watch = process.argv.includes('--watch');

/**
 * @type {import('esbuild').Plugin}
 */
const esbuildProblemMatcherPlugin = {
	name: 'esbuild-problem-matcher',

	setup(build) {
		build.onStart(() => {
			console.log('[watch] build started');
		});
		build.onEnd((result) => {
			result.errors.forEach(({ text, location }) => {
				console.error(`✘ [ERROR] ${text}`);
				console.error(`    ${location.file}:${location.line}:${location.column}:`);
			});
			console.log('[watch] build finished');
		});
	},
};

async function main() {
	// Build extension
	const extensionCtx = await esbuild.context({
		entryPoints: [
			'src/extension.ts'
		],
		bundle: true,
		format: 'cjs',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'node',
		outfile: 'dist/extension.js',
		external: ['vscode'],
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	// Build React metrics component
	const metricsCtx = await esbuild.context({
		entryPoints: [
			'src/ui/react/metrics/index.tsx'
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/metrics-view.js',
		jsx: 'automatic',
		define: {
			'process.env.NODE_ENV': production ? '"production"' : '"development"'
		},
		loader: {
			'.tsx': 'tsx',
			'.ts': 'ts'
		},
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	// Build React overview component
	const overviewCtx = await esbuild.context({
		entryPoints: [
			'src/ui/react/overview/index.tsx'
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/overview-view.js',
		jsx: 'automatic',
		define: {
			'process.env.NODE_ENV': production ? '"production"' : '"development"'
		},
		loader: {
			'.tsx': 'tsx',
			'.ts': 'ts',
			'.css': 'css'
		},
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	// Build React timeline components
	const timelineCtx = await esbuild.context({
		entryPoints: [
			'src/ui/react/timeline/index.tsx'
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/timeline-view.js',
		jsx: 'automatic',
		define: {
			'process.env.NODE_ENV': production ? '"production"' : '"development"'
		},
		loader: {
			'.tsx': 'tsx',
			'.ts': 'ts'
		},
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	// Build React monitor component
	const monitorCtx = await esbuild.context({
		entryPoints: [
			'src/ui/react/monitor/index.tsx'
		],
		bundle: true,
		format: 'iife',
		minify: production,
		sourcemap: !production,
		sourcesContent: false,
		platform: 'browser',
		outfile: 'dist/monitor-view.js',
		jsx: 'automatic',
		define: {
			'process.env.NODE_ENV': production ? '"production"' : '"development"'
		},
		loader: {
			'.tsx': 'tsx',
			'.ts': 'ts'
		},
		logLevel: 'silent',
		plugins: [
			esbuildProblemMatcherPlugin,
		],
	});

	if (watch) {
		await Promise.all([
			extensionCtx.watch(),
			metricsCtx.watch(),
			overviewCtx.watch(),
			timelineCtx.watch(),
			monitorCtx.watch()
		]);
	} else {
		await Promise.all([
			extensionCtx.rebuild(),
			metricsCtx.rebuild(),
			overviewCtx.rebuild(),
			timelineCtx.rebuild(),
			monitorCtx.rebuild()
		]);
		await Promise.all([
			extensionCtx.dispose(),
			metricsCtx.dispose(),
			overviewCtx.dispose(),
			timelineCtx.dispose(),
			monitorCtx.dispose()
		]);
	}
}

main().catch(e => {
	console.error(e);
	process.exit(1);
});
