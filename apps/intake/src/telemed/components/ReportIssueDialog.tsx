import { ReactElement, useState } from 'react';
import { Button, Dialog, DialogActions, DialogTitle, DialogContent, Typography, TextField } from '@mui/material';
import LoadingButton from '@mui/lab/LoadingButton';
import Oystehr from '@oystehr/sdk';
import { Communication } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { COMMUNICATION_ISSUE_REPORT_CODE } from 'utils';
import { AlertColor } from '@mui/material/Alert';

interface ReportIssueDialogProps {
  open: boolean;
  handleClose: () => void;
  oystehr: Oystehr | undefined;
  appointmentID: string | undefined;
  patientID: string | undefined;
  encounterId: string | undefined;
  setToastMessage: React.Dispatch<React.SetStateAction<string | undefined>>;
  setToastType: React.Dispatch<React.SetStateAction<AlertColor | undefined>>;
  setSnackbarOpen: React.Dispatch<React.SetStateAction<boolean>>;
}

export default function ReportIssueDialog({
  open,
  handleClose,
  oystehr,
  appointmentID,
  patientID,
  encounterId,
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
      sent: DateTime.now().toISO() || '',
      payload: [
        {
          contentString: issueDetails,
        },
      ],
    };

    if (patientID) {
      issueCommunication.subject = {
        type: 'Patient',
        reference: `Patient/${patientID}`,
      };
    }

    const about = [];
    if (appointmentID) {
      about.push({
        type: 'Appointment',
        reference: `Appointment/${appointmentID}`,
      });
    }
    // if (locationState) {
    //   about.push({
    //     type: 'Location',
    //     reference: `Location/${locationState}`,
    //   });
    // }
    if (encounterId) {
      about.push({
        type: 'Encounter',
        reference: `Encounter/${encounterId}`,
      });
    }
    if (about.length > 0) {
      issueCommunication.about = about;
    }

    try {
      await oystehr?.fhir.create(issueCommunication);
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
              Did you have an issue interacting with QRS related to this visit? Please let us know what you experienced.
              This feedback will be submited directly to the development team.
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
