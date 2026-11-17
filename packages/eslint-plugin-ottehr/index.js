// @ts-check
'use strict';

// Repo-specific ESLint rules, enabled by the package configs that need them as `ottehr/<rule>`.
// CommonJS without a build step, because ESLint 8 loads plugins with require().
module.exports = {
  rules: {
    'billing-fhir-client-only': require('./rules/billing-fhir-client-only'),
    'require-disable-reason': require('./rules/require-disable-reason'),
  },
};
