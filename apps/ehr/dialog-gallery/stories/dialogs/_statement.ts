import type { StatementDetails } from 'utils/lib/statements/generate-statement';
// The same logo the zambda inlines as a base64 data URL (?inline makes Vite emit a data: URL).
import logoBase64 from '../../../../../packages/zambdas/assets/logo.png?inline';
// The real statement template the get-statement-template zambda serves.
import template from '../../../../../packages/zambdas/assets/statements/statement-template.html?raw';
import type { FetchMock } from '../../harness/story';

const statementDetails: StatementDetails = {
  pastDue: true,
  finalNotice: false,
  respParty: {
    firstName: 'Jordan',
    lastName: 'Rivera',
    addressLine1: '418 Maple Avenue',
    addressLine2: 'Apt 3B',
    city: 'Brooklyn',
    provinceOrState: 'NY',
    postalOrZip: '11201',
    countryCode: 'US',
  },
  statement: { number: 'ST-104582', issueDate: '11/13/2026', dueDate: '12/13/2026' },
  patient: { firstName: 'Jordan', lastName: 'Rivera', dob: '04/12/1988' },
  insurance: { payerName: 'Aetna', memberId: 'W123456789' },
  visit: { date: '10/28/2026', time: '10:30 AM' },
  facility: { name: 'Brooklyn Urgent Care' },
  biller: {
    name: 'Ottehr Urgent Care',
    addressLine1: '100 Court Street',
    city: 'Brooklyn',
    provinceOrState: 'NY',
    postalOrZip: '11201',
    countryCode: 'US',
    website: 'www.example.com',
    email: 'billing@example.com',
    logoBase64,
  },
  service: [
    {
      cpt: '99213',
      description: 'Office visit, established patient',
      charged: '$180.00',
      insurancePaid: '$95.00',
      patientPaid: '$0.00',
      writeOffs: '$0.00',
      patientOwes: '$85.00',
    },
    {
      cpt: '87880',
      description: 'Rapid strep test',
      charged: '$60.00',
      insurancePaid: '$20.00',
      patientPaid: '$0.00',
      writeOffs: '$0.00',
      patientOwes: '$40.00',
    },
  ],
  totals: {
    charged: '$240.00',
    insurancePaid: '$115.00',
    patientPaid: '$0.00',
    writeOffs: '$0.00',
    balanceDue: '$125.00',
    deductible: '$0.00',
  },
  payment: { url: 'https://example.com/pay' },
};

export const statementMocks: FetchMock[] = [
  {
    url: 'get-statement-template',
    response: { status: 200, output: { template, fileName: 'statement-template.html', logoBase64 } },
  },
  { url: 'get-statement-details', response: { status: 200, output: statementDetails } },
  {
    url: 'get-statement-status',
    response: { status: 200, output: { generated: { generated: false }, mailProcessor: { found: false } } },
  },
];
