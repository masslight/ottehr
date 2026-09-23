module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  ignorePatterns: ['build', 'playwright-report', 'playwright-report-login', 'setup-test-deps.js', 'auth.setup.js'],
  overrides: [
    {
      // A theme's index modules are its contract: vite swaps the theme directory via THEME_PATH, and
      // CustomThemeProvider merges the active theme's `index` over the default's.
      files: ['src/themes/**'],
      rules: {
        'no-restricted-syntax': 'off',
      },
    },
  ],
};
