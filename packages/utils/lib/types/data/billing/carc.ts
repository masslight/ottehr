import { roundNumberToDecimalPlaces } from '../../../utils/convert';
import { X12_ADJUSTMENT_GROUP_CODE, X12AdjustmentGroupCode } from './billing.constants';
import type { ClaimRemitAdjustment } from './billing.types';

export const X12_ADJUSTMENT_GROUP_LABELS: Record<X12AdjustmentGroupCode, string> = {
  [X12_ADJUSTMENT_GROUP_CODE.contractualObligation]: 'Contractual Obligation',
  [X12_ADJUSTMENT_GROUP_CODE.correctionReversal]: 'Correction/Reversal',
  [X12_ADJUSTMENT_GROUP_CODE.otherAdjustment]: 'Other Adjustment',
  [X12_ADJUSTMENT_GROUP_CODE.payerInitiated]: 'Payer Initiated Reduction',
  [X12_ADJUSTMENT_GROUP_CODE.patientResponsibility]: 'Patient Responsibility',
};

// The CARCs that split a PR-group adjustment into the classic patient-responsibility buckets.
export const PATIENT_RESP_CARC = {
  deductible: '1',
  coinsurance: '2',
  copay: '3',
} as const;

// X12 claim adjustment reason codes (CARC, external code list 139) -> official short description,
// as republished by CMS and payer remittance guides. Deactivated codes are omitted and wording may
// lag the current X12 revision; unknown codes render a generic label via carcDescription().
export const CARC_DESCRIPTIONS: Record<string, string> = {
  '1': 'Deductible amount.',
  '2': 'Coinsurance amount.',
  '3': 'Co-payment amount.',
  '4': 'The procedure code is inconsistent with the modifier used, or a required modifier is missing.',
  '5': 'The procedure code/type of bill is inconsistent with the place of service.',
  '6': "The procedure/revenue code is inconsistent with the patient's age.",
  '7': "The procedure/revenue code is inconsistent with the patient's gender.",
  '8': 'The procedure code is inconsistent with the provider type/specialty (taxonomy).',
  '9': "The diagnosis is inconsistent with the patient's age.",
  '10': "The diagnosis is inconsistent with the patient's gender.",
  '11': 'The diagnosis is inconsistent with the procedure.',
  '12': 'The diagnosis is inconsistent with the provider type.',
  '13': 'The date of death precedes the date of service.',
  '14': 'The date of birth follows the date of service.',
  '15': 'The authorization number is missing, invalid, or does not apply to the billed services or provider.',
  '16': 'Claim/service lacks information or has submission/billing error(s).',
  '18': 'Exact duplicate claim/service.',
  '19': "This is a work-related injury/illness and thus the liability of the Worker's Compensation Carrier.",
  '20': 'This injury/illness is covered by the liability carrier.',
  '21': 'This injury/illness is the liability of the no-fault carrier.',
  '22': 'This care may be covered by another payer per coordination of benefits.',
  '23': 'The impact of prior payer(s) adjudication including payments and/or adjustments.',
  '24': 'Charges are covered under a capitation agreement/managed care plan.',
  '26': 'Expenses incurred prior to coverage.',
  '27': 'Expenses incurred after coverage terminated.',
  '29': 'The time limit for filing has expired.',
  '31': 'Patient cannot be identified as our insured.',
  '32': 'Our records indicate the patient is not an eligible dependent.',
  '33': 'Insured has no dependent coverage.',
  '34': 'Insured has no coverage for newborns.',
  '35': 'Lifetime benefit maximum has been reached.',
  '39': 'Services denied at the time authorization/pre-certification was requested.',
  '40': 'Charges do not meet qualifications for emergent/urgent care.',
  '44': 'Prompt-pay discount.',
  '45': 'Charge exceeds fee schedule/maximum allowable or contracted/legislated fee arrangement.',
  '49': 'This is a non-covered service because it is a routine/preventive exam or a diagnostic/screening procedure done in conjunction with a routine/preventive exam.',
  '50': "These are non-covered services because this is not deemed a 'medical necessity' by the payer.",
  '51': 'These are non-covered services because this is a pre-existing condition.',
  '53': 'Services by an immediate relative or a member of the same household are not covered.',
  '54': 'Multiple physicians/assistants are not covered in this case.',
  '55': 'Procedure/treatment/drug is deemed experimental/investigational by the payer.',
  '56': "Procedure/treatment has not been deemed 'proven to be effective' by the payer.",
  '58': 'Treatment was deemed by the payer to have been rendered in an inappropriate or invalid place of service.',
  '59': 'Processed based on multiple or concurrent procedure rules.',
  '60': 'Charges for outpatient services are not covered when performed within a period of time prior to or after inpatient services.',
  '61': 'Adjusted for failure to obtain second surgical opinion.',
  '66': 'Blood deductible.',
  '69': 'Day outlier amount.',
  '70': 'Cost outlier - adjustment to compensate for additional costs.',
  '74': 'Indirect Medical Education Adjustment.',
  '75': 'Direct Medical Education Adjustment.',
  '76': 'Disproportionate Share Adjustment.',
  '78': 'Non-covered days/room charge adjustment.',
  '85': 'Patient interest adjustment.',
  '89': 'Professional fees removed from charges.',
  '90': 'Ingredient cost adjustment.',
  '91': 'Dispensing fee adjustment.',
  '94': 'Processed in excess of charges.',
  '95': 'Plan procedures not followed.',
  '96': 'Non-covered charge(s).',
  '97': 'The benefit for this service is included in the payment/allowance for another service/procedure that has already been adjudicated.',
  '100': 'Payment made to patient/insured/responsible party.',
  '101': 'Predetermination: anticipated payment upon completion of services or claim adjudication.',
  '102': 'Major medical adjustment.',
  '103': 'Provider promotional discount (e.g., senior citizen discount).',
  '104': 'Managed care withholding.',
  '105': 'Tax withholding.',
  '106': 'Patient payment option/election not in effect.',
  '107': 'The related or qualifying claim/service was not identified on this claim.',
  '108': 'Rent/purchase guidelines were not met.',
  '109':
    'Claim/service not covered by this payer/contractor. You must send the claim/service to the correct payer/contractor.',
  '110': 'Billing date predates service date.',
  '111': 'Not covered unless the provider accepts assignment.',
  '112': 'Service not furnished directly to the patient and/or not documented.',
  '114': 'Procedure/product not approved by the Food and Drug Administration.',
  '115': 'Procedure postponed, canceled, or delayed.',
  '116': 'The advance indemnification notice signed by the patient did not comply with requirements.',
  '117': 'Transportation is only covered to the closest facility that can provide the necessary care.',
  '118': 'ESRD network support adjustment.',
  '119': 'Benefit maximum for this time period or occurrence has been reached.',
  '121': 'Indemnification adjustment - compensation for outstanding member responsibility.',
  '122': 'Psychiatric reduction.',
  '128': "Newborn's services are covered in the mother's allowance.",
  '129': 'Prior processing information appears incorrect.',
  '130': 'Claim submission fee.',
  '131': 'Claim specific negotiated discount.',
  '132': 'Prearranged demonstration project adjustment.',
  '133': 'The disposition of this service line is pending further review.',
  '134': 'Technical fees removed from charges.',
  '135': 'Interim bills cannot be processed.',
  '136': "Failure to follow prior payer's coverage rules.",
  '137': 'Regulatory surcharges, assessments, allowances or health related taxes.',
  '138': 'Appeal procedures not followed or time limits not met.',
  '140': 'Patient/insured health identification number and name do not match.',
  '142': 'Monthly Medicaid patient liability amount.',
  '143': 'Portion of payment deferred.',
  '144': 'Incentive adjustment, e.g. preferred product/service.',
  '146': 'Diagnosis was invalid for the date(s) of service reported.',
  '147': 'Provider contracted/negotiated rate expired or not on file.',
  '148': 'Information from another provider was not provided or was insufficient/incomplete.',
  '149': 'Lifetime benefit maximum has been reached for this service/benefit category.',
  '150': 'Payer deems the information submitted does not support this level of service.',
  '151':
    'Payment adjusted because the payer deems the information submitted does not support this many/frequency of services.',
  '152': 'Payer deems the information submitted does not support this length of service.',
  '153': 'Payer deems the information submitted does not support this dosage.',
  '154': "Payer deems the information submitted does not support this day's supply.",
  '155': 'Patient refused the service/procedure.',
  '157': 'Service/procedure was provided as a result of an act of war.',
  '158': 'Service/procedure was provided outside of the United States.',
  '159': 'Service/procedure was provided as a result of terrorism.',
  '160': 'Injury/illness was the result of an activity that is a benefit exclusion.',
  '161': 'Provider performance bonus.',
  '162':
    'State-mandated requirement for property and casualty, see claim payment remarks code for specific explanation.',
  '163': 'Attachment/other documentation referenced on the claim was not received.',
  '164': 'Attachment/other documentation referenced on the claim was not received in a timely fashion.',
  '166': "These services were submitted after this payer's responsibility for processing claims under this plan ended.",
  '167': 'This (these) diagnosis(es) is (are) not covered.',
  '168':
    "Service(s) have been considered under the patient's medical plan. Benefits are not available under this dental plan.",
  '169': 'Alternate benefit has been provided.',
  '170': 'Payment is denied when performed/billed by this type of provider.',
  '171': 'Payment is denied when performed/billed by this type of provider in this type of facility.',
  '172': 'Payment is adjusted when performed/billed by a provider of this specialty.',
  '173': 'Service/equipment was not prescribed by a physician.',
  '174': 'Service was not prescribed prior to delivery.',
  '175': 'Prescription is incomplete.',
  '176': 'Prescription is not current.',
  '177': 'Patient has not met the required eligibility requirements.',
  '178': 'Patient has not met the required spend down requirements.',
  '179': 'Patient has not met the required waiting requirements.',
  '180': 'Patient has not met the required residency requirements.',
  '181': 'Procedure code was invalid on the date of service.',
  '182': 'Procedure modifier was invalid on the date of service.',
  '183': 'The referring provider is not eligible to refer the service billed.',
  '184': 'The prescribing/ordering provider is not eligible to prescribe/order the service billed.',
  '185': 'The rendering provider is not eligible to perform the service billed.',
  '186': 'Level of care change adjustment.',
  '187':
    'Consumer spending account payments (includes but is not limited to flexible spending account, health savings account, health reimbursement account, etc.).',
  '188': 'This product/procedure is only covered when used according to FDA recommendations.',
  '189':
    "'Not otherwise classified' or 'unlisted' procedure code (CPT/HCPCS) was billed when there is a specific procedure code for this procedure/service.",
  '190': 'Payment is included in the allowance for a Skilled Nursing Facility (SNF) qualified stay.',
  '191': "Not a work related injury/illness and thus not the liability of the workers' compensation carrier.",
  '192': 'Non standard adjustment code from paper remittance.',
  '193':
    'Original payment decision is being maintained. Upon review, it was determined that this claim was processed properly.',
  '194': 'Anesthesia performed by the operating physician, the assistant surgeon or the attending physician.',
  '195': 'Refund issued to an erroneous priority payer for this claim/service.',
  '197': 'Precertification/authorization/notification/pre-treatment absent.',
  '198': 'Precertification/notification/authorization/pre-treatment exceeded.',
  '199': 'Revenue code and procedure code do not match.',
  '200': 'Expenses incurred during lapse in coverage.',
  '201': "Patient is responsible for amount of this claim/service through 'set aside arrangement' or other agreement.",
  '202': 'Non-covered personal comfort or convenience services.',
  '203': 'Discontinued or reduced service.',
  '204': "This service/equipment/drug is not covered under the patient's current benefit plan.",
  '205': 'Pharmacy discount card processing fee.',
  '206': 'National Provider Identifier - missing.',
  '207': 'National Provider Identifier - invalid format.',
  '208': 'National Provider Identifier - not matched.',
  '209':
    'Per regulatory or other agreement, the provider cannot collect this amount from the patient. However, this amount may be billed to a subsequent payer.',
  '210': 'Payment adjusted because pre-certification/authorization not received in a timely fashion.',
  '211': 'National Drug Codes (NDC) not eligible for rebate are not covered.',
  '212': 'Administrative surcharges are not covered.',
  '213': 'Non-compliance with the physician self referral prohibition legislation or payer policy.',
  '215': 'Based on subrogation of a third party settlement.',
  '216': 'Based on the findings of a review organization.',
  '219': 'Based on extent of injury.',
  '222': 'Exceeds the contracted maximum number of hours/days/units by this provider for this period.',
  '223':
    'Adjustment code for mandated federal, state or local law/regulation that is not already covered by another code and is mandated before a new code can be created.',
  '224':
    'Patient identification compromised by identity theft. Identity verification required for processing this and future claims.',
  '225': 'Penalty or interest payment by payer.',
  '226':
    'Information requested from the billing/rendering provider was not provided or not provided timely or was insufficient/incomplete.',
  '227':
    'Information requested from the patient/insured/responsible party was not provided or was insufficient/incomplete.',
  '228':
    'Denied for failure of this provider, another provider or the subscriber to supply requested information to a previous payer for their adjudication.',
  '229': 'Partial charge amount not considered by Medicare due to the initial claim type of bill being 12X.',
  '231': 'Mutually exclusive procedures cannot be done in the same day/setting.',
  '232': 'Institutional transfer amount.',
  '233': 'Services/charges related to the treatment of a hospital-acquired condition or preventable medical error.',
  '234': 'This procedure is not paid separately.',
  '235': 'Sales tax.',
  '236':
    'This procedure or procedure/modifier combination is not compatible with another procedure or procedure/modifier combination provided on the same day according to the National Correct Coding Initiative or workers compensation state regulations/fee schedule requirements.',
  '237': 'Legislated/regulatory penalty.',
  '238': 'Claim spans eligible and ineligible periods of coverage; this is the reduction for the ineligible period.',
  '239': 'Claim spans eligible and ineligible periods of coverage. Rebill separate claims.',
  '240': "The diagnosis is inconsistent with the patient's birth weight.",
  '241': 'Low Income Subsidy (LIS) co-payment amount.',
  '242': 'Services not provided by network/primary care providers.',
  '243': 'Services not authorized by network/primary care providers.',
  '245': 'Provider performance program withhold.',
  '246': 'This non-payable code is for required reporting only.',
  '247':
    'Deductible for professional service rendered in an institutional setting and billed on an institutional claim.',
  '248':
    'Coinsurance for professional service rendered in an institutional setting and billed on an institutional claim.',
  '249': 'This claim has been identified as a readmission.',
  '250': 'The attachment/other documentation that was received was the incorrect attachment/document.',
  '251': 'The attachment/other documentation that was received was incomplete or deficient.',
  '252': 'An attachment/other documentation is required to adjudicate this claim/service.',
  '253': 'Sequestration - reduction in federal payment.',
  '254':
    "Claim received by the dental plan, but benefits not available under this plan. Submit these services to the patient's medical plan for further consideration.",
  '256': 'Service not payable per managed care contract.',
  '257':
    'The disposition of the claim/service is undetermined during the premium payment grace period, per Health Insurance Exchange requirements.',
  '258': 'Claim/service not covered when patient is in custody/incarcerated.',
  '259': 'Additional payment for dental/vision service utilization.',
  '260': 'Processed under Medicaid ACA Enhanced Fee Schedule.',
  '261': "The procedure or service is inconsistent with the patient's history.",
  '262': 'Adjustment for delivery cost.',
  '263': 'Adjustment for shipping cost.',
  '264': 'Adjustment for postage cost.',
  '265': 'Adjustment for administrative cost.',
  '266': 'Adjustment for compound preparation cost.',
  '267': 'Claim/service lacks physician/operative or other supporting documentation.',
  '268': 'The claim spans two calendar years. Please resubmit one claim per calendar year.',
  '269': 'Anesthesia not covered for this service/procedure.',
  '270':
    "Claim received by the medical plan, but benefits not available under this plan. Submit these services to the patient's dental plan for further consideration.",
  '271':
    'Prior contractual reductions related to a current periodic payment as part of a contractual payment schedule when deferred amounts have been previously reported.',
  '272': 'Coverage/program guidelines were not met.',
  '273': 'Coverage/program guidelines were exceeded.',
  '274': 'Fee/service not payable per patient care coordination arrangement.',
  '275': "Prior payer's (or payers') patient responsibility (deductible, coinsurance, co-payment) not covered.",
  '276': 'Services denied by the prior payer(s) are not covered by this payer.',
  '277':
    'The disposition of the claim/service is undetermined during the premium payment grace period, per Health Insurance SHOP Exchange requirements.',
  '278': 'Performance program proficiency requirements not met.',
  '279': 'Services not provided by preferred network providers.',
  '280':
    "Claim received by the medical plan, but benefits not available under this plan. Submit these services to the patient's pharmacy plan for further consideration.",
  '281': 'Deductible waived per contractual agreement.',
  '282': 'The procedure/revenue code is inconsistent with the type of bill.',
  '283': 'Attending provider is not eligible to provide direction of care.',
  '284':
    'Precertification/authorization/notification/pre-treatment number may be valid but does not apply to the billed services.',
  '285': 'Appeal procedures not followed.',
  '286': 'Appeal time limits not met.',
  '287': 'Referral exceeded.',
  '288': 'Referral absent.',
  '289': 'Services considered under the dental and medical plans, benefits not available.',
  '290':
    "Claim received by the medical plan, but benefits not available under this plan. Claim has been forwarded to the patient's dental plan for further consideration.",
  '291':
    "Claim received by the dental plan, but benefits not available under this plan. Claim has been forwarded to the patient's medical plan for further consideration.",
  '292':
    "Claim received by the medical plan, but benefits not available under this plan. Claim has been forwarded to the patient's pharmacy plan for further consideration.",
  '293': 'Payment made to entity, assignment of benefits not authorized.',
  '299': 'The billing provider is not eligible to receive payment for the service billed.',
  '300':
    "Claim received by the medical plan, but benefits not available under this plan. Claim has been forwarded to the patient's behavioral health plan for further consideration.",
  '301':
    "Claim received by the medical plan, but benefits not available under this plan. Submit these services to the patient's behavioral health plan for further consideration.",
  '302': 'Precertification/notification/authorization/pre-treatment time limit has expired.',
  '303':
    "Prior payer's (or payers') patient responsibility not covered for Qualified Medicare and Medicaid Beneficiaries.",
  A0: 'Patient refund amount.',
  A1: 'Claim/service denied.',
  A5: 'Medicare claim PPS capital cost outlier amount.',
  A6: 'Prior hospitalization or 30 day transfer requirement not met.',
  A8: 'Ungroupable DRG.',
  B1: 'Non-covered visits.',
  B4: 'Late filing penalty.',
  B7: 'This provider was not certified/eligible to be paid for this procedure/service on this date of service.',
  B8: 'Alternative services were available, and should have been utilized.',
  B9: 'Patient is enrolled in a hospice.',
  B10: 'Allowed amount has been reduced because a component of the basic procedure/test was paid.',
  B11: 'The claim/service has been transferred to the proper payer/processor for processing.',
  B12: "Services not documented in patient's medical records.",
  B13: 'Previously paid. Payment for this claim/service may have been provided in a previous payment.',
  B14: 'Only one visit or consultation per physician per day is covered.',
  B15: 'This service/procedure requires that a qualifying service/procedure be received and covered.',
  B16: "'New patient' qualifications were not met.",
  B20: 'Procedure/service was partially or fully furnished by another provider.',
  B22: 'This payment is adjusted based on the diagnosis.',
  B23: 'Procedure billed is not authorized per your Clinical Laboratory Improvement Amendment (CLIA) proficiency test.',
};

export function carcDescription(code: string): string | undefined {
  return CARC_DESCRIPTIONS[code];
}

export interface PatientRespBuckets {
  deductible: number;
  coinsurance: number;
  copay: number;
  // PR-group adjustments with any other (or absent) CARC
  other: number;
}

// Sums PR-group CAS adjustments into deductible (PR-1) / coinsurance (PR-2) / copay (PR-3),
// cent-rounded. Adjustments in other groups are ignored.
export function patientRespBuckets(adjustments: ClaimRemitAdjustment[]): PatientRespBuckets {
  const buckets = { deductible: 0, coinsurance: 0, copay: 0, other: 0 };
  for (const adjustment of adjustments) {
    if (adjustment.groupCode !== X12_ADJUSTMENT_GROUP_CODE.patientResponsibility) continue;
    if (adjustment.reasonCode === PATIENT_RESP_CARC.deductible) buckets.deductible += adjustment.amount;
    else if (adjustment.reasonCode === PATIENT_RESP_CARC.coinsurance) buckets.coinsurance += adjustment.amount;
    else if (adjustment.reasonCode === PATIENT_RESP_CARC.copay) buckets.copay += adjustment.amount;
    else buckets.other += adjustment.amount;
  }
  return {
    deductible: roundNumberToDecimalPlaces(buckets.deductible, 2),
    coinsurance: roundNumberToDecimalPlaces(buckets.coinsurance, 2),
    copay: roundNumberToDecimalPlaces(buckets.copay, 2),
    other: roundNumberToDecimalPlaces(buckets.other, 2),
  };
}
