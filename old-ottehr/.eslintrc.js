module.exports = {
  env: {
    browser: true,
    node: true,
  },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react/recommended',
    'plugin:react/jsx-runtime',
    'plugin:react-hooks/recommended',
    'plugin:prettier/recommended',
    //'plugin:typescript-sort-keys/recommended',
  ],
  parser: '@typescript-eslint/parser',
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['./tsconfig.base.json', './packages/**/tsconfig.json', './apps/**/tsconfig.json'],
  },
  plugins: ['@typescript-eslint' /*, 'typescript-sort-keys'*/],
  root: true,
  rules: {
    '@typescript-eslint/explicit-function-return-type': [
      'error',
      {
        allowExpressions: true,
      },
    ],
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-explicit-any': 'off',
    '@typescript-eslint/no-floating-promises': 'error',
    '@typescript-eslint/no-unused-vars': 'off',
    'react/jsx-key': 'off',
    //'@typescript-eslint/no-unused-vars': [
    //  'error',
    //  {
    //    argsIgnorePattern: '^_',
    //    varsIgnorePattern: '^_',
    //  },
    //],
    'prefer-promise-reject-errors': 'error',
    //'react/jsx-sort-props': [
    //  'error',
    //  {
    //    locale: 'auto',
    //    multiline: 'ignore',
    //    reservedFirst: ['key'],
    //  },
    //],
    //'sort-keys': ['error', 'asc', { caseSensitive: true, minKeys: 2, natural: true }],
  },
  settings: {
    react: {
      version: 'detect',
    },
  },
};
