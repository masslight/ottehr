import React, { FC, useMemo, useState } from 'react';
import { Patient } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import {
  CircularProgress,
  Dialog,
  IconButton,
  InputAdornment,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SearchIcon from '@mui/icons-material/Search';
import { getFullName, standardizePhoneNumber } from 'utils';
import { RoundedButton } from '../RoundedButton';
import { ConfirmationDialog, DeleteIconButton } from '../../telemed';
import { formatDateUsingSlashes } from '../../helpers/formatDateTime';
import { useGetPatientById, useGetPatientsForMerge } from './queries';

type PatientsMergeSelectProps = {
  open: boolean;
  close: () => void;
  next: (patientIds: string[]) => void;
  patientIds?: string[];
};

export const PatientsMergeSelect: FC<PatientsMergeSelectProps> = (props) => {
  const { open, close, next, patientIds } = props;

  const { isFetching } = useGetPatientsForMerge({ patientIds }, (data) => {
    setPatients(data as unknown as Patient[]);
  });
  const getPatientById = useGetPatientById();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [value, setValue] = useState('');

  const patientRows = useMemo(
    () =>
      patients.map((patient) => {
        const fillingOutAs = patient?.extension?.find(
          (extension) => extension.url === 'https://fhir.zapehr.com/r4/StructureDefinitions/form-user'
        )?.valueString;
        const patientNumber = patient?.telecom?.find((obj) => obj.system === 'phone')?.value;
        const parentNumber = patient?.contact?.[0].telecom?.find((obj) => obj?.system === 'phone')?.value;
        const isPatientNumberPrimary = fillingOutAs === 'Patient (Self)';

        return {
          pid: patient.id!,
          name: getFullName(patient),
          dob: formatDateUsingSlashes(patient.birthDate),
          primaryNumber: standardizePhoneNumber(isPatientNumberPrimary ? patientNumber : parentNumber),
          secondaryNumber: standardizePhoneNumber(isPatientNumberPrimary ? parentNumber : patientNumber),
        };
      }),
    [patients]
  );

  const removePatient = (id: string): void => {
    setPatients((prevState) => prevState.filter((patient) => patient.id !== id));
  };

  const addPatient = async (id: string): Promise<void> => {
    const bundle = await getPatientById.mutateAsync(id);

    if (bundle.length === 1) {
      setPatients((prevState) => [...prevState, bundle[0] as unknown as Patient]);
      setValue('');
    } else {
      enqueueSnackbar('Patient not found. Please try again', { variant: 'error' });
    }
  };

  const disabled = isFetching || getPatientById.isLoading;

  return (
    <Dialog open={open} onClose={close} maxWidth="lg" fullWidth>
      <IconButton size="small" onClick={close} sx={{ position: 'absolute', right: 16, top: 16 }}>
        <CloseIcon fontSize="small" />
      </IconButton>

      <Stack spacing={2} sx={{ p: 3 }}>
        <Stack spacing={1}>
          <Typography variant="h4" color="primary.dark">
            Merge Patients
          </Typography>
          <Typography>
            Select duplicated patients profiles. On the next step you will select which information should carry over to
            the remaining patient record after merge.
          </Typography>
        </Stack>

        <TextField
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(event) => {
            if (event.key === 'Enter') {
              void addPatient(value);
            }
          }}
          disabled={disabled}
          size="small"
          label="PID"
          InputProps={{
            endAdornment: (
              <InputAdornment position="end">
                {getPatientById.isLoading ? <CircularProgress size={24} color="inherit" /> : <SearchIcon />}
              </InputAdornment>
            ),
          }}
        />

        <Table>
          <TableHead>
            <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold', textAlign: 'left' } }}>
              <TableCell>PID</TableCell>
              <TableCell>Name</TableCell>
              <TableCell>DOB</TableCell>
              <TableCell>Phone</TableCell>
              <TableCell />
            </TableRow>
          </TableHead>
          {isFetching ? (
            <TableRow>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell>
                <Skeleton />
              </TableCell>
              <TableCell />
            </TableRow>
          ) : (
            <TableBody>
              {patientRows.map((row) => (
                <TableRow key={row.pid}>
                  <TableCell>{row.pid}</TableCell>
                  <TableCell>{row.name}</TableCell>
                  <TableCell>{row.dob}</TableCell>
                  <TableCell>
                    {row.primaryNumber && <b>{row.primaryNumber}</b>}
                    {row.primaryNumber && row.secondaryNumber && ', '}
                    {row.secondaryNumber}
                  </TableCell>
                  <TableCell align="right">
                    <DeleteIconButton onClick={() => removePatient(row.pid)} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          )}
        </Table>

        <Stack direction="row" spacing={2} justifyContent="space-between">
          <RoundedButton onClick={close}>Cancel</RoundedButton>
          <Stack direction="row" spacing={2}>
            <ConfirmationDialog
              title="Not duplicates"
              description={
                <Stack spacing={2}>
                  <Typography>Confirm the patients as not duplicates and dismiss the alert.</Typography>
                  <Stack>
                    <Typography fontWeight={600}>PIDs:</Typography>
                    {patientRows.map(({ pid }) => (
                      <Typography key={pid}>{pid}</Typography>
                    ))}
                  </Stack>
                </Stack>
              }
              response={close}
              actionButtons={{
                proceed: {
                  color: 'error',
                  text: 'Dismiss Alert',
                },
                back: {
                  text: 'Keep',
                },
                reverse: true,
              }}
            >
              {(showDialog) => (
                <RoundedButton disabled={disabled} variant="contained" color="error" onClick={showDialog}>
                  Mark all as not duplicates
                </RoundedButton>
              )}
            </ConfirmationDialog>

            <RoundedButton
              disabled={disabled}
              variant="contained"
              onClick={() => next(patientRows.map(({ pid }) => pid))}
            >
              Continue
            </RoundedButton>
          </Stack>
        </Stack>
      </Stack>
    </Dialog>
  );
};
