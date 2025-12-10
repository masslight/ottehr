import { Box, Stack, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useGetPatientDocs } from 'src/hooks/useGetPatientDocs';
import { FORMS_CONFIG } from 'utils';
import { AccordionCard } from '../../../../components/AccordionCard';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { ExcuseLink } from './plan-tab/components/ExcuseLink';

export const FormsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const { patient } = useAppointmentData();

  const { documentsFolders } = useGetPatientDocs(patient?.id ?? '');
  const formFolder = documentsFolders?.find((folder) => folder.folderName === 'Consent Forms');

  return (
    <>
      <AccordionCard label="Forms" collapsed={collapsed} onSwitch={() => setCollapsed((prevState) => !prevState)}>
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Stack style={{ width: '50%' }} spacing={2}>
            <Typography display="inline">
              Please fill in the form(s) using the templates and upload it to the{' '}
              <Link to={`/patient/${patient?.id}/docs?folder=${formFolder?.id}`} target="_blank">
                Forms Folder
              </Link>
            </Typography>
            {FORMS_CONFIG.forms.map((form) => {
              return <ExcuseLink key={form.link} label={form.title} to={form.link} />;
            })}
          </Stack>
        </Box>
      </AccordionCard>
    </>
  );
};
