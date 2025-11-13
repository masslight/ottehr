module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
    module: 'ESNext',
    target: 'esnext',
    lib: ['esnext.array', 'dom'],
  },
  ignorePatterns: ['build', 'playwright-report', 'playwright-report-login'],
};
