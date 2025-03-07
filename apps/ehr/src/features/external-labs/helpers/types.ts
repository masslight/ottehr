import { ExternalLabsStatus, LabOrderDTO } from 'utils';

export const MockDiagnosis = {
  code: 'J20.9',
  display: 'Acute bronchitis, unspecified',
  isPrimary: true,
};

export const MockDiagnosis2 = {
  code: 'R05',
  display: 'Cough',
  isPrimary: false,
};

export const MockDiagnosis3 = {
  code: 'J06.9',
  display: 'Acute upper respiratory infection, unspecified',
  isPrimary: false,
};

export const MockDiagnosis4 = {
  code: 'Z20.822',
  display: 'Contact with COVID-19',
  isPrimary: false,
};

export const mockLabOrders: LabOrderDTO[] = [
  {
    id: '1',
    type: 'Complete Blood Count (CBC)',
    location: 'LabCorp',
    orderAdded: '2024-10-27T10:39:00',
    provider: 'Dr. Smith',
    diagnoses: [MockDiagnosis],
    status: ExternalLabsStatus.pending,
    isPSC: true,
    reflexTestsCount: 0,
  },
  {
    id: '2',
    type: 'Comprehensive Metabolic Panel',
    location: 'Quest Diagnostics',
    orderAdded: '2024-10-28T10:24:00',
    provider: 'Dr. Johnson',
    diagnoses: [MockDiagnosis, MockDiagnosis2],
    status: ExternalLabsStatus.sent,
    isPSC: true,
    reflexTestsCount: 1,
  },
  {
    id: '3',
    type: 'COVID-19 PCR Test',
    location: 'BioReference',
    orderAdded: '2024-10-28T11:05:00',
    provider: 'Dr. Williams',
    diagnoses: [MockDiagnosis4],
    status: ExternalLabsStatus.pending,
    isPSC: true,
    reflexTestsCount: 0,
  },
  {
    id: '4',
    type: 'Lipid Panel',
    location: 'LabCorp',
    orderAdded: '2024-10-29T02:28:00',
    provider: 'Dr. Brown',
    diagnoses: [MockDiagnosis, MockDiagnosis2, MockDiagnosis3],
    status: ExternalLabsStatus.received,
    isPSC: true,
    reflexTestsCount: 2,
  },
  {
    id: '5',
    type: 'Thyroid Panel',
    location: 'Quest Diagnostics',
    orderAdded: '2024-10-29T11:11:00',
    provider: 'Dr. Miller',
    diagnoses: [MockDiagnosis3],
    status: ExternalLabsStatus.received,
    isPSC: true,
    reflexTestsCount: 0,
  },
  {
    id: '6',
    type: 'Vitamin D, 25-Hydroxy',
    location: 'LabCorp',
    orderAdded: '2024-10-30T19:56:00',
    provider: 'Dr. Davis',
    diagnoses: [MockDiagnosis, MockDiagnosis2],
    status: ExternalLabsStatus.reviewed,
    isPSC: true,
    reflexTestsCount: 0,
  },
  {
    id: '7',
    type: 'Basic Metabolic Panel',
    location: 'BioReference',
    orderAdded: '2024-10-25T08:30:00',
    provider: 'Dr. Wilson',
    diagnoses: [MockDiagnosis3, MockDiagnosis4],
    status: ExternalLabsStatus.reviewed,
    isPSC: true,
    reflexTestsCount: 3,
  },
  {
    id: '8',
    type: 'Hemoglobin A1C',
    location: 'Quest Diagnostics',
    orderAdded: '2024-10-26T14:15:00',
    provider: 'Dr. Anderson',
    diagnoses: [MockDiagnosis4],
    status: ExternalLabsStatus.sent,
    isPSC: true,
    reflexTestsCount: 0,
  },
];
