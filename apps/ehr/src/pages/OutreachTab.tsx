import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { OUTREACH_URL } from 'src/App';
import ScheduledPatientOutreach from 'src/rcm/features/scheduled-patient-outreach/ScheduledPatientOutreach';
import { InvoiceablePatients } from './reports/index';

type OutreachSubTab = 'patient-invoices' | 'patient-outreach';

export default function OutreachTab({
  outreachSubTab,
  outreachDetailTab,
}: {
  outreachSubTab?: string;
  outreachDetailTab?: string;
}): ReactElement {
  const navigate = useNavigate();
  const subTab: OutreachSubTab = (outreachSubTab as OutreachSubTab) || 'patient-invoices';

  const handleSubTabChange = (_: unknown, newValue: OutreachSubTab): void => {
    navigate(`${OUTREACH_URL}/${newValue}`);
  };

  return (
    <Box sx={{ marginTop: 2 }}>
      <TabContext value={subTab}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleSubTabChange} aria-label="Outreach tabs">
            <Tab label="Patient Invoices" value="patient-invoices" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Patient Outreach" value="patient-outreach" sx={{ textTransform: 'none', fontWeight: 500 }} />
          </TabList>
        </Box>
        <TabPanel value="patient-invoices" sx={{ padding: 0 }}>
          <InvoiceablePatients />
        </TabPanel>
        <TabPanel value="patient-outreach" sx={{ padding: 0 }}>
          <ScheduledPatientOutreach outreachTab={outreachDetailTab} />
        </TabPanel>
      </TabContext>
    </Box>
  );
}
