module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  ignorePatterns: ['build', 'playwright-report'],
};
