import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import { Alert, Box, Button, Chip, CircularProgress, Divider, Stack, Typography } from '@mui/material';
import { FC, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  useCompletedForms,
  useFillFormTemplate,
  useFormTemplates,
  useReturnCompletedForm,
} from 'src/features/form-templates/useFormTemplates';
import { AccordionCard } from '../../../../components/AccordionCard';
import { useAppointmentData } from '../stores/appointment/appointment.store';
import { ReturnFormDropZone } from './ReturnFormDropZone';

export const FormsCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [notice, setNotice] = useState<string | undefined>();
  const [pendingId, setPendingId] = useState<string | undefined>();
  const [returningId, setReturningId] = useState<string | undefined>();
  // Keyed by template, so each row can offer its own form back without a shared "most recent" slot that
  // says nothing about which row it belongs to.
  const [readyForms, setReadyForms] = useState<Record<string, string>>({});

  const { patient, appointment, encounter } = useAppointmentData();
  // Published templates only — drafts are visible on the admin page and nowhere else.
  const { data, isLoading, isError } = useFormTemplates();
  const fillTemplate = useFillFormTemplate();
  const returnForm = useReturnCompletedForm();
  const { data: completedTemplateIds } = useCompletedForms(patient?.id, encounter?.id);

  // A template whose stored file is missing is a broken link to a provider; the admin page surfaces it
  // for repair, but the chart simply omits it.
  const forms = (data?.items ?? []).filter((form) => form.pdfPresignedUrl);
  const busy = !!pendingId || !!returningId;

  const openForm = (templateId: string): void => {
    if (!appointment?.id || busy) return;

    setError(undefined);
    setPendingId(templateId);

    fillTemplate.mutate(
      { documentReferenceId: templateId, appointmentId: appointment.id },
      {
        onSuccess: ({ presignedUrl }) => {
          // Opening only once the form exists keeps the provider in the chart while it is built rather
          // than staring at a blank tab. Browsers only honour a programmatic `open` for a few seconds
          // after the click behind it, and a fill can outlast that, so the open is attempted and the row
          // keeps a link whether or not it succeeded.
          window.open(presignedUrl, '_blank', 'noopener');
          setReadyForms((prev) => ({ ...prev, [templateId]: presignedUrl }));
        },
        onError: (err: Error) => setError(err.message || 'The form could not be prepared.'),
        onSettled: () => setPendingId(undefined),
      }
    );
  };

  const returnCompleted = (templateId: string, file: File): void => {
    if (!appointment?.id || busy) return;

    setError(undefined);
    setNotice(undefined);
    setReturningId(templateId);

    returnForm.mutate(
      { appointmentId: appointment.id, templateId, file },
      {
        onSuccess: (result) => {
          if (result.status === 'patientMismatch') {
            // Deliberately specific. "Upload failed" would read as a glitch worth retrying, when what
            // happened is that the file belongs to someone else and must not be filed here.
            setError(
              'That file was prepared for a different patient, so it has not been added to this chart. ' +
                'Please check you selected the right download.'
            );
            return;
          }
          setNotice(`${file.name} has been added to this patient's documents.`);
        },
        onError: (err: Error) => setError(err.message || 'The form could not be uploaded.'),
        onSettled: () => setReturningId(undefined),
      }
    );
  };

  return (
    <AccordionCard label="Forms" collapsed={collapsed} onSwitch={() => setCollapsed((prevState) => !prevState)}>
      <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
        <Stack spacing={2}>
          <Typography display="inline">
            Forms open prefilled with this visit’s details. Complete a form and return it here to file it on the chart.
            Filed forms appear in{' '}
            <Link to={`/patient/${patient?.id}/docs`} target="_blank">
              Patient Documents
            </Link>
            .
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

          {notice && (
            <Alert severity="success" onClose={() => setNotice(undefined)}>
              {notice}
            </Alert>
          )}

          {!isLoading && !isError && forms.length === 0 && (
            <Typography variant="body2" color="text.secondary">
              No forms have been published yet.
            </Typography>
          )}

          {forms.map((form, index) => {
            const templateId = form.documentReferenceId;
            const readyUrl = readyForms[templateId];
            const isPreparing = pendingId === templateId;

            return (
              <Stack key={templateId} spacing={1.5}>
                {index > 0 && <Divider />}

                <Stack spacing={0.25}>
                  <Stack direction="row" spacing={1.5} alignItems="center" flexWrap="wrap">
                    <Typography variant="subtitle1" fontWeight={600}>
                      {form.title}
                    </Typography>
                    {completedTemplateIds?.has(templateId) && (
                      <Chip
                        size="small"
                        color="success"
                        variant="outlined"
                        icon={<CheckCircleOutlineIcon />}
                        label="Saved to chart"
                      />
                    )}
                    {/* A template with no form fields cannot be prefilled and cannot be typed into, in a
                        browser or anywhere else. Saying so up front is kinder than letting a provider
                        discover it after opening the form and trying to type. */}
                    {!form.fillable && (
                      <Chip size="small" variant="outlined" icon={<PrintOutlinedIcon />} label="Print and sign" />
                    )}
                  </Stack>
                  {form.description && (
                    <Typography variant="body2" color="text.secondary">
                      {form.description}
                    </Typography>
                  )}
                </Stack>

                <Stack direction="row" spacing={1} alignItems="center">
                  {isPreparing ? (
                    <>
                      <CircularProgress size={16} />
                      <Typography variant="body2" color="text.secondary">
                        Preparing…
                      </Typography>
                    </>
                  ) : readyUrl ? (
                    <>
                      <Button
                        size="small"
                        variant="outlined"
                        href={readyUrl}
                        target="_blank"
                        rel="noopener"
                        component="a"
                      >
                        Open form
                      </Button>
                      {/* Worth offering separately from the link: the link is short-lived, and the chart
                          may have moved on — a form built before the vitals were taken is out of date. */}
                      <Button size="small" disabled={busy} onClick={() => openForm(templateId)}>
                        Regenerate
                      </Button>
                    </>
                  ) : (
                    <Button
                      size="small"
                      variant="outlined"
                      disabled={busy || !appointment?.id}
                      onClick={() => openForm(templateId)}
                    >
                      {form.fillable ? 'Open prefilled' : 'Open to print'}
                    </Button>
                  )}
                </Stack>

                <ReturnFormDropZone
                  onFile={(file) => returnCompleted(templateId, file)}
                  disabled={busy || !appointment?.id}
                  busy={returningId === templateId}
                />
              </Stack>
            );
          })}
        </Stack>
      </Box>
    </AccordionCard>
  );
};
