import { TableCell, TableRow, Typography } from '@mui/material';
import { Practitioner } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { MedicationWithTypeDTO } from 'src/features/css-module/hooks/useMedicationHistory';
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
    <TableRow>
      <TableCell>
        <Typography variant="body2" sx={{ fontWeight: 500 }}>
          {item.name} ({item.intakeInfo.dose})
        </Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2">{getTypeLabel()}</Typography>
      </TableCell>
      <TableCell>
        <Typography variant="body2" sx={{ color: 'text.secondary' }}>
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
