export const NonPatientWriteOffReasons: Record<string, string> = {
  administrative: 'Administrative Write Off',
  bundled: 'Bundled or Inclusive',
  'case-rate': 'Case Rate or Capitated',
  contractual: 'Contractual Adjustment',
  credentialing: 'Credentialing or Contracting',
  exhausted: 'Efforts Exhausted',
  'friends-and-family': 'Friends & Family Discount Adjustment',
  interest: 'Interest',
  'no-authorizaiton-referral': 'No Authorization Referral',
  'non-covered-max-benefit': 'Non Covered Max Benefit',
  'not-necessary': 'Not Medically Necessary',
  'out-of-network': 'Out-of-Network Write Off',
  'primary-paid-max-benefit': 'Primary Paid Max Benefit',
  small: 'Small Balance',
  stale: 'Stale Date',
  'timely-filing': 'Timely Filing',
  'timely-filing-late': 'Timely Filing Late Encounter',
  uncollectible: 'Uncollectible or Non Billable',
  other: 'Other',
};

export const PatientWriteOffReasons: Record<string, string> = {
  'bad-debt': 'Bad Debt',
  bankruptcy: 'Bankruptcy',
  charity: 'Charity or Financial Assistance',
  collections: 'Collection Agency',
  deceased: 'Deceased',
  'friends-and-family': 'Friends & Family Discount Adjustment',
  'out-of-network': 'Out-of-Network Courtesy Adjustment',
  'patient-experience': 'Patient Experience or Service Recovery',
  'prompt-pay': 'Prompt Pay Discount',
  small: 'Small Balance',
  uncollectible: 'Uncollectible or Non Billable',
  other: 'Other',
};

export function writeOffReasonLabel(party: string, reason: string): string {
  const [own, other] =
    party === 'patient'
      ? [PatientWriteOffReasons, NonPatientWriteOffReasons]
      : [NonPatientWriteOffReasons, PatientWriteOffReasons];

  if (Object.prototype.hasOwnProperty.call(own, reason)) return own[reason];
  if (Object.prototype.hasOwnProperty.call(other, reason)) return other[reason];
  return reason;
}
