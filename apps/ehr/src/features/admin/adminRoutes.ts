// Admin route URL constants and sidebar active-item logic. Kept free of React/page imports so routing,
// the sidebar, and unit tests can consume it without pulling in the whole admin app.

export const INSURANCES_URL = '/admin/insurances';
export const FEE_SCHEDULES_URL = '/admin/fee-schedule';
export const CHARGE_MASTERS_URL = '/admin/charge-masters';
export const VIRTUAL_LOCATIONS_URL = '/admin/virtual-locations';
export const BILLING_URL = '/admin/billing';
export const BILLING_INSURANCE_URL = '/admin/billing/insurance';
export const PAYMENT_LOCATIONS_URL = '/admin/billing/payments/locations';
export const OUTREACH_URL = '/admin/outreach';
export const GLOBAL_TEMPLATES_URL = '/admin/global-templates';

// Detail/edit routes whose URLs don't share their sidebar item's path prefix, mapped to the item that
// should stay selected. Trailing slash prevents a singular route from hijacking its plural list route
// (e.g. `/admin/medications/add` won't match `/admin/medication/`). The admin-sidebar-route-coverage
// test asserts every `/admin/*` route in App.tsx resolves here, so a new route can't leave it unmatched.
export const ROUTE_ALIASES: { prefix: string; itemPath: string }[] = [
  { prefix: '/admin/schedule/', itemPath: '/admin/schedules' },
  { prefix: '/admin/group/', itemPath: '/admin/schedules' },
  { prefix: '/admin/employee/', itemPath: '/admin/employees' },
  { prefix: '/admin/medication/', itemPath: '/admin/medications' },
  { prefix: `${INSURANCES_URL}/`, itemPath: BILLING_INSURANCE_URL },
  { prefix: `${FEE_SCHEDULES_URL}/`, itemPath: '/admin/billing/fee-schedules' },
  { prefix: `${CHARGE_MASTERS_URL}/`, itemPath: '/admin/billing/charge-masters' },
  { prefix: `${PAYMENT_LOCATIONS_URL}/`, itemPath: '/admin/billing/payment-locations' },
];

export const isItemActive = (pathname: string, itemPath: string): boolean =>
  pathname === itemPath ||
  pathname.startsWith(`${itemPath}/`) ||
  ROUTE_ALIASES.some((alias) => alias.itemPath === itemPath && pathname.startsWith(alias.prefix));
