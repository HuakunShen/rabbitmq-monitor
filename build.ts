import { $ } from 'bun';

await $`vite build`;
await Bun.build({
	entrypoints: ['src/server/hono.ts'],
	target: 'node',
	outdir: 'dist',
	format: 'esm'
});
