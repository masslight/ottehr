import { Typography } from '@mui/material';
import { styled } from '@mui/material/styles';
import { Practitioner } from 'fhir/r4b';
import { getProviderNameWithProfession, mdyStringFromISOString, MedicationDTO } from 'utils';

const StyledEntity = styled('div')({
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  paddingTop: '16px',
  paddingBottom: '16px',
});

interface MedicationHistoryEntityProps {
  item: MedicationDTO;
}

export const MedicationHistoryEntity: React.FC<MedicationHistoryEntityProps> = ({ item }) => {
  const practitioner = 'resourceType' in (item.practitioner || {}) ? (item.practitioner as Practitioner) : undefined;
  const date = item.intakeInfo.date ? mdyStringFromISOString(item.intakeInfo.date) : undefined;

  return (
    <StyledEntity>
      <Typography variant="body2" sx={{ fontWeight: 500 }}>
        {item.name} ({item.intakeInfo.dose})
      </Typography>
      <Typography variant="body2" sx={{ color: 'text.secondary' }}>
        {practitioner ? getProviderNameWithProfession(practitioner) : undefined} {date}
      </Typography>
    </StyledEntity>
  );
};
