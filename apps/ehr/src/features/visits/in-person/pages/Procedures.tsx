import { otherColors } from '@ehrTheme/colors';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { IconButton, Paper, Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { Box, Stack } from '@mui/system';
import { DateTime } from 'luxon';
import { enqueueSnackbar } from 'notistack';
import { ReactElement, useCallback, useMemo } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { RoundedButton } from 'src/components/RoundedButton';
import { dataTestIds } from 'src/constants/data-test-ids';
import AiSuggestion from 'src/features/visits/in-person/components/AiSuggestion';
import { AiObservationField, CPTCodeDTO, ObservationTextFieldDTO, TelemedAppointmentStatusEnum } from 'utils';
import { Loader } from '../../shared/components/Loader';
import { PageTitle } from '../../shared/components/PageTitle';
import { useGetAppointmentAccessibility } from '../../shared/hooks/useGetAppointmentAccessibility';
import { useChartData, useDeleteChartData } from '../../shared/stores/appointment/appointment.store';
import { useAppFlags } from '../../shared/stores/contexts/useAppFlags';
import { useDeleteProcedureDialog } from '../components/DeleteProcedureDialog';
import { ROUTER_PATH } from '../routing/routesInPerson';

export default function Procedures(): ReactElement {
  const navigate = useNavigate();
  const { id: appointmentId } = useParams();
  const { isChartDataLoading, chartData, refetch: refetchChartData } = useChartData();
  const appointmentAccessibility = useGetAppointmentAccessibility();
  const { isInPerson } = useAppFlags();
  const { mutateAsync: deleteChartData } = useDeleteChartData();
  const aiProcedures = chartData?.observations?.filter(
    (observation) => observation.field === AiObservationField.Procedures
  ) as ObservationTextFieldDTO[];

  const isReadOnly = useMemo(() => {
    if (isInPerson) {
      return appointmentAccessibility.isAppointmentReadOnly;
    }
    return appointmentAccessibility.status === TelemedAppointmentStatusEnum.complete;
  }, [isInPerson, appointmentAccessibility.status, appointmentAccessibility.isAppointmentReadOnly]);

  const onNewProcedureClick = (): void => {
    navigate(`/in-person/${appointmentId}/${ROUTER_PATH.PROCEDURES_NEW}`);
  };
  const onProcedureClick = (procedureId: string | undefined): void => {
    navigate(`/in-person/${appointmentId}/procedures/${procedureId}`);
  };

  const handleDeleteProcedure = useCallback(
    async ({ procedureId }: { procedureId: string; procedureName: string }): Promise<boolean> => {
      const procedureToDelete = chartData?.procedures?.find((p) => p.resourceId === procedureId);
      if (!procedureToDelete) {
        console.error('Procedure not found');
        return false;
      }

      try {
        await deleteChartData(
          {
            procedures: [procedureToDelete],
          },
          {
            onSuccess: async () => {
              await refetchChartData();
              enqueueSnackbar('Procedure deleted successfully', { variant: 'success' });
            },
            onError: () => {
              enqueueSnackbar('Failed to delete procedure. Please try again.', { variant: 'error' });
            },
          }
        );
        return true;
      } catch {
        enqueueSnackbar('Failed to delete procedure. Please try again.', { variant: 'error' });
        return false;
      }
    },
    [chartData?.procedures, deleteChartData, refetchChartData]
  );

  const { showDeleteProcedureDialog, DeleteProcedureDialog } = useDeleteProcedureDialog({
    deleteProcedure: handleDeleteProcedure,
  });

  const activeProcedures = useMemo(() => chartData?.procedures ?? [], [chartData?.procedures]);

  if (isChartDataLoading) return <Loader />;
  return (
    <Box>
      <Box display="flex" justifyContent="space-between" alignItems="center" mb={2}>
        <PageTitle label="Procedures" showIntakeNotesButton={false} dataTestId={dataTestIds.proceduresPage.title} />
        <RoundedButton variant="contained" onClick={onNewProcedureClick} startIcon={<AddIcon />} disabled={isReadOnly}>
          Procedure
        </RoundedButton>
      </Box>
      {aiProcedures?.length > 0 && (
        <Paper sx={{ padding: 2, marginBottom: 2 }}>
          <AiSuggestion title={'Procedures'} chartData={chartData} content={aiProcedures} />
        </Paper>
      )}
      <AccordionCard>
        <Table sx={{ width: '100%' }}>
          <TableHead>
            <TableRow>
              <TableCell sx={{ width: '50%' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Procedure</Typography>
              </TableCell>
              <TableCell sx={{ width: '25%' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Dx</Typography>
              </TableCell>
              <TableCell sx={{ width: '20%' }}>
                <Typography sx={{ fontSize: '14px', fontWeight: '500' }}>Documented by</Typography>
              </TableCell>
              <TableCell sx={{ width: '5%' }} />
            </TableRow>
          </TableHead>
          <TableBody>
            {activeProcedures.map((procedure) => {
              const documentedDateTime =
                procedure.documentedDateTime != null ? DateTime.fromISO(procedure.documentedDateTime) : undefined;
              return (
                <TableRow
                  sx={{ '&:last-child td': { borderBottom: 0 }, cursor: 'pointer' }}
                  onClick={() => onProcedureClick(procedure.resourceId)}
                  key={procedure.resourceId}
                  data-testid={dataTestIds.proceduresPage.procedureRow}
                >
                  <TableCell>
                    <Stack>
                      {procedure.cptCodes?.map((cptCode) => {
                        return (
                          <Typography
                            sx={{ fontSize: '14px' }}
                            key={cptCode.code}
                            data-testid={dataTestIds.proceduresPage.cptCode}
                          >
                            {cptCode.code}-{cptCode.display}
                          </Typography>
                        );
                      })}
                      <Typography
                        sx={{ fontSize: '14px', color: '#00000099' }}
                        data-testid={dataTestIds.proceduresPage.procedureType}
                      >
                        {procedure.procedureType}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    <Stack>
                      {procedure.diagnoses?.map((diagnosis) => {
                        return (
                          <Typography
                            sx={{ fontSize: '14px' }}
                            key={diagnosis.code}
                            data-testid={dataTestIds.proceduresPage.diagnosis}
                          >
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
                      <Typography
                        sx={{ fontSize: '14px', color: '#00000099' }}
                        data-testid={dataTestIds.proceduresPage.documentedBy}
                      >
                        {procedure.documentedBy}
                      </Typography>
                    </Stack>
                  </TableCell>
                  <TableCell>
                    {!isReadOnly && (
                      <IconButton
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!procedure.resourceId) return;
                          const procedureName =
                            procedure.cptCodes?.map((c: CPTCodeDTO) => `${c.code}-${c.display}`).join(', ') ||
                            procedure.procedureType ||
                            '';
                          showDeleteProcedureDialog({
                            procedureId: procedure.resourceId,
                            procedureName,
                          });
                        }}
                        sx={{
                          color: otherColors.priorityHighText,
                          '&:hover': { backgroundColor: 'rgba(211, 47, 47, 0.04)' },
                        }}
                      >
                        <DeleteIcon />
                      </IconButton>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
            {activeProcedures.length === 0 ? (
              <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                <TableCell colSpan={4} align="center">
                  <Typography sx={{ fontSize: '14px', color: '#00000099' }}>No procedures</Typography>
                </TableCell>
              </TableRow>
            ) : undefined}
          </TableBody>
        </Table>
      </AccordionCard>
      {DeleteProcedureDialog}
    </Box>
  );
}
