import { TableCell, TableRow, Typography } from '@mui/material';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { dataTestIds } from 'src/constants/data-test-ids';
import { MedicationWithTypeDTO } from 'src/features/visits/in-person/hooks/useMedicationHistory';
import { getProviderNameWithProfession, MedicationDTO } from 'utils';

interface MedicationHistoryEntityProps {
  item: MedicationDTO | MedicationWithTypeDTO;
}

export const MedicationHistoryEntity: React.FC<MedicationHistoryEntityProps> = ({ item }) => {
  const practitioner = 'resourceType' in (item.practitioner || {}) ? (item.practitioner as Practitioner) : undefined;
  const date = item.intakeInfo.date ? DateTime.fromISO(item.intakeInfo.date).toFormat('MM/dd/yyyy hh:mm a') : undefined;

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

  return (
    <TableRow data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableRow}>
      <TableCell>
        <Typography
          variant="body2"
          sx={{ fontWeight: 500 }}
          data-testid={dataTestIds.inHouseMedicationsPage.medicationHistoryTableMedication}
        >
          {item.name} ({item.intakeInfo.dose})
        </Typography>
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
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
          {date || 'No date available'}
        </Typography>
      </TableCell>
    </TableRow>
  );
};
