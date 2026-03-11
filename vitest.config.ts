import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
	test: {
		globals: true,
		environment: 'jsdom',
		alias: {
			'obsidian': path.resolve(__dirname, './__mocks__/obsidian.ts')
		},
		coverage: {
			provider: 'v8',
			reporter: ['text', 'json', 'html'],
			exclude: [
				'node_modules/',
				'dist/',
				'__mocks__/',
				'esbuild.config.mjs',
				'*.test.ts'
			]
		}
	},
});
