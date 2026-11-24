/**
 * Where a referral is worked, for everything that links to one (the Tasks queue action, the notification
 * bell), so these routes stay in one place alongside the `<Route path>` and patient-page tab they must agree with.
 */
export const patientReferralsPath = (patientId: string): string => `/patient/${patientId}?tab=referrals`;

export const visitPlanPath = (appointmentId: string): string => `/in-person/${appointmentId}/plan`;
