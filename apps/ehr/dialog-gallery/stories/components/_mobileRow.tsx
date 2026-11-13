// Shared setup for the two mobile tracking-board row stories (not a story itself).
import { Table, TableBody } from '@mui/material';
import { DateTime } from 'luxon';
import { ReactElement } from 'react';
import AppointmentTableRow from 'src/components/AppointmentTableRow';
import { ApptTab } from 'src/components/AppointmentTabs';

// AppointmentTableRow only renders AppointmentTableRowMobile below the `sm` breakpoint, so the stories
// using this set a phone-size `viewport`.
const now = DateTime.now();
const ago = (minutes: number): string => now.minus({ minutes }).toISO() as string;

const appointment: any = {
  id: 'appt-1',
  encounterId: 'enc-1',
  encounter: { resourceType: 'Encounter', id: 'enc-1', status: 'in-progress', class: { code: 'AMB' } },
  start: ago(55),
  appointmentType: 'walk-in',
  status: 'intake',
  reasonForVisit:
    'Breathing problem - wheezing and shortness of breath since last night, worse when lying down, not relieved by inhaler',
  patient: { id: 'pat-1', firstName: 'Olivia', lastName: 'Bennett', dateOfBirth: '2016-04-12' },
  location: { resourceType: 'Location', id: 'loc-1', name: 'Brooklyn Main Clinic' },
  paperwork: { demographics: true, photoID: true, insuranceCard: true, consent: true, ovrpInterest: false },
  participants: {},
  waitingMinutes: 20,
  visitStatusHistory: [
    { status: 'pending', period: { start: ago(60), end: ago(52) } },
    { status: 'arrived', period: { start: ago(52), end: ago(31) } },
    { status: 'ready', period: { start: ago(31), end: ago(12) } },
    { status: 'intake', period: { start: ago(12) } },
  ],
};

export const renderMobileRow = (): ReactElement => (
  <Table>
    <TableBody>
      <AppointmentTableRow
        appointment={appointment}
        now={now}
        tab={ApptTab['in-office']}
        updateAppointments={() => undefined}
        setEditingComment={() => undefined}
        orders={{} as any}
      />
    </TableBody>
  </Table>
);
