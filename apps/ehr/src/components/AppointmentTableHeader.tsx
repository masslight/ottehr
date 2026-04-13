import { TableCell, TableHead, TableRow, Typography } from '@mui/material';
import { ReactElement } from 'react';
import {
  CHAT_WIDTH_MIN,
  GO_TO_MANY_BUTTONS_WIDTH_MIN,
  NOTES_WIDTH_MIN,
  PATIENT_AND_REASON_WIDTH_MIN,
  PROVIDER_WIDTH_MIN,
  ROOM_WIDTH_MIN,
  TIME_WIDTH_MIN,
  TYPE_WIDTH_MIN,
  VISIT_ICONS_WIDTH_MIN,
  VITALS_ICON_WIDTH_MIN,
} from '../constants';
import { ApptTab } from './AppointmentTabs';

interface AppointmentTableHeaderProps {
  tab: ApptTab;
  table?: 'waiting-room' | 'in-exam';
}

export default function AppointmentTableHeader({ tab, table }: AppointmentTableHeaderProps): ReactElement {
  return (
    <TableHead>
      <TableRow sx={{ '& .MuiTableCell-root': { px: 1.5 }, display: { xs: 'none', sm: 'none', md: 'table-row' } }}>
        <TableCell sx={{ width: '40px', p: 0 }}></TableCell>
        <TableCell sx={{ width: TYPE_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            {tab !== ApptTab.prebooked ? 'Type & Status' : 'Type'}
          </Typography>
        </TableCell>
        <TableCell sx={{ width: TIME_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            Time
          </Typography>
        </TableCell>
        <TableCell sx={{ width: PATIENT_AND_REASON_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            Patient & Reason
          </Typography>
        </TableCell>
        {(tab === ApptTab['in-office'] || tab === ApptTab.completed) && (
          <TableCell sx={{ width: ROOM_WIDTH_MIN }}>
            <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
              Room
            </Typography>
          </TableCell>
        )}
        <TableCell sx={{ width: PROVIDER_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            Provider
          </Typography>
        </TableCell>
        {((tab === ApptTab['in-office'] && table === 'in-exam') || tab === ApptTab.completed) && (
          <TableCell sx={{ width: VITALS_ICON_WIDTH_MIN }}>
            <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
              Vitals
            </Typography>
          </TableCell>
        )}
        <TableCell sx={{ width: VISIT_ICONS_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            {tab === ApptTab.completed || (tab === ApptTab['in-office'] && table === 'in-exam')
              ? 'Orders'
              : 'Visit Components'}
          </Typography>
        </TableCell>
        <TableCell sx={{ width: NOTES_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            Notes
          </Typography>
        </TableCell>
        <TableCell sx={{ width: CHAT_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            Chat
          </Typography>
        </TableCell>
        <TableCell sx={{ width: GO_TO_MANY_BUTTONS_WIDTH_MIN }}>
          <Typography variant="subtitle2" sx={{ fontSize: '14px', fontWeight: 600 }}>
            Actions
          </Typography>
        </TableCell>
      </TableRow>
    </TableHead>
  );
}
