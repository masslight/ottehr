export const ENABLE_ELIGIBILITY_CHECK_KEY = 'enabledEligibilityCheck';

export const INSURANCE_PLAN_PAYER_META_TAG_CODE = 'insurance-payer-plan';

export const INSURANCE_SETTINGS_MAP = {
  requiresSubscriberId: 'Requires Subscriber Id',
  requiresSubscriberName: 'Requires Subscriber Name',
  requiresSubscriberDOB: 'Requires Subscriber Date Of Birth',
  requiresRelationshipToSubscriber: 'Requires Relationship To Subscriber',
  requiresInsuranceName: 'Requires Insurance Name',
  requiresInsuranceCardImage: 'Requires Insurance Card Images (Telemed Only)',
  requiresFacilityNPI: 'Requires Facility NPI',
  requiresStateUID: 'Requires State UID',
  [ENABLE_ELIGIBILITY_CHECK_KEY]: 'Insurance eligibility check',
};

export const INSURANCE_SETTINGS_DEFAULTS: { [key in keyof typeof INSURANCE_SETTINGS_MAP]: boolean } = {
  requiresSubscriberId: true,
  requiresSubscriberName: false,
  requiresRelationshipToSubscriber: true,
  requiresInsuranceName: true,
  requiresInsuranceCardImage: true,
  requiresSubscriberDOB: false,
  requiresFacilityNPI: false,
  requiresStateUID: false,
  enabledEligibilityCheck: true,
};
