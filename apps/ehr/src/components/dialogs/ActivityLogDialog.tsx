import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { ReactElement } from 'react';
import { ActivityLogData } from '../../helpers/activityLogsUtils';
import ActivityLogRow from '../ActivityLogRow';

interface ActivityLogDialogProps {
  open: boolean;
  handleClose: () => void;
  logs: ActivityLogData[];
}

export default function ActivityLogDialog({ open, handleClose, logs }: ActivityLogDialogProps): ReactElement {
  const buttonSx = {
    fontWeight: 500,
    textTransform: 'none',
    borderRadius: 6,
  };

  return (
    <Dialog
      open={open}
      onClose={handleClose}
      disableScrollLock
      sx={{
        '.MuiPaper-root': {
          padding: 1,
          minWidth: '75vw',
        },
      }}
    >
      <DialogTitle variant="h4" color="primary.dark" sx={{ width: '100%' }}>
        Activity log
      </DialogTitle>
      <DialogContent>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Date and time
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Activity
                </Typography>
              </TableCell>
              <TableCell>
                <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                  Made by
                </Typography>
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {logs.map((log, idx) => (
              <ActivityLogRow key={idx} log={log}></ActivityLogRow>
            ))}
          </TableBody>
        </Table>
      </DialogContent>
      <DialogActions sx={{ justifyContent: 'flex-start', marginLeft: 1 }}>
        <Button variant="contained" onClick={handleClose} size="medium" sx={buttonSx}>
          Close
        </Button>
      </DialogActions>
    </Dialog>
  );
}
