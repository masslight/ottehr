import { ReactElement } from 'react';
import { PageTitle } from 'src/telemed/components/PageTitle';
import { AccordionCard, useAppointmentStore } from 'src/telemed';
import { Box, Stack } from '@mui/system';
import { useNavigate, useParams } from 'react-router-dom';
import { RoundedButton } from 'src/components/RoundedButton';
import AddIcon from '@mui/icons-material/Add';
import { ROUTER_PATH } from '../routing/routesCSS';
import { getSelectors } from 'utils';
import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import { CSSLoader } from '../components/CSSLoader';

export default function Procedures(): ReactElement {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const { chartData, isChartDataLoading } = getSelectors(useAppointmentStore, ['chartData', 'isChartDataLoading']);

  const onNewProcedureClick = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES_NEW}`);
  };
  const onProcedureClick = (procedureId: string | undefined): void => {
    navigate(`/in-person/${appointmentId}/procedures/${procedureId}`);
  };
  if (isChartDataLoading) return <CSSLoader />;
  return (
    <>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Procedures" showIntakeNotesButton={false} />
        <RoundedButton variant="contained" onClick={onNewProcedureClick} startIcon={<AddIcon />}>
          Procedure
        </RoundedButton>
      </Box>
      <AccordionCard>
        <Table sx={{ width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '55%' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Procedure</Typography>
              </TableCell>
              <TableCell sx={{ width: '25%' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Dx</Typography>
              </TableCell>
              <TableCell sx={{ width: '20%' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Documented by</Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {chartData?.procedures?.map((procedure) => {
              const documentedDateTime =
                procedure.documentedDateTime != null ? DateTime.fromISO(procedure.documentedDateTime) : undefined;
              return (
                <TableRow
                  sx={{ '&:last-child td': { borderBottom: 0 }, cursor: 'pointer' }}
                  onClick={() => onProcedureClick(procedure.resourceId)}
                  key={procedure.resourceId}
                >
                  <TableCell>
                    <Stack>
                      {procedure.cptCodes?.map((cptCode) => {
                        return (
                          <Typography sx={{ fontSize: '14px' }} key={cptCode.code}>
                            {cptCode.code}-{cptCode.display}
                          </Typography>
                        );
                      })}
                      <Typography sx={{ fontSize: '14px', color: '#00000099' }}>{procedure.procedureType}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack>
                      {procedure.diagnoses?.map((diagnosis) => {
                        return (
                          <Typography sx={{ fontSize: '14px' }} key={diagnosis.code}>
                            {diagnosis.code}-{diagnosis.display}
                          </Typography>
                        );
                      })}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack>
                      <Typography sx={{ fontSize: '14px' }}>
                        {documentedDateTime != null ? documentedDateTime.toFormat('MM/dd/yyyy HH:mm a') : undefined}
                      </Typography>
                      <Typography sx={{ fontSize: '14px', color: '#00000099' }}>{procedure.documentedBy}</Typography>
                    </Stack>
                  </TableCell>
                </TableRow>
              );
            })}
            {chartData?.procedures == null || chartData?.procedures.length === 0 ? (
              <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell colSpan={3} align="center">
                  <Typography sx={{ fontSize: '14px', color: '#00000099' }}>No procedures</Typography>
                </TableCell>
              </TableRow>
            ) : undefined}
          </TableBody>
        </Table>
      </AccordionCard>
    </>
  );
}
