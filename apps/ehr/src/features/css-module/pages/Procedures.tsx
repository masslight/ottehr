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

export default function Procedures(): ReactElement {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const { chartData } = getSelectors(useAppointmentStore, ['chartData']);

  const onNewProcedureClick = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES_NEW}`);
  };
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
              return (
                <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                  <TableCell>
                    <Stack>
                      {procedure.cptCodes.map((cptCode) => {
                        return (
                          <Typography sx={{ fontSize: '14px' }}>
                            {cptCode.code}-{cptCode.display}
                          </Typography>
                        );
                      })}
                      <Typography sx={{ fontSize: '14px', color: '#00000099' }}>{procedure.procedureType}</Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack>
                      {procedure.diagnoses.map((diagnosis) => {
                        return (
                          <Typography sx={{ fontSize: '14px' }}>
                            {diagnosis.code}-{diagnosis.display}
                          </Typography>
                        );
                      })}
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack>
                      <Typography sx={{ fontSize: '14px' }}>{procedure.procedureDateTime}</Typography>
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
