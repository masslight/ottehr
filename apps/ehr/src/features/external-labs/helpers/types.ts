import { DateTime } from 'luxon';
import { MockLabOrderData } from '../components/ExternalLabsTableRow';

// will change when real data is used but wanted to input the right hex codes for now via ExternalLabsStatusPalette / ExternalLabsStatusChip
export enum ExternalLabsStatus {
  pending = 'pending', // Task 1 created
  sent = 'sent', // Task 1 completed, Task 2 not yet created
  received = 'received', // Task 2 created, results received from lab
  reviewed = 'reviewed', // Task 2 (bot completed?), results reviewed by provider
}

export const MockDiagnosis = {
  code: 'AB12',
  display: 'Diagnosis',
  isPrimary: true,
};

export const mockLabOrders: MockLabOrderData[] = [
  {
    type: 'Blood Test',
    location: 'Lab A',
    orderAdded: DateTime.fromISO('2024-10-27T10:39:00'),
    provider: 'Dr. Smith',
    diagnosis: MockDiagnosis,
    status: ExternalLabsStatus.pending,
  },
  {
    type: 'Blood Test',
    location: 'Lab B',
    orderAdded: DateTime.fromISO('2024-10-28T10:24:00'),
    provider: 'Dr. Smith',
    diagnosis: MockDiagnosis,
    status: ExternalLabsStatus.sent,
  },
  {
    type: 'Blood Test',
    location: 'Lab C',
    orderAdded: DateTime.fromISO('2024-10-28T11:05:00'),
    provider: 'Dr. Smith',
    diagnosis: MockDiagnosis,
    status: ExternalLabsStatus.pending,
  },
  {
    type: 'Blood Test',
    location: 'Lab D',
    orderAdded: DateTime.fromISO('2024-10-29T02:28:00'),
    provider: 'Dr. Smith',
    diagnosis: MockDiagnosis,
    status: ExternalLabsStatus.received,
  },
  {
    type: 'Blood Test',
    location: 'Lab E',
    orderAdded: DateTime.fromISO('2024-10-29T11:11:00'),
    provider: 'Dr. Smith',
    diagnosis: MockDiagnosis,
    status: ExternalLabsStatus.received,
  },
  {
    type: 'Blood Test',
    location: 'Lab F',
    orderAdded: DateTime.fromISO('2024-10-30T19:56:00'),
    provider: 'Dr. Smith',
    diagnosis: MockDiagnosis,
    status: ExternalLabsStatus.reviewed,
  },
];
