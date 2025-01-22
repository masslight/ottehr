import { Grid, Stack, Paper, TextField, Autocomplete } from '@mui/material';
import { InfoAlert } from '../features/css-module/components/InfoAlert';

const PatientTaskType: string[] = ['Clinical', 'Non-Clinical'];
const PatientTaskCategory: string[] = ['Medication', '-'];
const PatientAssignTask: string[] = ['Not Assigned', 'Assigned'];
const PatientTaskOffice: string[] = ['Commack, NY', 'New York, NY'];

export default function AddFollowupTask(): JSX.Element {
  return (
    <Stack spacing={2}>
      <Paper sx={{ p: 3, mb: 3, backgroundColor: '#f4f6f8' }}>
        <Grid container spacing={2} columns={10}>
          <Grid item xs={5}>
            <Autocomplete
              options={PatientTaskType}
              fullWidth
              renderInput={(params) => (
                <TextField placeholder="Select task type" required name="pttype" {...params} label="Task Type" />
              )}
            />
          </Grid>
          <Grid item xs={5}>
            <Autocomplete
              options={PatientTaskCategory}
              fullWidth
              renderInput={(params) => (
                <TextField placeholder="Select category" required name="ptcategory" {...params} label="Task Category" />
              )}
            />
          </Grid>
          <Grid item xs={10}>
            <TextField fullWidth required id="task" label="Task" variant="outlined" />
          </Grid>
          <Grid item xs={10}>
            <TextField fullWidth id="task-details" label="Task details" variant="outlined" />
          </Grid>
          <Grid item xs={5}>
            <Autocomplete
              options={PatientAssignTask}
              fullWidth
              renderInput={(params) => (
                <TextField placeholder="Select assigned to" name="ptassigned" {...params} label="Assign task to" />
              )}
            />
          </Grid>
          <Grid item xs={5}>
            <Autocomplete
              options={PatientTaskOffice}
              fullWidth
              renderInput={(params) => (
                <TextField placeholder="Select office" required name="ptoffice" {...params} label="Office" />
              )}
            />
          </Grid>
        </Grid>
      </Paper>
      <InfoAlert text="The follow-up will be marked as Resolved once the task is completed" />
    </Stack>
  );
}
