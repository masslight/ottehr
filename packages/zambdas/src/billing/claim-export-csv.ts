import {
  BillingClaimItem,
  CLAIM_STATUS_FIELDS,
  formatAntCaseString,
  formatClaimStatusValue,
  roundNumberToDecimalPlaces,
} from 'utils';

interface ClaimExportColumn {
  header: string;
  value: (claim: BillingClaimItem) => string;
}

const money = (amount: number): string => roundNumberToDecimalPlaces(amount, 2).toFixed(2);

export const CLAIM_EXPORT_COLUMNS: ClaimExportColumn[] = [
  {
    header: 'Claim ID',
    value: (claim) => claim.id,
  },
  {
    header: 'Patient Name',
    value: (claim) => claim.patientName,
  },
  {
    header: 'Patient DOB',
    value: (claim) => claim.patientDob,
  },
  {
    header: 'Service Date',
    value: (claim) => claim.serviceDate,
  },
  {
    header: 'Payer Name',
    value: (claim) => claim.payerName,
  },
  {
    header: 'Payer ID',
    value: (claim) => claim.payerId,
  },
  {
    header: 'Member ID',
    value: (claim) => claim.memberId,
  },
  ...CLAIM_STATUS_FIELDS.map((field) => ({
    header: field.label,
    value: (claim: BillingClaimItem) => formatClaimStatusValue(field, claim.statuses?.[field.key]),
  })),
  {
    header: 'Claim Type',
    value: (claim) => formatAntCaseString(claim.type),
  },
  {
    header: 'Service',
    value: (claim) => formatAntCaseString(claim.service),
  },
  {
    header: 'Billed',
    value: (claim) => money(claim.billed),
  },
  {
    header: 'Allowed',
    value: (claim) => money(claim.allowed),
  },
  {
    header: 'Insurance Paid',
    value: (claim) => money(claim.insurancePaid),
  },
  {
    header: 'Patient Resp',
    value: (claim) => money(claim.patientResp),
  },
  {
    header: 'Patient Paid',
    value: (claim) => money(claim.patientPaid),
  },
  {
    header: 'Claim Balance',
    value: (claim) => money(claim.claimBalance),
  },
  {
    header: 'Adjudicated',
    value: (claim) => (claim.adjudicated ? 'Yes' : 'No'),
  },
  {
    header: 'Facility',
    value: (claim) => claim.facility,
  },
  {
    header: 'Provider',
    value: (claim) => claim.renderingProvider,
  },
  {
    header: 'Responsible Party',
    value: (claim) => claim.responsibleParty,
  },
  {
    header: 'Tags',
    value: (claim) => (claim.tags ?? []).join('; '),
  },
];

export const CLAIM_EXPORT_HEADERS = CLAIM_EXPORT_COLUMNS.map((column) => column.header);

export const claimExportRow = (claim: BillingClaimItem): string[] =>
  CLAIM_EXPORT_COLUMNS.map((column) => column.value(claim));
