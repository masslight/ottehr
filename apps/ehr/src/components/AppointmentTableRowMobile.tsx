import { otherColors } from '@ehrTheme/colors';
import { Box, capitalize, Grid, Modal, TableCell, TableRow, Typography } from '@mui/material';
import { CSSProperties, ReactElement, useState } from 'react';
import { Link } from 'react-router-dom';
import { InPersonAppointmentInformation } from 'utils';
import { MOBILE_MODAL_STYLE } from '../constants';
import { ApptTab } from './AppointmentTabs';
import { PatientDateOfBirth } from './PatientDateOfBirth';
import ReasonsForVisit from './ReasonForVisit';

interface AppointmentTableRowMobileProps {
  appointment: InPersonAppointmentInformation;
  patientName: string;
  start: string | undefined;
  tab: ApptTab;
  formattedPriorityHighIcon: ReactElement;
  statusTime: string;
  statusChip: ReactElement;
  isLongWaitingTime: boolean;
  patientDateOfBirth: string;
  statusTimeEl?: ReactElement;
  linkStyle: CSSProperties;
  timeToolTip: ReactElement;
}

export default function AppointmentTableRowMobile({
  appointment,
  patientName,
  start,
  tab,
  formattedPriorityHighIcon,
  statusChip,
  patientDateOfBirth,
  statusTimeEl,
  linkStyle,
  timeToolTip,
}: AppointmentTableRowMobileProps): ReactElement {
  const [timeModalOpen, setTimeModalOpen] = useState<boolean>(false);

  return (
    <TableRow
      sx={{
        '&:last-child td, &:last-child th': { border: 0 },
        '&:hover': {
          backgroundColor: otherColors.apptHover,
        },
        '& .MuiTableCell-root': { p: '8px' },
        position: 'relative',
      }}
    >
      <TableCell colSpan={9}>
        <Link to={`/visit/${appointment.id}`} style={linkStyle}>
          <Grid container spacing={1}>
            <Grid item xs={12} justifyContent="space-between">
              <Grid
                container
                justifyContent="space-between"
                alignItems="center"
                wrap="nowrap"
                sx={{ overflow: 'hidden' }}
              >
                <Box display="flex" gap={1} flex="1 1 auto" flexWrap="nowrap" marginRight={2}>
                  <Typography variant="body1" sx={{ textWrap: 'nowrap' }}>
                    {capitalize?.(
                      appointment.appointmentType === 'post-telemed'
                        ? 'Post Telemed'
                        : (appointment.appointmentType || '').toString()
                    )}
                  </Typography>
                  <Typography variant="body1" sx={{ textWrap: 'nowrap' }}>
                    <strong>{start}</strong>
                  </Typography>
                </Box>
                <Box
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                  }}
                >
                  <ReasonsForVisit
                    reasonsForVisit={appointment.reasonForVisit}
                    tab={tab}
                    formattedPriorityHighIcon={formattedPriorityHighIcon}
                    lineMax={1}
                    isMobile={true}
                  ></ReasonsForVisit>
                </Box>
              </Grid>
            </Grid>
            <Grid item xs={12} justifyContent="space-between">
              <Grid container justifyContent="space-between" alignItems="flex-start">
                <Grid item xs={11}>
                  <Box sx={{ marginBottom: 1, display: 'flex' }} gap={1}>
                    {statusChip}
                    {statusTimeEl && (
                      <Grid
                        sx={{ display: 'flex', alignItems: 'center' }}
                        gap={1}
                        onClick={(e) => {
                          console.log('i work');
                          e.preventDefault();
                          e.stopPropagation();
                          setTimeModalOpen(true);
                        }}
                      >
                        {statusTimeEl}
                      </Grid>
                    )}
                  </Box>
                  <Box sx={{ display: 'flex', alignItems: 'center' }} gap={1}>
                    <Typography variant="body1" sx={{ fontWeight: 500, wordBreak: 'break-word' }}>
                      {patientName}
                    </Typography>{' '}
                    <PatientDateOfBirth dateOfBirth={patientDateOfBirth} />
                  </Box>
                </Grid>
              </Grid>
            </Grid>
          </Grid>
        </Link>
        <Modal open={timeModalOpen} onClose={() => setTimeModalOpen(false)}>
          <Box sx={MOBILE_MODAL_STYLE}>{timeToolTip}</Box>
        </Modal>
      </TableCell>
    </TableRow>
  );
}
