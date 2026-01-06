// cSpell:ignore AUTOPOL, Champus, LIAB, MCPOL, medib, PUBLICPOL, WCBPOL
import { NetworkType } from 'candidhealth/api';
import { Coding } from 'fhir/r4b';
import z from 'zod';
import { VALUE_SET_OVERRIDES as OVERRIDES } from '../../../ottehr-config-overrides/value-sets';
import { mergeAndFreezeConfigObjects } from '../helpers';

export interface InsurancePlanType {
  candidCode: NetworkType;
  label: string;
  coverageCoding?: Coding;
}

const insuranceTypeOptions: InsurancePlanType[] = z.array(z.custom<InsurancePlanType>()).parse([
  {
    candidCode: '09',
    label: 'Self Pay',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/coverage-selfpay',
      code: 'pay',
    },
  },
  {
    candidCode: '11',
    label: 'Other Non-Federal Programs',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'PUBLICPOL',
    },
  },
  {
    candidCode: '12',
    label: 'PPO',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'PPO',
    },
  },
  {
    candidCode: '13',
    label: 'POS',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'POS',
    },
  },
  {
    candidCode: '14',
    label: 'EPO',
    coverageCoding: {
      system: 'https://nahdo.org/sopt',
      code: '515',
      display: 'Commercial Managed Care - EPO',
    },
  },
  {
    candidCode: '15',
    label: 'Indemnity Insurance',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'HIP',
      display: 'health insurance plan',
    },
  },
  {
    candidCode: '16',
    label: 'HMO Medicare Risk',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'MCPOL',
      display: 'managed care policy',
    },
  },
  {
    candidCode: '17',
    label: 'DMO',
    coverageCoding: {
      system: 'http://nucc.org/provider-taxonomy',
      code: '1223D0001X',
      display: 'Dental, Dental Public Health',
    },
  },
  {
    candidCode: 'AM',
    label: 'Auto',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'AUTOPOL',
    },
  },
  {
    candidCode: 'BL',
    label: 'BlueCross BlueShield',
  },
  {
    candidCode: 'CH',
    label: 'Champus',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'PUBLICPOL',
      display: 'public healthcare',
    },
  },
  {
    candidCode: 'CI',
    label: 'Commercial Insurance Co',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'COMM',
      display: 'Commercial',
    },
  },
  {
    candidCode: 'DS',
    label: 'Disability',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'DIS',
    },
  },
  {
    candidCode: 'FI',
    label: 'Federal Employees',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'fep',
      display: 'Federal Employee Program',
    },
  },
  {
    candidCode: 'HM',
    label: 'HMO',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'HMO',
    },
  },
  {
    candidCode: 'LM',
    label: 'Liability',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'LIAB',
      display: 'liability insurance',
    },
  },
  {
    candidCode: 'MA',
    label: 'Medicare Part A',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'media',
      display: 'Medicare Part A',
    },
  },
  {
    candidCode: 'MB',
    label: 'Medicare Part B',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'medib',
      display: 'Medicare Part B',
    },
  },
  {
    candidCode: 'MC',
    label: 'Medicaid',
  },
  {
    candidCode: 'OF',
    label: 'Other Federal Program',
  },
  {
    candidCode: 'TV',
    label: 'Title V',
  },
  {
    candidCode: 'VA',
    label: 'Veterans Affairs Plan',
    coverageCoding: {
      system: 'http://hl7.org/fhir/us/directory-attestation/CodeSystem/InsuranceProductTypeCS',
      code: 'va',
      display: 'Veterans Affairs',
    },
  },
  {
    candidCode: 'WC',
    label: 'Workers Comp Health Claim',
    coverageCoding: {
      system: 'http://terminology.hl7.org/CodeSystem/v3-ActCode',
      code: 'WCBPOL',
    },
  },
  {
    candidCode: 'ZZ',
    label: 'Mutually Defined',
  },
]);

const formValueSets = {
  birthSexOptions: [
    {
      label: 'Male',
      value: 'Male',
    },
    {
      label: 'Female',
      value: 'Female',
    },
    {
      label: 'Intersex',
      value: 'Intersex',
    },
  ],
  cancelReasonOptions: [
    { label: 'Patient improved', value: 'Patient improved' },
    { label: 'Wait time too long', value: 'Wait time too long' },
    { label: 'Prefer another provider', value: 'Prefer another provider' },
    { label: 'Changing location', value: 'Changing location' },
    { label: 'Changing to telemedicine', value: 'Changing to telemedicine' },
    { label: 'Financial responsibility concern', value: 'Financial responsibility concern' },
    { label: 'Insurance issue', value: 'Insurance issue' },
  ],
  cancelReasonOptionsVirtual: [
    { label: 'Wait time too long', value: 'Wait time too long' },
    { label: 'Going to another company', value: 'Going to another company' },
    { label: 'Going to an emergency department', value: 'Going to an emergency department' },
    { label: 'Cost is too high', value: 'Cost is too high' },
    { label: 'Insurance issue', value: 'Insurance issue' },
    { label: 'Technical issue', value: 'Technical issue' },
    { label: 'Patient improved', value: 'Patient improved' },
    { label: 'Clicked accidentally', value: 'Clicked accidentally' },
    { label: 'Other', value: 'Other' },
  ],
  cancelReasonOptionsVirtualProviderSide: [
    {
      label: 'Patient did not answer after multiple attempts',
      value: 'Patient did not answer after multiple attempts',
    },
    { label: 'Wrong patient name on chart', value: 'Wrong patient name on chart' },
    {
      label: 'Technical issues connecting and/ or with video',
      value: 'Technical issues connecting and/ or with video',
    },
    { label: 'Other', value: 'Other' },
  ],
  emergencyContactRelationshipOptions: [
    { label: 'Spouse', value: 'Spouse' },
    { label: 'Parent', value: 'Parent' },
    { label: 'Legal Guardian', value: 'Legal Guardian' },
    { label: 'Other', value: 'Other' },
  ],
  ethnicityOptions: [
    { label: 'Hispanic or Latino', value: 'Hispanic or Latino' },
    { label: 'Not Hispanic or Latino', value: 'Not Hispanic or Latino' },
    { label: 'Decline to Specify', value: 'Decline to Specify' },
  ],
  genderIdentityOptions: [
    { label: 'Female', value: 'Female gender identity' },
    { label: 'Male', value: 'Male gender identity' },
    { label: 'Other', value: 'Non-binary gender identity' },
  ],
  insurancePriorityOptions: [
    { label: 'Primary', value: 'Primary' },
    { label: 'Secondary', value: 'Secondary' },
  ],
  insuranceTypeOptions,
  languageOptions: [
    { label: 'English', value: 'English' },
    { label: 'Spanish', value: 'Spanish' },
    { label: 'Chinese', value: 'Chinese' },
    { label: 'French', value: 'French' },
    { label: 'German', value: 'German' },
    { label: 'Tagalog', value: 'Tagalog' },
    { label: 'Vietnamese', value: 'Vietnamese' },
    { label: 'Italian', value: 'Italian' },
    { label: 'Korean', value: 'Korean' },
    { label: 'Russian', value: 'Russian' },
    { label: 'Polish', value: 'Polish' },
    { label: 'Arabic', value: 'Arabic' },
    { label: 'Portuguese', value: 'Portuguese' },
    { label: 'Japanese', value: 'Japanese' },
    { label: 'Greek', value: 'Greek' },
    { label: 'Hindi', value: 'Hindi' },
    { label: 'Persian', value: 'Persian' },
    { label: 'Urdu', value: 'Urdu' },
    { label: 'Sign Language', value: 'Sign Language' },
    { label: 'Other', value: 'Other' },
  ],
  patientFillingOutAsOptions: [
    { label: 'Parent', value: 'Parent' },
    { label: 'Patient', value: 'Patient' },
  ],
  pointOfDiscoveryOptions: [
    { label: 'Friend/Family', value: 'Friend/Family' },
    { label: 'Been there with another family member', value: 'Been there with another family member' },
    { label: 'Healthcare Professional', value: 'Healthcare Professional' },
    { label: 'Google/Internet search', value: 'Google/Internet search' },
    { label: 'Internet ad', value: 'Internet ad' },
    { label: 'Social media community group', value: 'Social media community group' },
    { label: 'Webinar', value: 'Webinar' },
    { label: 'TV/Radio', value: 'TV/Radio' },
    { label: 'Newsletter', value: 'Newsletter' },
    { label: 'School', value: 'School' },
    { label: 'Drive by/Signage', value: 'Drive by/Signage' },
  ],
  preferredCommunicationMethodOptions: [
    { label: 'No preference', value: 'No preference' },
    { label: 'Email', value: 'Email' },
    { label: 'Home Phone', value: 'Home Phone' },
    { label: 'Cell Phone', value: 'Cell Phone' },
    { label: 'Mail', value: 'Mail' },
  ],
  pronounOptions: [
    {
      label: 'He/him',
      value: 'He/him',
    },
    {
      label: 'She/her',
      value: 'She/her',
    },
    {
      label: 'They/them',
      value: 'They/them',
    },
    {
      label: 'My pronouns are not listed',
      value: 'My pronouns are not listed',
    },
  ],
  raceOptions: [
    { label: 'American Indian or Alaska Native', value: 'American Indian or Alaska Native' },
    { label: 'Asian', value: 'Asian' },
    { label: 'Black or African American', value: 'Black or African American' },
    { label: 'Native Hawaiian or Other Pacific Islander', value: 'Native Hawaiian or Other Pacific Islander' },
    { label: 'White', value: 'White' },
    { label: 'Decline to Specify', value: 'Decline to Specify' },
  ],
  reasonForVisitOptions: [
    { label: 'Cough and/or congestion', value: 'Cough and/or congestion' },
    { label: 'Throat pain', value: 'Throat pain' },
    { label: 'Eye concern', value: 'Eye concern' },
    { label: 'Fever', value: 'Fever' },
    { label: 'Ear pain', value: 'Ear pain' },
    { label: 'Vomiting and/or diarrhea', value: 'Vomiting and/or diarrhea' },
    { label: 'Abdominal (belly) pain', value: 'Abdominal (belly) pain' },
    { label: 'Rash or skin issue', value: 'Rash or skin issue' },
    { label: 'Urinary problem', value: 'Urinary problem' },
    { label: 'Breathing problem', value: 'Breathing problem' },
    { label: 'Injury to arm', value: 'Injury to arm' },
    { label: 'Injury to leg', value: 'Injury to leg' },
    { label: 'Injury to head', value: 'Injury to head' },
    { label: 'Injury (Other)', value: 'Injury (Other)' },
    { label: 'Cut to arm or leg', value: 'Cut to arm or leg' },
    { label: 'Cut to face or head', value: 'Cut to face or head' },
    { label: 'Removal of sutures/stitches/staples', value: 'Removal of sutures/stitches/staples' },
    { label: 'Choked or swallowed something', value: 'Choked or swallowed something' },
    { label: 'Allergic reaction to medication or food', value: 'Allergic reaction to medication or food' },
    { label: 'Other', value: 'Other' },
  ],
  relationshipOptions: [
    { label: 'Self', value: 'Self' },
    { label: 'Spouse', value: 'Spouse' },
    { label: 'Parent', value: 'Parent' },
    { label: 'Legal Guardian', value: 'Legal Guardian' },
    { label: 'Other', value: 'Other' },
  ],
  relationshipToInsuredOptions: [
    { label: 'Self', value: 'Self' },
    { label: 'Child', value: 'Child' },
    { label: 'Parent', value: 'Parent' },
    { label: 'Spouse', value: 'Spouse' },
    { label: 'Common Law Spouse', value: 'Common Law Spouse' },
    { label: 'Injured Party', value: 'Injured Party' },
    { label: 'Other', value: 'Other' },
  ],
  rxHistoryConsentOptions: [
    { label: 'Rx history consent signed by the patient', value: 'Rx history consent signed by the patient' },
    { label: 'Rx history consent unasked to the patient', value: 'Rx history consent unasked to the patient' },
    { label: 'Rx history consent denied by the patient', value: 'Rx history consent denied by the patient' },
  ],
  sexualOrientationOptions: [
    { label: 'Straight', value: 'Straight' },
    { label: 'Lesbian or Gay', value: 'Lesbian or Gay' },
    { label: 'Bisexual', value: 'Bisexual' },
    { label: 'Something else', value: 'Something else' },
    { label: 'Decline to Specify', value: 'Decline to Specify' },
  ],
  stateOptions: [
    { label: 'AL', value: 'AL' },
    { label: 'AK', value: 'AK' },
    { label: 'AZ', value: 'AZ' },
    { label: 'AR', value: 'AR' },
    { label: 'CA', value: 'CA' },
    { label: 'CO', value: 'CO' },
    { label: 'CT', value: 'CT' },
    { label: 'DE', value: 'DE' },
    { label: 'DC', value: 'DC' },
    { label: 'FL', value: 'FL' },
    { label: 'GA', value: 'GA' },
    { label: 'HI', value: 'HI' },
    { label: 'ID', value: 'ID' },
    { label: 'IL', value: 'IL' },
    { label: 'IN', value: 'IN' },
    { label: 'IA', value: 'IA' },
    { label: 'KS', value: 'KS' },
    { label: 'KY', value: 'KY' },
    { label: 'LA', value: 'LA' },
    { label: 'ME', value: 'ME' },
    { label: 'MD', value: 'MD' },
    { label: 'MA', value: 'MA' },
    { label: 'MI', value: 'MI' },
    { label: 'MN', value: 'MN' },
    { label: 'MS', value: 'MS' },
    { label: 'MO', value: 'MO' },
    { label: 'MT', value: 'MT' },
    { label: 'NE', value: 'NE' },
    { label: 'NV', value: 'NV' },
    { label: 'NH', value: 'NH' },
    { label: 'NJ', value: 'NJ' },
    { label: 'NM', value: 'NM' },
    { label: 'NY', value: 'NY' },
    { label: 'NC', value: 'NC' },
    { label: 'ND', value: 'ND' },
    { label: 'OH', value: 'OH' },
    { label: 'OK', value: 'OK' },
    { label: 'OR', value: 'OR' },
    { label: 'PA', value: 'PA' },
    { label: 'RI', value: 'RI' },
    { label: 'SC', value: 'SC' },
    { label: 'SD', value: 'SD' },
    { label: 'TN', value: 'TN' },
    { label: 'TX', value: 'TX' },
    { label: 'UT', value: 'UT' },
    { label: 'VT', value: 'VT' },
    { label: 'VA', value: 'VA' },
    { label: 'VI', value: 'VI' },
    { label: 'WA', value: 'WA' },
    { label: 'WV', value: 'WV' },
    { label: 'WI', value: 'WI' },
    { label: 'WY', value: 'WY' },
  ],
  patientPaymentPageOptions: [
    { label: 'I have insurance', value: 'I have insurance' },
    { label: 'I will pay without insurance', value: 'I will pay without insurance' },
  ],
  patientOccMedPaymentPageOptions: [
    { label: 'Self', value: 'Self' },
    { label: 'Employer', value: 'Employer' },
  ],
};

export const VALUE_SETS = mergeAndFreezeConfigObjects(formValueSets, OVERRIDES);
