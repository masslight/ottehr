import { MedicalRecordDateRangeDialog } from 'src/features/medical-record-export/components/MedicalRecordDateRangeDialog';
import { defineStory } from '../../harness/story';

export default defineStory({
  title: 'Medical record fax — choose date range',
  source: 'apps/ehr/src/features/medical-record-export/components/MedicalRecordDateRangeDialog.tsx',
  base: 'AppDialog',
  kind: 'form',
  where: 'Patient record / visit details / progress note → "Medical Record" export button',
  notes: 'Rendered directly with props; record date span (earliest/latest) is mock data. "To" defaults to today.',
  render: () => (
    <MedicalRecordDateRangeDialog
      open
      confirmText="Send as Fax"
      recordDates={{ earliest: '2024-03-14T15:30:00.000Z', latest: '2026-10-02T18:05:00.000Z' }}
      loading={false}
      loadFailed={false}
      onClose={() => undefined}
      onConfirm={async () => undefined}
    />
  ),
});
