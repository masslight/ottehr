import AddIcon from '@mui/icons-material/Add';
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
import { Stack } from '@mui/system';
import { Practitioner } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { ERX_MEDICATION_META_TAG_CODE, formatDateToMDYWithTime, RoleType } from 'utils';
import { RoundedButton } from '../../../../components/RoundedButton';
import { useChartData } from '../../../../features/css-module/hooks/useChartData';
import { useApiClients } from '../../../../hooks/useAppClients';
import useEvolveUser from '../../../../hooks/useEvolveUser';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { PageTitle } from '../../../components/PageTitle';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { useAppointmentStore } from '../../../state';
import { getAppointmentStatusChip } from '../../../utils';
import { ERX, ERXStatus } from '../ERX';

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

interface ERxContainerProps {
  showHeader?: boolean;
}

export const ERxContainer: FC<ERxContainerProps> = ({ showHeader = true }) => {
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
        _tag: ERX_MEDICATION_META_TAG_CODE,
      },
    },
    refetchInterval: 10000,
    onSuccess: (data) => {
      console.log('data', data);
      const prescribedMedications = data.prescribedMedications;

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
  const [erxStatus, setERXStatus] = useState(ERXStatus.LOADING);
  const [openTooltip, setOpenTooltip] = useState(false);
  const [cancellationLoading, setCancellationLoading] = useState<string[]>([]);
  const { oystehr } = useApiClients();
  const user = useEvolveUser();

  const cancelPrescription = async (prescriptionId: string): Promise<void> => {
    if (!oystehr) {
      enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
      return;
    }
    setCancellationLoading((prevState) => [...prevState, prescriptionId]);
    await oystehr.erxV1.cancelPrescription({ prescriptionId });
    await refetch();
    setCancellationLoading((prevState) => prevState.filter((item) => item !== prescriptionId));
  };

  const handleCloseTooltip = (): void => {
    setOpenTooltip(false);
  };

  const handleOpenTooltip = (): void => {
    setOpenTooltip(true);
  };

  // const handleSetup = (): void => {
  //   window.open('https://docs.oystehr.com/ottehr/setup/prescriptions/', '_blank');
  // };

  const onNewOrderClick = async (): Promise<void> => {
    // await oystehr?.erx.unenrollPractitioner({ practitionerId: user!.profileResource!.id! });
    setIsERXOpen(true);
  };

  return (
    <>
      <Stack gap={1}>
        <Stack direction="row" justifyContent="space-between">
          <Stack direction="row" gap={1} alignItems="center">
            {showHeader && <PageTitle label="eRX" showIntakeNotesButton={false} />}
            {(isLoading || isFetching || cancellationLoading.length > 0) && <CircularProgress size={16} />}
          </Stack>
          <Tooltip
            placement="top"
            title="You don't have the necessary role to access ERX. Please contact your administrator."
            open={openTooltip && !isReadOnly && !user?.hasRole([RoleType.Provider])}
            onClose={handleCloseTooltip}
            onOpen={handleOpenTooltip}
          >
            <Stack>
              {isERXOpen && erxStatus !== ERXStatus.LOADING ? (
                <RoundedButton
                  disabled={isReadOnly || !user?.hasRole([RoleType.Provider])}
                  variant="contained"
                  onClick={() => {
                    setIsERXOpen(false);
                  }}
                >
                  Close eRX
                </RoundedButton>
              ) : (
                <RoundedButton
                  disabled={isReadOnly || erxStatus === ERXStatus.LOADING || !user?.hasRole([RoleType.Provider])}
                  variant="contained"
                  onClick={() => onNewOrderClick()}
                  startIcon={erxStatus === ERXStatus.LOADING ? <CircularProgress size={16} /> : <AddIcon />}
                >
                  Open eRX
                </RoundedButton>
              )}
            </Stack>
          </Tooltip>
        </Stack>
        {/* {!erxEnvVariable && <CompleteConfiguration handleSetup={handleSetup} />} */}
        {isERXOpen && (
          <ERX
            onStatusChanged={(status) => {
              if (status === ERXStatus.ERROR) {
                setIsERXOpen(false);
              }
              setERXStatus(status);
            }}
            showDefaultAlert={true}
          />
        )}
        <div id="prescribe-dialog" style={{ flex: '1 0 auto', display: 'flex' }} />

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
    </>
  );
};
