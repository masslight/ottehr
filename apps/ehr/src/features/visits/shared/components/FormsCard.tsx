import { Alert, Box, CircularProgress, Stack, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import { useFillFormTemplate, useFormTemplates } from 'src/features/form-templates/useFormTemplates';
import { AccordionCard } from '../../../../components/AccordionCard';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { DocumentRow } from './DocumentRow';

export const FormsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | undefined>();

  const { patient, appointment } = useAppointmentData();
  // Published templates only — drafts are visible on the admin page and nowhere else.
  const { data, isLoading, isError } = useFormTemplates();
  const fillTemplate = useFillFormTemplate();

  // A template whose stored file is missing is a broken link to a provider; the admin page surfaces it
  // for repair, but the chart simply omits it.
  const forms = (data?.items ?? []).filter((form) => form.pdfPresignedUrl);

  const openForm = (documentReferenceId: string): void => {
    if (!appointment?.id || pendingId) return;

    // The tab is opened now, while the click is still the reason anything is happening. Opening it after
    // the request resolves would be a popup with no gesture behind it, which browsers block by default —
    // and the provider would be left with a form that silently never appeared.
    const tab = window.open('', '_blank');

    setError(undefined);
    setPendingId(documentReferenceId);

    fillTemplate.mutate(
      { documentReferenceId, appointmentId: appointment.id },
      {
        onSuccess: ({ presignedUrl }) => {
          if (tab) {
            tab.location.href = presignedUrl;
          } else {
            // Blocked despite the gesture. Navigating the current tab would lose the chart, so say so
            // rather than doing something the provider did not ask for.
            setError('Your browser blocked the new tab. Allow pop-ups for this site and try again.');
          }
        },
        onError: (err: Error) => {
          tab?.close();
          setError(err.message || 'The form could not be prepared.');
        },
        onSettled: () => setPendingId(undefined),
      }
    );
  };

  return (
    <AccordionCard label="Forms" collapsed={collapsed} onSwitch={() => setCollapsed((prevState) => !prevState)}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack style={{ width: '50%' }} spacing={2}>
          <Typography display="inline">
            Forms open prefilled with this visit’s details. Complete the form, then upload it to the{' '}
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

          {error && (
            <Alert severity="error" onClose={() => setError(undefined)}>
              {error}
            </Alert>
          )}

          {!isLoading && !isError && forms.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No forms have been published yet.
            </Typography>
          )}

          {forms.map((form) => (
            <DocumentRow
              key={form.documentReferenceId}
              label={form.title}
              loading={pendingId === form.documentReferenceId}
              // Disabled while any form is being prepared: each click stores a document and retires the
              // previous one, so overlapping requests would race over which copy is current.
              disabled={!!pendingId || !appointment?.id}
              onClick={() => openForm(form.documentReferenceId)}
            />
          ))}
        </Stack>
      </Box>
    </AccordionCard>
  );
};
