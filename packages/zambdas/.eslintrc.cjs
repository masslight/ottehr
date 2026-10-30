const path = require('node:path');
const root = require('../../.eslintrc.cjs');
const billingAppZambdas = require('../../config/billing-app-core/zambdas.json').zambdas;

// Billing zambdas read and write only billing-tagged resources, through createBillingClient. The scoping
// is client-side SDK config (workspaceTag / ignoreTags) over one M2M token, so nothing server-side backs
// it up: a clinical or unscoped client in billing code silently sees, and writes, the wrong resources.
// Where one is really needed, disable the rule on that line and say why.

// Every zambda the billing app deploys: all of src/billing plus the billing subscriptions and crons that
// live elsewhere. Read from the deploy config so a new billing zambda is covered wherever it lives.
const BILLING_ZAMBDA_FILES = [
  'src/billing/**/*.ts',
  ...Object.values(billingAppZambdas)
    .map(({ src }) => path.posix.dirname(src))
    .filter((dir) => !dir.startsWith('src/billing/'))
    .map((dir) => `${dir}/**/*.ts`),
];

const NON_BILLING_CLIENT =
  'Billing zambdas use createBillingClient (src/billing/shared.ts): this client reads and writes outside the billing workspace tag. If it is really needed, disable this line and say why.';
const UNSCOPED_CLIENT =
  'createEraReadClient is unscoped: it reads untagged and billing resources alike and writes untagged ones. Only code that must see resources before they are tagged (sub-tag-era-resources) needs it; otherwise use createBillingClient. If it is really needed, disable this line and say why.';

// An override that restates a rule replaces its options, so carry over the root's re-export bans.
const [, ...rootRestrictedSyntax] = root.rules['no-restricted-syntax'];
const [, rootRestrictedImports] = root.rules['no-restricted-imports'];

module.exports = {
  extends: ['../../.eslintrc.cjs'],
  parserOptions: {
    tsconfigRootDir: __dirname,
    project: ['tsconfig.json'],
  },
  ignorePatterns: ['src/scripts/detect-tls.js'],
  overrides: [
    {
      files: BILLING_ZAMBDA_FILES,
      rules: {
        'no-restricted-imports': [
          'error',
          {
            paths: [
              ...rootRestrictedImports.paths,
              { name: 'utils/lib/helpers/helpers', importNames: ['createOystehrClient'], message: NON_BILLING_CLIENT },
            ],
            patterns: [
              {
                group: ['**/shared/helpers'],
                importNames: ['createClinicalOystehrClient'],
                message: NON_BILLING_CLIENT,
              },
              { group: ['**/shared'], importNames: ['createEraReadClient'], message: UNSCOPED_CLIENT },
            ],
          },
        ],
        'no-restricted-syntax': [
          'error',
          ...rootRestrictedSyntax,
          { selector: "NewExpression[callee.name='Oystehr']", message: NON_BILLING_CLIENT },
          {
            selector: "CallExpression[callee.name='wrapTaskHandler']:not(:has(Property[key.name='createClient']))",
            message: 'wrapTaskHandler defaults to the clinical client: pass { createClient: createBillingClient }.',
          },
        ],
      },
    },
  ],
};
