import { Chip, Stack, TableCell, TableRow, Typography } from '@mui/material';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { MedicationWithTypeDTO } from 'src/features/visits/in-person/hooks/useMedicationHistory';
import { getProviderNameWithProfession } from 'utils/lib/fhir/helpers';
import { MedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';

const formatLastFilledDate = (value: string): string => {
  // eRx medication history returns date-only values (e.g. 2025-10-12); manual entry stores a full datetime
  const isDateOnly = /^\d{4}-\d{2}-\d{2}$/.test(value);
  return DateTime.fromISO(value).toFormat(isDateOnly ? 'MM/dd/yyyy' : 'MM/dd/yyyy hh:mm a');
};

interface MedicationHistoryEntityProps {
  item: MedicationDTO | MedicationWithTypeDTO;
}

export const MedicationHistoryEntity: React.FC<MedicationHistoryEntityProps> = ({ item }) => {
  const practitioner = 'resourceType' in (item.practitioner || {}) ? (item.practitioner as Practitioner) : undefined;
  const date = item.intakeInfo.date ? DateTime.fromISO(item.intakeInfo.date).toFormat('MM/dd/yyyy hh:mm a') : undefined;

  const lastFilledDate = item.intakeInfo.lastFilledDate
    ? formatLastFilledDate(item.intakeInfo.lastFilledDate)
    : undefined;
  const refills = item.intakeInfo.refills;

  const isMedicationWithType = 'chartDataField' in item;

  const getTypeLabel = ():
    | 'Scheduled medication'
    | 'As-needed medication'
    | 'In-house medication'
    | 'Prescribed medication'
    | '' => {
    if (isMedicationWithType) {
      if (item.chartDataField === 'inhouseMedications') {
        return 'In-house medication';
      } else if (item.chartDataField === 'medications') {
        if (item.type === 'scheduled') {
          return 'Scheduled medication';
        }
        if (item.type === 'as-needed') {
          return 'As-needed medication';
        }
        if (item.type === 'prescribed-medication') {
          return 'Prescribed medication';
        }
      }
    }
    return '';
  };

  const additionalInfo = [
    item.intakeInfo.dose,
    item.intakeInfo.patientCouldNotConfirmDosage ? 'Patient could not confirm dosage' : null,
  ]
    .filter(Boolean)
    .join(' · ');

  return (
    <TableRow data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableRow}>
      <TableCell>
        <Stack direction="row" alignItems="center" gap={1} flexWrap="wrap">
          <Typography
            variant="body2"
            sx={{ fontWeight: 500 }}
            data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableMedication}
          >
            {item.name} {additionalInfo ? `(${additionalInfo})` : ''}
          </Typography>
          {item.isRenewal && <Chip label="Refill" size="small" color="primary" variant="outlined" />}
        </Stack>
      </TableCell>
      <TableCell>
        <Typography variant="body2" data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableType}>
          {getTypeLabel()}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
          data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableWhoAdded}
        >
          {practitioner ? getProviderNameWithProfession(practitioner) : ''}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
          data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableLastFilled}
        >
          {lastFilledDate || (item.type === 'prescribed-medication' ? 'Not filled yet' : 'No date available')}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography
          variant="body2"
          sx={{ color: 'text.secondary' }}
          data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableRefills}
        >
          {refills ?? 'Unknown'}
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {date || 'No date available'}
        </Typography>
      </TableCell>
    </TableRow>
  );
};
