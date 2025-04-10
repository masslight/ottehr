# EHR README

## EHR E2E Tests

For E2E testing documentation and guide please check the [E2E Testing Guide](./test/e2e-readme/README.md)

## FEATURE FLAGS

For feature flag configuration, application environment variables are used. For this purpose, a constant has been established in ehr: `apps/ehr/src/constants/feature-flags.ts`. This configuration shows which feature flags are currently used in the application and what they are called.

```
export const FEATURE_FLAGS = {
  LAB_ORDERS_ENABLED: import.meta.env.VITE_APP_IS_LAB_ORDERS_ENABLED_FEATURE_FLAG === 'true',
};
```
