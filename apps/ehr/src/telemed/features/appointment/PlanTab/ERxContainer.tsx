import { Stack } from '@mui/system';
import { FC, useCallback, useEffect, useState } from 'react';
import {
  CircularProgress,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { RoundedButton } from '../../../../components/RoundedButton';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { ERX } from '../ERX';
import { useChartData } from '../../../../features/css-module/hooks/useChartData';
import { Practitioner } from 'fhir/r4b';
import { formatDateToMDYWithTime } from 'utils';
import { getAppointmentStatusChip } from '../../../utils';
import { useApiClients } from '../../../../hooks/useAppClients';
import { enqueueSnackbar } from 'notistack';
import useEvolveUser from '../../../../hooks/useEvolveUser';

const getPractitionerName = (practitioner?: Practitioner): string | undefined => {
  if (!practitioner) {
    return;
  }
  const givenName = practitioner?.name?.[0]?.given?.at(0) ?? '';
  const familyName = practitioner?.name?.[0]?.family ?? '';
  return `${familyName}, ${givenName}`.trim();
};

const medicationStatusMapper = {
  loading: {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  active: {
    background: {
      primary: '#B3E5FC',
    },
    color: {
      primary: '#01579B',
    },
  },
  'on-hold': {
    background: {
      primary: '#D1C4E9',
    },
    color: {
      primary: '#311B92',
    },
  },
  cancelled: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#616161',
    },
  },
  completed: {
    background: {
      primary: '#C8E6C9',
    },
    color: {
      primary: '#1B5E20',
    },
  },
  'entered-in-error': {
    background: {
      primary: '#FFE0B2',
    },
    color: {
      primary: '#E65100',
    },
  },
  stopped: {
    background: {
      primary: '#FFCCBC',
    },
    color: {
      primary: '#BF360C',
    },
  },
  draft: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#616161',
    },
  },
  unknown: {
    background: {
      primary: '#FFFFFF',
    },
    color: {
      primary: '#616161',
    },
  },
};

export const ERxContainer: FC = () => {
  const { encounter, appointment, setPartialChartData, chartData } = getSelectors(useAppointmentStore, [
    'encounter',
    'appointment',
    'setPartialChartData',
    'chartData',
  ]);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { isLoading, isFetching, refetch } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: {
      prescribedMedications: {
        _include: 'MedicationRequest:requester',
      },
    },
    onSuccess: (data) => {
      const prescribedMedications = (data.prescribedMedications || []).reduce(
        (prev, curr) => {
          const index = prev.findIndex((medication) => medication.prescriptionId === curr.prescriptionId);
          if (index === -1) {
            prev.push(curr);
          } else {
            prev[index] = curr;
          }
          return prev;
        },
        chartData?.prescribedMedications || []
      );

      if (prescribedMedications.filter((med) => !med.resourceId).length > 0) {
        setTimeout(refetch, 1000);
      }

      setPartialChartData({
        prescribedMedications,
        practitioners: (data.practitioners || []).reduce(
          (prev, curr) => {
            const index = prev.findIndex((practitioner) => practitioner.id === curr.id);
            if (index === -1) {
              prev.push(curr);
            } else {
              prev[index] = curr;
            }
            return prev;
          },
          chartData?.practitioners || []
        ),
      });
    },
  });

  const [isERXOpen, setIsERXOpen] = useState(false);
  const [isERXLoading, setIsERXLoading] = useState(false);
  const [openTooltip, setOpenTooltip] = useState(false);
  const [cancellationLoading, setCancellationLoading] = useState<string[]>([]);
  const { oystehr } = useApiClients();
  const user = useEvolveUser();

  const handleERXLoadingStatusChange = useCallback<(status: boolean) => void>(
    (status) => setIsERXLoading(status),
    [setIsERXLoading]
  );

  const cancelPrescription = async (prescriptionId: string): Promise<void> => {
    if (!oystehr) {
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
      return;
    }
    setCancellationLoading((prevState) => [...prevState, prescriptionId]);
    await oystehr.erx.cancelPrescription({ prescriptionId });
    await refetch();
    setCancellationLoading((prevState) => prevState.filter((item) => item !== prescriptionId));
  };

  useEffect(() => {
    const photonListener = (): void => {
      void refetch();
    };
    document.addEventListener('photon-prescriptions-created', photonListener);

    return () => {
      document.removeEventListener('photon-prescriptions-created', photonListener);
    };
  }, [refetch]);

  const handleCloseTooltip = (): void => {
    setOpenTooltip(false);
  };

  const handleOpenTooltip = (): void => {
    setOpenTooltip(true);
  };

  return (
    <>
      <Stack gap={1}>
        <Stack direction="row" justifyContent="space-between">
          <Stack direction="row" gap={1} alignItems="center">
            <Typography variant="h6" color="primary.dark">
              eRX
            </Typography>
            {(isLoading || isFetching || cancellationLoading.length > 0) && <CircularProgress size={16} />}
          </Stack>
          <Tooltip
            placement="top"
            title="You're not enrolled in erx. Please check that your provider profile has all the required info filled in: first name, last name, phone number, NPI"
            open={openTooltip && !isReadOnly && !user?.isPractitionerEnrolledInPhoton}
            onClose={handleCloseTooltip}
            onOpen={handleOpenTooltip}
          >
            <Stack>
              <RoundedButton
                disabled={isReadOnly || isERXLoading || !user?.isPractitionerEnrolledInPhoton}
                variant="contained"
                onClick={() => setIsERXOpen(true)}
                startIcon={<AddIcon />}
              >
                New Order
              </RoundedButton>
            </Stack>
          </Tooltip>
        </Stack>

        {chartData?.prescribedMedications && chartData.prescribedMedications.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead
                sx={{
                  '& .MuiTableCell-head': {
                    fontWeight: 700,
                  },
                }}
              >
                <TableRow>
                  <TableCell>Medication</TableCell>
                  <TableCell>Patient instructions (SIG)</TableCell>
                  {/*<TableCell>Dx</TableCell>*/}
                  <TableCell>Visit</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Order added</TableCell>
                  {/*<TableCell>Pharmacy</TableCell>*/}
                  <TableCell>Status</TableCell>
                  {!isReadOnly && <TableCell>Action</TableCell>}
                </TableRow>
              </TableHead>
              <TableBody>
                {chartData.prescribedMedications.map((row) => (
                  <TableRow key={row.resourceId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.instructions}</TableCell>
                    {/*<TableCell>Dx</TableCell>*/}
                    <TableCell>
                      {formatDateToMDYWithTime(appointment?.start)
                        ?.split(' at ')
                        ?.map((item) => (
                          <Typography variant="body2" key={item}>
                            {item}
                          </Typography>
                        ))}
                    </TableCell>
                    <TableCell>
                      {getPractitionerName(
                        chartData.practitioners?.find((practitioner) => practitioner.id === row.provider)
                      )}
                    </TableCell>
                    <TableCell>
                      {formatDateToMDYWithTime(row.added)
                        ?.split(' at ')
                        ?.map((item) => (
                          <Typography variant="body2" key={item}>
                            {item}
                          </Typography>
                        ))}
                    </TableCell>
                    {/*<TableCell>Pharmacy</TableCell>*/}
                    <TableCell>{getAppointmentStatusChip(row.status, medicationStatusMapper)}</TableCell>
                    {!isReadOnly && (
                      <TableCell>
                        <RoundedButton
                          variant="text"
                          color="error"
                          onClick={() => cancelPrescription(row.prescriptionId!)}
                          disabled={
                            !row.prescriptionId ||
                            row.status === 'loading' ||
                            cancellationLoading.includes(row.prescriptionId)
                          }
                        >
                          Cancel
                        </RoundedButton>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )}
      </Stack>

      {isERXOpen && <ERX onClose={() => setIsERXOpen(false)} onLoadingStatusChange={handleERXLoadingStatusChange} />}
    </>
  );
};
