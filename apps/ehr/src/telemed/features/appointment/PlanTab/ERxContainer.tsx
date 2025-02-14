import { Stack } from '@mui/system';
import { FC, useCallback, useState } from 'react';
import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import { RoundedButton } from '../../../../components/RoundedButton';
import { getSelectors } from '../../../../shared/store/getSelectors';
import { useAppointmentStore } from '../../../state';
import { useGetAppointmentAccessibility } from '../../../hooks';
import { ERX } from '../ERX';
import { useChartData } from '../../../../features/css-module/hooks/useChartData';
import { Practitioner } from 'fhir/r4b';

const getPractitionerName = (practitioner?: Practitioner): string => {
  const givenName = practitioner?.name?.[0]?.given?.at(0) ?? '';
  const familyName = practitioner?.name?.[0]?.family ?? '';
  return `${familyName}, ${givenName}`.trim();
};

export const ERxContainer: FC = () => {
  const { encounter } = getSelectors(useAppointmentStore, ['encounter']);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const { chartData } = useChartData({
    encounterId: encounter.id || '',
    requestedFields: {
      prescribedMedications: {
        _include: 'MedicationRequest:requester',
      },
    },
    onSuccess: (data) => {
      console.log(data);
    },
  });

  const [isERXOpen, setIsERXOpen] = useState(false);
  const [isERXLoading, setIsERXLoading] = useState(false);

  const handleERXLoadingStatusChange = useCallback<(status: boolean) => void>(
    (status) => setIsERXLoading(status),
    [setIsERXLoading]
  );

  return (
    <>
      <Stack gap={1}>
        <Stack direction="row" justifyContent="space-between">
          <Typography variant="h6" color="primary.dark">
            eRX
          </Typography>
          <RoundedButton
            disabled={isReadOnly || isERXLoading}
            variant="contained"
            onClick={() => setIsERXOpen(true)}
            startIcon={<AddIcon />}
          >
            New Order
          </RoundedButton>
        </Stack>

        {chartData?.prescribedMedications && chartData.prescribedMedications.length > 0 && (
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell>Medication</TableCell>
                  <TableCell>Patient instructions (SIG)</TableCell>
                  {/*<TableCell>Dx</TableCell>*/}
                  <TableCell>Visit</TableCell>
                  <TableCell>Provider</TableCell>
                  <TableCell>Order added</TableCell>
                  {/*<TableCell>Pharmacy</TableCell>*/}
                  <TableCell>Status</TableCell>
                  <TableCell>Action</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {chartData.prescribedMedications.map((row) => (
                  <TableRow key={row.resourceId}>
                    <TableCell>{row.name}</TableCell>
                    <TableCell>{row.instructions}</TableCell>
                    {/*<TableCell>Dx</TableCell>*/}
                    <TableCell>Visit</TableCell>
                    <TableCell>
                      {getPractitionerName(
                        chartData.practitioners?.find((practitioner) => practitioner.id === row.provider)
                      )}
                    </TableCell>
                    <TableCell>{row.added}</TableCell>
                    {/*<TableCell>Pharmacy</TableCell>*/}
                    <TableCell>{row.status}</TableCell>
                    <TableCell>
                      <RoundedButton>Cancel</RoundedButton>
                    </TableCell>
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
