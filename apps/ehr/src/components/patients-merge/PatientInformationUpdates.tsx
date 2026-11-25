import {
  Button,
  FormControlLabel,
  Radio,
  RadioGroup,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { Patient, Task } from 'fhir/r4b';
import { FC, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { AppDialog } from 'src/components/dialogs/AppDialog';
import { useGetPatientForUpdate } from './queries';

type PatientInformationUpdatesProps = {
  patientId?: string;
};

const getTableValues: Record<
  string,
  {
    label: string;
  }
> = {
  '/name/0/given/0': {
    label: 'First Name',
  },
  '/name/0/family': {
    label: 'Last Name',
  },
  '/gender': {
    label: 'Gender',
  },
  '/contact/0/telecom/0/value': {
    label: 'Phone number',
  },
};

export const PatientInformationUpdates: FC<PatientInformationUpdatesProps> = (props) => {
  const { patientId } = props;

  const [patient, setPatient] = useState<Patient>();
  const [task, setTask] = useState<Task>();
  const [open, setOpen] = useState(false);
  const hideDialog = (): void => setOpen(false);

  useGetPatientForUpdate({ patientId }, (data) => {
    if (!data) return;

    const patient = data.find((resource) => (resource as unknown as Patient).resourceType === 'Patient');
    const task = (data as unknown as Task[]).find((item) => item.resourceType === 'Task');

    setPatient(patient as unknown as Patient);
    setTask(task);

    reset(
      task?.input
        ?.filter((item) => item.valueString)
        ?.map((item) => JSON.parse(item.valueString!))
        ?.reduce(
          (prev, curr) => {
            prev[curr.path] = 'current';
            return prev;
          },
          {} as Record<string, string>
        )
    );
  });

  const methods = useForm();
  const { control, handleSubmit, reset } = methods;

  const onSubmit = (data: Record<string, string>): void => {
    console.log(data);
  };

  return (
    <>
      <Button disabled={!patientId} onClick={() => setOpen(true)}>
        Patient information updates
      </Button>
      {/* Mounted only while open, as before, so each opening starts from a fresh dialog. */}
      {open && (
        <AppDialog
          variant="form"
          size="m"
          open
          onClose={hideDialog}
          title="Review Patient Information Updates"
          primary={{ label: 'Confirm Updates', onClick: () => void handleSubmit(onSubmit)() }}
          actions={[{ label: 'Dismiss All Updates', tone: 'error', onClick: hideDialog }]}
        >
          <Typography sx={{ mb: 2 }}>
            Please select which information should carry over to the record after confirmation. You will be able to edit
            information after that, if needed.
          </Typography>
          <TableContainer sx={{ maxHeight: '60vh' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ '& .MuiTableCell-head': { fontWeight: 'bold' } }}>
                <TableCell variant="head">Parameter</TableCell>
                <TableCell variant="head">Current Information</TableCell>
                <TableCell variant="head">New Information</TableCell>
              </TableRow>
            </TableHead>

            <TableBody>
              {patient &&
                task?.input
                  ?.filter((item) => item.valueString)
                  ?.map((item) => {
                    const action = JSON.parse(item.valueString || '') as {
                      op: string;
                      path: string;
                      value?: string;
                    };
                    const path = action.path;
                    const oldValue = path
                      .split('/')
                      .filter(Boolean)
                      .reduce((prev, curr) => prev?.[curr], patient as any) as unknown as string | undefined;

                    return (
                      <TableRow key={action.path}>
                        <TableCell>{getTableValues[action.path].label}</TableCell>
                        <TableCell>
                          <Controller
                            render={({ field: { onChange, value } }) => (
                              <RadioGroup value={value} onChange={onChange}>
                                <FormControlLabel value="current" control={<Radio />} label={oldValue || '-'} />
                              </RadioGroup>
                            )}
                            name={action.path}
                            control={control}
                          />
                        </TableCell>
                        <TableCell>
                          <Controller
                            render={({ field: { onChange, value } }) => (
                              <RadioGroup value={value} onChange={onChange}>
                                <FormControlLabel value="new" control={<Radio />} label={action?.value || '-'} />
                              </RadioGroup>
                            )}
                            name={action.path}
                            control={control}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
            </TableBody>
          </Table>
          </TableContainer>
        </AppDialog>
      )}
    </>
  );
};
