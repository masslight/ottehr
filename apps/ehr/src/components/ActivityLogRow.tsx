import { Box, Link, Table, TableBody, TableCell, TableHead, TableRow, Typography, useTheme } from '@mui/material';
import { ReactElement, useState } from 'react';
import { ActivityLogData } from '../helpers/activityLogsUtils';

interface ActivityLogRowProps {
  log: ActivityLogData;
}

export default function ActivityLogRow({ log }: ActivityLogRowProps): ReactElement {
  const theme = useTheme();
  const [showDetails, setShowDetails] = useState<boolean>(false);

  return (
    <>
      <TableRow>
        <TableCell>
          <Typography variant="body1">{log.activityDateTime}</Typography>
        </TableCell>
        <TableCell>
          <Box sx={{ display: 'flex', alignItems: 'center', whiteSpace: 'nowrap' }}>
            <Typography variant="body1">
              {log.activityName}
              {log?.activityNameSupplement ? ` - ${log.activityNameSupplement}` : ''}
            </Typography>
            {log.moreDetails && (
              <Link
                onClick={() => setShowDetails(!showDetails)}
                sx={{ cursor: 'pointer', textDecoration: 'none', marginLeft: 1 }}
              >
                {showDetails ? 'See Less' : 'See Details'}
              </Link>
            )}
          </Box>
        </TableCell>
        <TableCell>
          <Typography variant="body1">{log.activityBy}</Typography>
        </TableCell>
      </TableRow>
      {showDetails && (
        <>
          <TableRow sx={{ background: theme.palette.background.default }}>
            <TableCell colSpan={3} sx={{ padding: '8px 24px 8px 24px' }}>
              <Table sx={{ width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                        Before
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body1">{log.moreDetails?.valueBefore}</Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableCell>
          </TableRow>
          <TableRow sx={{ background: theme.palette.background.default }}>
            <TableCell colSpan={3} sx={{ padding: '8px 24px 8px 24px' }}>
              <Table sx={{ width: '100%' }}>
                <TableHead>
                  <TableRow>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="subtitle2" sx={{ fontSize: '14px' }}>
                        After
                      </Typography>
                    </TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  <TableRow sx={{ '&:last-child td': { borderBottom: 0 } }}>
                    <TableCell sx={{ py: 1 }}>
                      <Typography variant="body1">{log.moreDetails?.valueAfter}</Typography>
                    </TableCell>
                  </TableRow>
                </TableBody>
              </Table>
            </TableCell>
          </TableRow>
        </>
      )}
    </>
  );
}
