import { build } from 'esbuild';

// Liste des modules natifs Node.js à externaliser
const nodeBuiltins = [
  'fs', 'path', 'crypto', 'util', 'os', 'stream', 'events', 'buffer', 
  'querystring', 'url', 'http', 'https', 'net', 'tls', 'dns', 'dgram',
  'child_process', 'cluster', 'worker_threads', 'perf_hooks', 'readline',
  'repl', 'string_decoder', 'timers', 'tty', 'v8', 'vm', 'zlib',
  'constants', 'domain', 'module', 'process', 'punycode', 'assert',
  'inspector', 'async_hooks'
];

async function buildServer() {
  try {
    await build({
      entryPoints: ['server/index.ts'],
      bundle: true,
      platform: 'node',
      format: 'esm',
      target: 'node18',
      outdir: 'dist',
      external: nodeBuiltins,
      packages: 'external',
      sourcemap: false,
      minify: false,
      // Preserve dynamic imports for ES modules
      splitting: false,
      // Keep names for easier debugging
      keepNames: true,
      // Handle __dirname and __filename for ES modules
      define: {
        '__dirname': '__dirname',
        '__filename': '__filename'
      }
    });
    
    console.log('✅ Server build completed successfully');
  } catch (error) {
    console.error('❌ Build failed:', error);
    process.exit(1);
  }
}

buildServer();
