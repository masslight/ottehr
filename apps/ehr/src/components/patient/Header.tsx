import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, useTheme } from '@mui/material';
import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PrintVisitLabelButton } from 'src/features/css-module/components/PrintVisitLabelButton';
import { showEnvironmentBanner } from '../../App';
import { BANNER_HEIGHT } from '../../helpers/misc.helper';
import { useGetPatient } from '../../hooks/useGetPatient';
import { Contacts, FullNameDisplay, IdentifiersRow, PatientAvatar, Summary } from './info';

type HeaderProps = {
  handleDiscard: () => void;
  id?: string;
};

export const Header: FC<HeaderProps> = ({ handleDiscard, id }) => {
  const theme = useTheme();

  const { loading, patient, appointments } = useGetPatient(id);

  // todo: product has said that on screens with no specific encounter, use the latest encounter for the label
  // which seems ok for now but might change later
  const latestAppointmentEncounter = appointments?.[0].encounter;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: showEnvironmentBanner ? BANNER_HEIGHT : 0,
        zIndex: 1000,
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        backgroundColor: theme.palette.background.paper,
        padding: theme.spacing(1, 3),
        borderBottom: `1px solid ${theme.palette.divider}`,
        boxShadow: '0px 2px 4px -1px rgba(0, 0, 0, 0.2)',
      }}
    >
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <IdentifiersRow id={id} loading={false} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: '64px 0 0' }}>
            <PatientAvatar id={id} sx={{ width: 64, height: 64 }} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', rowGap: 0.5, columnGap: 2, flexWrap: 'wrap' }}>
              <FullNameDisplay patient={patient} loading={loading} variant="h5" />
              <PrintVisitLabelButton encounterId={latestAppointmentEncounter?.id} />
              <Summary patient={patient} loading={loading} />
            </Box>
            <Contacts patient={patient} loading={loading} />
          </Box>
        </Box>
      </Box>
      <Box>
        <IconButton onClick={handleDiscard} aria-label="Close" data-testid={dataTestIds.patientHeader.closeButton}>
          <CloseIcon />
        </IconButton>
      </Box>
    </Box>
  );
};
