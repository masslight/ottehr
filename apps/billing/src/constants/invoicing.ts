import { FEATURE_FLAGS_CONFIG } from 'utils/lib/ottehr-config/feature-flags';

// The deploy check makes sure BILLING_INTEGRATION is 'ottehr' or 'all' when this is on.
export const INVOICING_IN_BILLING_APP =
  (FEATURE_FLAGS_CONFIG.ottehrBillingInvoicingEnabled ?? false) &&
  (FEATURE_FLAGS_CONFIG.invoicingInBillingApp ?? false);
