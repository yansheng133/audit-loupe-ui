// Flat config (ESLint 10, shipped with @rancher/shell). The ruleset lives in the shell; this
// file only adds what to skip.
import shellConfig from '@rancher/shell/eslint.config.base.mjs';

export default [
  {
    ignores: [
      'node_modules/', 'dist/', 'dist-pkg/', '.shell/', 'pkg/*/.shell/', 'coverage/', '.nyc_output/', '.cache/', '.next/',
      'docs/', '**/dynamic-importer.js', 'ksconfig.json',
    ],
  },
  ...shellConfig,
  {
    // Props named in capitals (T = texts, OBJ / ACTORS = lookup tables) are this project's
    // convention; hyphenating them would bind a different, lower-case name.
    rules: {
      'vue/attribute-hyphenation': ['warn', 'always', { ignore: ['T', 'OBJ', 'ACTORS'] }],
      'vue/prop-name-casing':      ['warn', 'camelCase', { ignoreProps: ['T', 'OBJ', 'ACTORS'] }],
    },
  },
];
