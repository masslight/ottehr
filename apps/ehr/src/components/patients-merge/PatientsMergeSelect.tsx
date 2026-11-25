import SearchIcon from '@mui/icons-material/Search';
import {
  CircularProgress,
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
import { Patient } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useMemo, useState } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { DeleteIconButton } from 'src/components/DeleteIconButton';
import { getFullName } from 'utils/lib/fhir/patient';
import { standardizePhoneNumber } from 'utils/lib/helpers/helpers';
import { formatDateForDisplay } from 'utils/lib/utils/dateUtils';
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
  const [notDuplicatesOpen, setNotDuplicatesOpen] = useState(false);

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
          dob: formatDateForDisplay(patient.birthDate),
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

  const disabled = isFetching || getPatientById.isPending;

  return (
    <AppDialog
      variant="form"
      size="l"
      open={open}
      onClose={close}
      title="Merge Patients"
      actions={[
        {
          label: 'Mark All as Not Duplicates',
          tone: 'error',
          disabled,
          onClick: () => setNotDuplicatesOpen(true),
        },
      ]}
      primary={{ label: 'Continue', disabled, onClick: () => next(patientRows.map(({ pid }) => pid)) }}
    >
      <Stack spacing={2}>
        <Typography>
          Select duplicated patients profiles. On the next step you will select which information should carry over to
          the remaining patient record after merge.
        </Typography>

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
                {getPatientById.isPending ? <CircularProgress size={24} color="inherit" /> : <SearchIcon />}
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

      </Stack>

      <AppDialog
        variant="confirm"
        open={notDuplicatesOpen}
        onClose={() => setNotDuplicatesOpen(false)}
        title="Not Duplicates"
        primary={{
          label: 'Dismiss Alert',
          // What the old ConfirmationDialog wrapper did: run the response, then close; snackbar on failure.
          onClick: () => {
            try {
              close();
              setNotDuplicatesOpen(false);
            } catch (error: unknown) {
              console.error(error);
              enqueueSnackbar('An error occurred. Please try again.', { variant: 'error' });
            }
          },
        }}
      >
        <Stack spacing={2}>
          <Typography>Confirm the patients as not duplicates and dismiss the alert.</Typography>
          <Stack>
            <Typography fontWeight={600}>PIDs:</Typography>
            {patientRows.map(({ pid }) => (
              <Typography key={pid}>{pid}</Typography>
            ))}
          </Stack>
        </Stack>
      </AppDialog>
    </AppDialog>
  );
};
