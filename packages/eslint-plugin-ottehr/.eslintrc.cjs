module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  overrides: [
    {
      // The TypeScript project the rule tests lint their cases inside.
      files: ['test/fixtures/**/*.ts'],
      parserOptions: { project: ['test/fixtures/tsconfig.json'] },
    },
  ],
};
