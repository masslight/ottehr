import { ReactElement, useState } from 'react';
import { Button, Dialog, DialogActions, DialogTitle, DialogContent, Typography, TextField } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import { FhirClient } from '@zapehr/sdk';
import { Communication, Encounter, Patient, Appointment, Location } from 'fhir/r4';
import { DateTime } from 'luxon';
import useOttehrUser from '../../hooks/useOttehrUser';
import { COMMUNICATION_ISSUE_REPORT_CODE } from 'ehr-utils';
import { AlertColor } from '@mui/material/Alert';

interface ReportIssueDialogProps {
  open: boolean;
  handleClose: () => void;
  fhirClient: FhirClient | undefined;
  patient: Patient | undefined;
  appointment: Appointment | undefined;
  encounter: Encounter;
  location: Location;
  setToastMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  setToastType: React.Dispatch<React.SetStateAction<AlertColor | undefined>>;
  setSnackbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ReportIssueDialog({
  open,
  handleClose,
  fhirClient,
  patient,
  appointment,
  encounter,
  location,
  setToastMessage,
  setToastType,
  setSnackbarOpen,
}: ReportIssueDialogProps): ReactElement {
  const [reportIssueLoading, setReportIssueLoading] = useState<boolean>(false);
  const [issueDetails, setIssueDetails] = useState<string>('');
  const [error, setError] = useState<boolean>(false);
  const buttonSx = {
    fontWeight: '700',
    textTransform: 'none',
    borderRadius: 6,
  };

  const user = useOttehrUser();

  const handleReportIssue = async (event: React.FormEvent<HTMLFormElement>): Promise<void> => {
    event.preventDefault();
    setError(false);
    setReportIssueLoading(true);

    const issueCommunication: Communication = {
      resourceType: 'Communication',
      status: 'in-progress',
      category: [
        {
          coding: [COMMUNICATION_ISSUE_REPORT_CODE],
        },
      ],
      encounter: {
        type: 'Encounter',
        reference: `Encounter/${encounter.id}`,
      },
      sent: DateTime.now().toISO() || '',
      payload: [
        {
          contentString: issueDetails,
        },
      ],
    };

    if (user?.profile) {
      issueCommunication.sender = {
        type: 'Practitioner',
        reference: user.profile,
      };
    }
    if (patient?.id) {
      issueCommunication.subject = {
        type: 'Patient',
        reference: `Patient/${patient.id}`,
      };
    }

    const about = [];
    if (appointment?.id) {
      about.push({
        type: 'Appointment',
        reference: `Appointment/${appointment.id}`,
      });
    }
    if (location?.id) {
      about.push({
        type: 'Location',
        reference: `Location/${location.id}`,
      });
    }
    if (about.length > 0) {
      issueCommunication.about = about;
    }

    try {
      await fhirClient?.createResource(issueCommunication);
      setToastMessage('Issue submitted successfully!');
      setToastType('success');
      setSnackbarOpen(true);
      handleClose();
    } catch (e) {
      console.log('error', e);
      setError(true);
    }
    setReportIssueLoading(false);
    setIssueDetails('');
  };

  const handleDialogClose = (): void => {
    handleClose();
    setIssueDetails('');
    setError(false);
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 1,
          width: '444px',
          maxWidth: 'initial',
        },
      }}
    >
      <form onSubmit={(e) => handleReportIssue(e)}>
        <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
          Report Issue
        </DialogTitle>
        <DialogContent>
          <div>
            <Typography>
              Did you or the patient have an issue interacting with QRS related to this visit? Please let us know what
              you experienced. This feedback will be submited directly to the development team.
            </Typography>
            <TextField
              required
              multiline
              minRows={3}
              placeholder={'Enter issue details here...'}
              value={issueDetails}
              onChange={(e) => setIssueDetails(e.target.value)}
              sx={{ marginTop: 1, width: '100%' }}
            />
          </div>
        </DialogContent>
        <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
          <LoadingButton
            loading={reportIssueLoading}
            disabled={issueDetails.trim() === ''}
            type="submit"
            variant="contained"
            color="primary"
            size="medium"
            sx={buttonSx}
          >
            Submit Issue
          </LoadingButton>
          <Button variant="text" onClick={handleDialogClose} size="medium" sx={buttonSx}>
            Cancel
          </Button>
        </DialogActions>
        {error && (
          <Typography color="error" variant="body2" my={1} mx={2}>
            There was an error sending this issue report, please try again.
          </Typography>
        )}
      </form>
    </Dialog>
  );
}
