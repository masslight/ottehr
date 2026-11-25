import { Table, TableBody, TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { ReactElement } from 'react';
import { ActivityLogData } from '../../helpers/activityLogsUtils';
import ActivityLogRow from '../ActivityLogRow';
import { AppDialog } from './AppDialog';

interface ActivityLogDialogProps {
  open: boolean;
  handleClose: () => void;
  logs: ActivityLogData[];
}

export default function ActivityLogDialog({ open, handleClose, logs }: ActivityLogDialogProps): ReactElement {
  return (
    <AppDialog
      variant="form"
      size="m"
      open={open}
      onClose={handleClose}
      title="Activity Log"
      dismiss={{ label: 'Close' }}
    >
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
    </AppDialog>
  );
}
