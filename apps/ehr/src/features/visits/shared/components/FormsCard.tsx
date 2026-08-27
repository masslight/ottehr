import { Box, CircularProgress, Stack, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFormTemplates } from 'src/features/form-templates/useFormTemplates';
import { AccordionCard } from '../../../../components/AccordionCard';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { ExcuseLink } from './plan-tab/components/ExcuseLink';

export const FormsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);

  const { patient } = useAppointmentData();
  // Published templates only — drafts are visible on the admin page and nowhere else.
  const { data, isLoading, isError } = useFormTemplates();

  // A template whose stored file is missing is a broken link to a provider; the admin page surfaces it
  // for repair, but the chart simply omits it.
  const forms = (data?.items ?? []).filter((form) => form.pdfPresignedUrl);

  return (
    <AccordionCard label="Forms" collapsed={collapsed} onSwitch={() => setCollapsed((prevState) => !prevState)}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack style={{ width: '50%' }} spacing={2}>
          <Typography display="inline">
            Please fill in the form(s) using the templates and upload it to the{' '}
            <Link to={`/patient/${patient?.id}/docs`} target="_blank">
              Patient Documents
            </Link>
          </Typography>

          {isLoading && <CircularProgress size={20} />}

          {isError && (
            <Typography color="error" variant="body2">
              Forms could not be loaded.
            </Typography>
          )}

          {!isLoading && !isError && forms.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No forms have been published yet.
            </Typography>
          )}

          {forms.map((form) => (
            <ExcuseLink key={form.documentReferenceId} label={form.title} to={form.pdfPresignedUrl} />
          ))}
        </Stack>
      </Box>
    </AccordionCard>
  );
};
