import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import PrintOutlinedIcon from '@mui/icons-material/PrintOutlined';
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
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
  const [returning, setReturning] = useState(false);
  // Set only when an upload arrived that nothing identifies — a scan of a printed form, usually. Its bytes
  // are already stored; naming the form is what finishes filing it.
  const [awaitingSource, setAwaitingSource] = useState<{ z3Url: string; fileName: string } | undefined>();
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
  const busy = !!pendingId || returning;

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

  const returnCompleted = (file: File): void => {
    if (!appointment?.id || busy) return;

    setError(undefined);
    setNotice(undefined);
    setReturning(true);

    setAwaitingSource(undefined);

    returnForm.mutate(
      { appointmentId: appointment.id, file },
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

          // Nothing in the document says what it is, so ask rather than guess. It is already stored; the
          // answer completes the filing without a second upload.
          if (result.status === 'needsSource' && result.z3Url) {
            setAwaitingSource({ z3Url: result.z3Url, fileName: file.name });
            return;
          }

          // Which form it was is worth saying: nothing was chosen, so the answer came from the document.
          const filedUnder = forms.find((form) => form.documentReferenceId === result.filedUnderTemplateId);
          setNotice(
            filedUnder
              ? `${file.name} was filed as ${filedUnder.title}.`
              : `${file.name} has been added to this patient's documents, without being linked to a form.`
          );
        },
        onError: (err: Error) => setError(err.message || 'The form could not be uploaded.'),
        onSettled: () => setReturning(false),
      }
    );
  };

  /** Completes an upload that could not identify itself, or throws it away if it does not belong here. */
  const finishFiling = (templateId: string | undefined): void => {
    if (!appointment?.id || !awaitingSource) return;

    const { z3Url, fileName } = awaitingSource;
    returnForm.mutate(
      { appointmentId: appointment.id, z3Url, templateId, discard: !templateId },
      {
        onSuccess: (result) => {
          const filedUnder = forms.find((form) => form.documentReferenceId === result.filedUnderTemplateId);
          setNotice(
            result.status === 'discarded'
              ? `${fileName} was discarded. Upload it from Patient Documents if it belongs on this chart.`
              : filedUnder
              ? `${fileName} was filed as ${filedUnder.title}.`
              : `${fileName} was filed.`
          );
          setAwaitingSource(undefined);
        },
        onError: (err: Error) => setError(err.message || 'The form could not be filed.'),
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

          <Stack direction={{ xs: 'column', md: 'row' }} spacing={3} alignItems="flex-start">
            <Stack spacing={3} sx={{ flex: 1, minWidth: 0 }}>
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
                  </Stack>
                );
              })}
            </Stack>

            {forms.length > 0 && (
              // Beside the list rather than after it, so returning a form does not mean scrolling past
              // every template first. Sticky on wide screens; stacked underneath on narrow ones, where a
              // column this thin would squeeze both it and the list.
              <Stack
                spacing={1}
                sx={{
                  width: { xs: '100%', md: 300 },
                  flexShrink: 0,
                  position: { md: 'sticky' },
                  top: { md: 16 },
                }}
              >
                <Typography variant="subtitle1" fontWeight={600}>
                  Return a completed form
                </Typography>

                <ReturnFormDropZone onFile={returnCompleted} disabled={busy || !appointment?.id} busy={returning} />

                {/* Asked only when the document could not say what it is — a form downloaded from here
                    carries that answer, and a scan of a printed one cannot. The file is already stored by
                    this point; naming the form is what finishes filing it. */}
                {awaitingSource && (
                  <Stack spacing={1} sx={{ pt: 1 }}>
                    <Typography variant="body2">
                      <strong>{awaitingSource.fileName}</strong> does not say which form it is. Which was it?
                    </Typography>
                    {returnForm.isPending ? (
                      <Stack direction="row" spacing={1} alignItems="center">
                        <CircularProgress size={16} />
                        <Typography variant="body2" color="text.secondary">
                          Filing…
                        </Typography>
                      </Stack>
                    ) : (
                      <TextField
                        select
                        size="small"
                        label="Form"
                        value=""
                        onChange={(e) => finishFiling(e.target.value || undefined)}
                      >
                        {forms.map((form) => (
                          <MenuItem key={form.documentReferenceId} value={form.documentReferenceId}>
                            {form.title}
                          </MenuItem>
                        ))}
                        <MenuItem value="">Not one of these — discard it</MenuItem>
                      </TextField>
                    )}
                  </Stack>
                )}
              </Stack>
            )}
          </Stack>
        </Stack>
      </Box>
    </AccordionCard>
  );
};
