const root = require('../../.eslintrc.cjs');

const SERIALIZE_INPUT_MESSAGE =
  'Do not serialize or log the whole zambda input, its headers or secrets: wrapHandler already logs the body. Log the specific fields you need.';
const LOG_TOKEN_MESSAGE = 'Do not log access tokens.';

module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  ignorePatterns: ['src/scripts/detect-tls.js'],
  overrides: [
    {
      files: ['src/**/*.ts'],
      excludedFiles: ['src/scripts/**'],
      rules: {
        'no-restricted-syntax': [
          ...root.rules['no-restricted-syntax'],
          {
            selector:
              "CallExpression[callee.object.name='JSON'][callee.property.name='stringify'] > Identifier.arguments[name=/^(input|event|secrets)$/]",
            message: SERIALIZE_INPUT_MESSAGE,
          },
          {
            selector:
              "CallExpression[callee.object.name='JSON'][callee.property.name='stringify'] > MemberExpression.arguments[property.name=/^(headers|secrets)$/]",
            message: SERIALIZE_INPUT_MESSAGE,
          },
          {
            selector:
              "CallExpression[callee.object.name='console'] > Identifier.arguments[name=/^(input|event|secrets)$/]",
            message: SERIALIZE_INPUT_MESSAGE,
          },
          {
            selector:
              "CallExpression[callee.object.name='console'] > MemberExpression.arguments[property.name=/^(headers|secrets)$/]",
            message: SERIALIZE_INPUT_MESSAGE,
          },
          {
            selector: "CallExpression[callee.object.name='console'] > Identifier.arguments[name=/^token$|Token$/]",
            message: LOG_TOKEN_MESSAGE,
          },
        ],
      },
    },
  ],
};
