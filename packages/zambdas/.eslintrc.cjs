const path = require('node:path');
const billingAppZambdas = require('../../config/billing-app-core/zambdas.json').zambdas;

// Every zambda the billing app deploys: all of src/billing plus the billing subscriptions and crons that
// live elsewhere. Read from the deploy config so a new billing zambda is covered wherever it lives.
const BILLING_ZAMBDA_FILES = [
  'src/billing/**/*.ts',
  ...Object.values(billingAppZambdas)
    .map(({ src }) => path.posix.dirname(src))
    .filter((dir) => !dir.startsWith('src/billing/'))
    .map((dir) => `${dir}/**/*.ts`),
];

module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  ignorePatterns: ['src/scripts/detect-tls.js'],
  overrides: [
    {
      // Billing zambdas use FHIR only through the client createBillingClient makes, typed BillingOystehr.
      // Getting a clinical or unscoped client takes a justified exception, disabled with the reason where
      // the client is got; see packages/eslint-plugin-ottehr.
      files: BILLING_ZAMBDA_FILES,
      plugins: ['ottehr'],
      rules: {
        'ottehr/billing-fhir-client-only': [
          'error',
          {
            billingClient: { type: 'BillingOystehr', file: path.join(__dirname, 'src/billing/shared.ts') },
            otherScopedClients: [
              { type: 'ClinicalOystehr', file: path.join(__dirname, 'src/shared/helpers.ts') },
              { type: 'UnscopedOystehr', file: path.join(__dirname, 'src/billing/shared.ts') },
            ],
          },
        ],
        'ottehr/require-disable-reason': ['error', { rules: ['ottehr/billing-fhir-client-only'] }],
      },
    },
  ],
};
