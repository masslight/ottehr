module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
    module: 'ESNext',
    target: 'esnext',
    lib: ['esnext.array', 'dom'],
  },
  ignorePatterns: [
    'build',
    'playwright-report',
    'playwright-report-login',
    'setup-test-deps.js',
    'validate-e2e-intake-user.js',
  ],
  overrides: [
    {
      // A theme's index modules are its contract: vite swaps the theme directory via THEME_PATH, and
      // IntakeThemeProvider merges the active theme's `index` over the default's.
      files: ['src/themes/**'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
