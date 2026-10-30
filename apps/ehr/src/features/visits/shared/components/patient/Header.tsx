import CloseIcon from '@mui/icons-material/Close';
import { Box, IconButton, useTheme } from '@mui/material';
import { FC } from 'react';
import { showEnvironmentBanner } from 'src/App';
import { dataTestIds } from 'src/constants/data-test-ids';
import { PatientNotesButton } from 'src/features/patient-notes/components/PatientNotesButton';
import { PrintVisitLabelButton } from 'src/features/visits/in-person/components/PrintVisitLabelButton';
import { BANNER_HEIGHT, NAVBAR_HEIGHT_CSS_VAR } from 'src/helpers/misc.helper';
import { useGetPatient } from 'src/hooks/useGetPatient';
import { useGetPatientVisitHistory } from '../../../../../hooks/useGetPatientVisitHistory';
import { PatientAvatar } from './info/Avatar';
import { Contacts } from './info/Contacts';
import { FullNameDisplay } from './info/FullNameDisplay';
import { IdentifiersRow } from './info/IdentifiersRow';
import { Summary } from './info/Summary';

type HeaderProps = {
  handleDiscard: () => void;
  id?: string;
  /** The visit the page is about; without one the label is printed for the latest visit. */
  encounterId?: string;
};

export const Header: FC<HeaderProps> = ({ handleDiscard, id, encounterId }) => {
  const theme = useTheme();

  const { loading, patient } = useGetPatient(id);
  // Visit history is only needed to pick a label encounter when the page has none of its own.
  const { data: visitHistory } = useGetPatientVisitHistory(encounterId ? undefined : patient?.id);
  const appointments = visitHistory?.visits ?? [];

  // todo: product has said that on screens with no specific encounter, use the latest encounter for the label
  // which seems ok for now but might change later
  const latestAppointmentEncounterId = appointments?.[0]?.encounterId;

  return (
    <Box
      sx={{
        position: 'sticky',
        top: `calc(${showEnvironmentBanner ? BANNER_HEIGHT : 0}px + var(${NAVBAR_HEIGHT_CSS_VAR}, 0px))`,
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
        <IdentifiersRow patient={patient} loading={loading} />
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <Box sx={{ flex: '64px 0 0' }}>
            <PatientAvatar id={id} sx={{ width: 64, height: 64 }} />
          </Box>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
            <Box sx={{ display: 'flex', rowGap: 0.5, columnGap: 2, flexWrap: 'wrap' }}>
              <FullNameDisplay patient={patient} loading={loading} variant="h5" />
              <PatientNotesButton patientId={id} />
              <PrintVisitLabelButton encounterId={encounterId ?? latestAppointmentEncounterId} />
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
