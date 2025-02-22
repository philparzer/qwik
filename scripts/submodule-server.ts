import { build, BuildOptions, Plugin } from 'esbuild';
import { join } from 'path';
import {
  BuildConfig,
  getBanner,
  importPath,
  injectGlobalThisPoly,
  injectGlobalPoly,
  nodeTarget,
  target,
  watcher,
} from './util';
import { inlineQwikScriptsEsBuild } from './submodule-qwikloader';
import { readPackageJson } from './package-json';
import { readFileSync } from 'fs';

/**
 * Builds @builder.io/server
 *
 * This is submodule for helping to generate server-side rendered pages,
 * along with providing utilities for prerendering and unit testing.
 */
export async function submoduleServer(config: BuildConfig) {
  const submodule = 'server';

  const qwikDomPlugin = await bundleQwikDom(config);
  const qwikDomVersion = await getQwikDomVersion();

  const opts: BuildOptions = {
    entryPoints: [join(config.srcDir, submodule, 'index.ts')],
    entryNames: 'server',
    outdir: config.distPkgDir,
    sourcemap: config.dev,
    bundle: true,
    target,
    external: [/* no nodejs built-in externals allowed! */ '@builder.io/qwik-dom'],
  };

  const esm = build({
    ...opts,
    format: 'esm',
    banner: { js: getBanner('@builder.io/qwik/server') },
    outExtension: { '.js': '.mjs' },
    plugins: [importPath(/^@builder\.io\/qwik$/, './core.mjs'), qwikDomPlugin],
    watch: watcher(config, submodule),
    inject: [injectGlobalPoly(config)],
    define: {
      ...(await inlineQwikScriptsEsBuild(config)),
      'globalThis.IS_CJS': 'false',
      'globalThis.IS_ESM': 'true',
      'globalThis.QWIK_VERSION': JSON.stringify(config.distVersion),
      'globalThis.QWIK_DOM_VERSION': JSON.stringify(qwikDomVersion),
    },
  });

  const cjsBanner = [
    getBanner('@builder.io/qwik/server'),
    readFileSync(injectGlobalThisPoly(config), 'utf-8'),
    readFileSync(injectGlobalPoly(config), 'utf-8'),
    `globalThis.qwikServer = (function (module) {`,
    browserCjsRequireShim,
  ].join('\n');

  const cjs = build({
    ...opts,
    format: 'cjs',
    banner: {
      js: cjsBanner,
    },
    footer: {
      js: `return module.exports; })(typeof module === 'object' && module.exports ? module : { exports: {} });`,
    },
    outExtension: { '.js': '.cjs' },
    plugins: [importPath(/^@builder\.io\/qwik$/, './core.cjs'), qwikDomPlugin],
    watch: watcher(config),
    platform: 'node',
    target: nodeTarget,
    define: {
      ...(await inlineQwikScriptsEsBuild(config)),
      'globalThis.IS_CJS': 'true',
      'globalThis.IS_ESM': 'false',
      'globalThis.QWIK_VERSION': JSON.stringify(config.distVersion),
      'globalThis.QWIK_DOM_VERSION': JSON.stringify(qwikDomVersion),
    },
  });

  await Promise.all([esm, cjs]);

  console.log('🐰', submodule);
}

async function bundleQwikDom(config: BuildConfig) {
  const outfile = join(config.distDir, 'qwikdom.mjs');

  const opts: BuildOptions = {
    entryPoints: [require.resolve('@builder.io/qwik-dom')],
    sourcemap: false,
    minify: true,
    bundle: true,
    target,
    outfile,
    format: 'esm',
  };

  await build(opts);

  const qwikDomPlugin: Plugin = {
    name: 'qwikDomPlugin',
    setup(build) {
      build.onResolve({ filter: /@builder.io\/qwik-dom/ }, () => {
        return {
          path: outfile,
        };
      });
    },
  };

  return qwikDomPlugin;
}

async function getQwikDomVersion() {
  const indexPath = require.resolve('@builder.io/qwik-dom');
  const pkgJsonPath = join(indexPath, '..', '..');
  const pkgJson = await readPackageJson(pkgJsonPath);
  return pkgJson.version;
}

const browserCjsRequireShim = `
if (typeof require !== 'function' && typeof location !== 'undefined' && typeof navigator !== 'undefined') {
  // shim cjs require() for core.cjs within a browser
  globalThis.require = function(path) {
    if (path === './core.cjs') { 
      if (!self.qwikCore) {
        throw new Error('Qwik Core global, "globalThis.qwikCore", must already be loaded for the Qwik Server to be used within a browser.');
      }
      return self.qwikCore;
    }
    throw new Error('Unable to require() path "' + path + '" from a browser environment.');
  };
}`;
