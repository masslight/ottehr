import { Alert, Box, Button, CircularProgress, Link as MuiLink, Stack, Typography } from '@mui/material';
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
  // The most recently produced form, kept so it stays reachable after its tab is closed.
  const [readyForm, setReadyForm] = useState<
    { documentReferenceId: string; url: string; fileName: string } | undefined
  >();

  const { patient, appointment } = useAppointmentData();
  // Published templates only — drafts are visible on the admin page and nowhere else.
  const { data, isLoading, isError } = useFormTemplates();
  const fillTemplate = useFillFormTemplate();

  // A template whose stored file is missing is a broken link to a provider; the admin page surfaces it
  // for repair, but the chart simply omits it.
  const forms = (data?.items ?? []).filter((form) => form.pdfPresignedUrl);

  const openForm = (documentReferenceId: string): void => {
    if (!appointment?.id || pendingId) return;

    setError(undefined);
    setReadyForm(undefined);
    setPendingId(documentReferenceId);

    fillTemplate.mutate(
      { documentReferenceId, appointmentId: appointment.id },
      {
        onSuccess: ({ presignedUrl, fileName }) => {
          // Opening only once the form exists keeps the provider in the chart while it is built rather
          // than staring at a blank tab. Browsers only honour a programmatic `open` for a few seconds
          // after the click behind it, and a fill can outlast that, so the open is attempted and the link
          // below stands whether or not it succeeded.
          window.open(presignedUrl, '_blank', 'noopener');
          setReadyForm({ documentReferenceId, url: presignedUrl, fileName });
        },
        onError: (err: Error) => setError(err.message || 'The form could not be prepared.'),
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

          {readyForm && (
            <Alert
              severity="success"
              onClose={() => setReadyForm(undefined)}
              action={
                // Regenerating matters because the link is short-lived, and because the chart may have
                // moved on: a form built before the vitals were taken is already out of date.
                <Button size="small" disabled={!!pendingId} onClick={() => openForm(readyForm.documentReferenceId)}>
                  Regenerate
                </Button>
              }
            >
              <MuiLink href={readyForm.url} target="_blank" rel="noopener">
                Open {readyForm.fileName}
              </MuiLink>
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
