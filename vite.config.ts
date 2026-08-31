import { defineConfig, build, InlineConfig, Plugin } from 'vite';
import { crx } from '@crxjs/vite-plugin';
import manifest from './manifest.json';

// The content script is NOT declared in the manifest — the background injects it
// with chrome.scripting.executeScript on a user gesture, which is what lets the
// extension work on any origin under `activeTab` alone (see decision 0006).
//
// That injection requires ONE self-contained file: crxjs would otherwise wrap a
// declared content script in a loader that dynamic-imports its payload, and that
// payload chunk would need a `web_accessible_resources` entry whose `matches`
// reintroduces the broad host pattern we are avoiding. Building it separately in
// lib/IIFE mode emits a flat bundle with no imports and no web-accessible chunk.
const contentScriptBuild: InlineConfig = {
  configFile: false,
  build: {
    // crxjs clears dist/ on the main build; this one runs after it, so keep it.
    emptyOutDir: false,
    minify: false,
    lib: {
      entry: 'src/content/index.ts',
      formats: ['iife'],
      name: 'FormFillerContent',
      // Must stay in sync with CONTENT_SCRIPT_FILE in src/background/index.ts.
      fileName: () => 'content.js',
    },
  },
};

// Chained off the main build so `pnpm build` and `pnpm dev` stay single commands —
// in watch mode closeBundle fires on every rebuild, so content.js tracks edits too.
function buildContentScript(): Plugin {
  let running = false;
  return {
    name: 'form-filler:build-content-script',
    apply: 'build',
    async closeBundle() {
      if (running) return; // the nested build must not re-enter this hook
      running = true;
      try {
        await build(contentScriptBuild);
      } finally {
        running = false;
      }
    },
  };
}

export default defineConfig({
  plugins: [crx({ manifest }), buildContentScript()],
  build: {
    minify: false,
  },
});
