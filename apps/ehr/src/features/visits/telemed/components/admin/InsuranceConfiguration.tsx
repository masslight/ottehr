import { TabContext, TabList, TabPanel } from '@mui/lab';
import { Box, Tab } from '@mui/material';
import { ReactElement } from 'react';
import { useNavigate } from 'react-router-dom';
import { BILLING_INSURANCE_URL } from 'src/App';
import InsuranceList from './InsuranceList';
import InsuranceNotesList from './InsuranceNotesList';
import PatientInsuranceList from './PatientInsuranceList';

type InsuranceSubTab = 'all' | 'patient' | 'notes';

export default function InsuranceConfiguration({ insuranceTab }: { insuranceTab?: string }): ReactElement {
  const navigate = useNavigate();
  const subTab: InsuranceSubTab = (insuranceTab as InsuranceSubTab) || 'all';

  const handleSubTabChange = (_: unknown, newValue: InsuranceSubTab): void => {
    navigate(`${BILLING_INSURANCE_URL}/${newValue}`);
  };

  return (
    <Box sx={{ marginTop: 2 }}>
      <TabContext value={subTab}>
        <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <TabList onChange={handleSubTabChange} aria-label="Billing configuration tabs">
            <Tab label="All Insurances" value="all" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Patient Insurances" value="patient" sx={{ textTransform: 'none', fontWeight: 500 }} />
            <Tab label="Insurance Notes" value="notes" sx={{ textTransform: 'none', fontWeight: 500 }} />
          </TabList>
        </Box>
        <TabPanel value="all" sx={{ padding: 0 }}>
          <InsuranceList />
        </TabPanel>
        <TabPanel value="patient" sx={{ padding: 0 }}>
          <PatientInsuranceList />
        </TabPanel>
        <TabPanel value="notes" sx={{ padding: 0 }}>
          <InsuranceNotesList />
        </TabPanel>
      </TabContext>
    </Box>
  );
}
