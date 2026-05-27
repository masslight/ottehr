import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SchoolIcon from '@mui/icons-material/School';
import {
  Autocomplete,
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { PatientEducationSectionsEditor } from 'src/features/visits/shared/components/PatientEducationSectionsEditor';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { EducationSection, generateCombinedPdf } from 'src/features/visits/shared/hooks/usePatientEducation';
import { useICD10SearchNew } from 'src/features/visits/shared/stores/appointment/appointment.queries';
import { useDebounce } from 'src/shared/hooks/useDebounce';
import { ApprovedPatientEducationIcdCode, IcdSearchResponse } from 'utils';
import { APPROVED_PATIENT_EDUCATION_QUERY_KEY } from './PatientEducationAdminPage';

type DialogProps = {
  open: boolean;
  onClose: () => void;
};

type Diagnosis = IcdSearchResponse['codes'][number];

export const ApprovedPatientEducationDialog: FC<DialogProps> = ({ open, onClose }) => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();

  const [primary, setPrimary] = useState<Diagnosis | null>(null);
  const [alternates, setAlternates] = useState<Diagnosis[]>([]);

  const [primaryInput, setPrimaryInput] = useState('');
  const [primaryDebounced, setPrimaryDebounced] = useState('');
  const { debounce: debouncePrimary } = useDebounce(800);
  const { data: primaryData, isFetching: isPrimaryFetching } = useICD10SearchNew({ search: primaryDebounced });
  const primaryOptions = primaryData?.codes ?? [];

  const [alternateInput, setAlternateInput] = useState('');
  const [alternateDebounced, setAlternateDebounced] = useState('');
  const { debounce: debounceAlternate } = useDebounce(800);
  const { data: alternateData, isFetching: isAlternateFetching } = useICD10SearchNew({ search: alternateDebounced });
  const alternateOptions = (alternateData?.codes ?? []).filter(
    (o) => o.code !== primary?.code && !alternates.some((a) => a.code === o.code)
  );

  const [generatedSection, setGeneratedSection] = useState<EducationSection | null>(null);
  const [editableSection, setEditableSection] = useState<EducationSection | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [submitAttempted, setSubmitAttempted] = useState(false);

  const generateMutation = useMutation({
    mutationFn: async () => {
      if (!apiClient) throw new Error('API client not available');
      if (!primary) throw new Error('A diagnosis is required');
      const result = await apiClient.generatePatientEducation({
        icdCode: primary.code,
        icdDescription: primary.display,
      });
      if (!result.content) {
        throw new Error('No content was generated for the selected diagnosis.');
      }
      return {
        content: result.content,
        patientTitle: result.patientTitle || primary.display,
        icdCode: primary.code,
        icdDescription: primary.display,
      } as EducationSection;
    },
    onSuccess: (section) => {
      setGeneratedSection(section);
      setEditableSection(section);
      setErrorMsg(null);
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!apiClient) throw new Error('API client not available');
      if (!primary) throw new Error('A diagnosis is required');
      const section = editableSection ?? generatedSection;
      if (!section) throw new Error('No content to save');

      const pdfBytes = await generateCombinedPdf([section]);
      const pdfBase64 = btoa(
        Array.from(pdfBytes)
          .map((b) => String.fromCharCode(b))
          .join('')
      );
      const title = `Patient Education: ${section.patientTitle}`;
      const icdCodes: ApprovedPatientEducationIcdCode[] = [
        { code: primary.code, display: primary.display },
        ...alternates.map((a) => ({ code: a.code, display: a.display })),
      ];
      return apiClient.saveApprovedPatientEducation({ pdfBase64, title, icdCodes });
    },
    onSuccess: (output) => {
      const replacedNote =
        output.replacedDocumentReferenceIds.length > 0
          ? ` (replaced ${output.replacedDocumentReferenceIds.length} prior PDF${
              output.replacedDocumentReferenceIds.length === 1 ? '' : 's'
            })`
          : '';
      enqueueSnackbar(`Approved PDF saved${replacedNote}`, { variant: 'success' });
      void queryClient.invalidateQueries({ queryKey: APPROVED_PATIENT_EDUCATION_QUERY_KEY });
      onClose();
    },
    onError: (err) => {
      setErrorMsg(err instanceof Error ? err.message : String(err));
    },
  });

  const isBusy = generateMutation.isPending || saveMutation.isPending;
  const showReview = !!generatedSection;
  const reviewSection = editableSection ?? generatedSection;

  return (
    <Dialog open={open} onClose={() => !isBusy && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>{showReview ? 'Review Patient Education' : 'New Approved Patient Education'}</DialogTitle>
      <DialogContent>
        {!showReview && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Typography variant="body2" color="text.secondary">
              Pick the diagnosis the AI should use to generate the PDF. Add alternative ICD-10 codes if the same PDF
              should also apply to other diagnoses.
            </Typography>
            <Autocomplete<Diagnosis, false>
              options={primaryOptions}
              loading={isPrimaryFetching}
              filterOptions={(x) => x}
              value={primary}
              onChange={(_e, value) => setPrimary(value)}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              getOptionLabel={(o) => `${o.code} — ${o.display}`}
              inputValue={primaryInput}
              onInputChange={(_e, value) => {
                setPrimaryInput(value);
                debouncePrimary(() => setPrimaryDebounced(value));
              }}
              renderInput={(params) => (
                <TextField
                  {...params}
                  required
                  size="small"
                  label="Diagnosis"
                  placeholder="Start typing to search"
                  error={submitAttempted && !primary}
                  helperText={submitAttempted && !primary ? 'This field is required' : undefined}
                />
              )}
            />
            <Autocomplete<Diagnosis, true>
              multiple
              options={alternateOptions}
              loading={isAlternateFetching}
              filterOptions={(x) => x}
              value={alternates}
              onChange={(_e, value) => setAlternates(value)}
              isOptionEqualToValue={(a, b) => a.code === b.code}
              getOptionLabel={(o) => `${o.code} — ${o.display}`}
              inputValue={alternateInput}
              onInputChange={(_e, value) => {
                setAlternateInput(value);
                debounceAlternate(() => setAlternateDebounced(value));
              }}
              renderTags={(value, getTagProps) =>
                value.map((option, index) => {
                  const { key: _key, ...tagProps } = getTagProps({ index });
                  return <Chip key={option.code} label={`${option.code} — ${option.display}`} {...tagProps} />;
                })
              }
              renderInput={(params) => (
                <TextField
                  {...params}
                  size="small"
                  label="Alternative ICD-10 codes"
                  placeholder="Start typing to search"
                />
              )}
            />
            {errorMsg && (
              <Typography color="error" variant="body2">
                {errorMsg}
              </Typography>
            )}
          </Stack>
        )}

        {showReview && reviewSection && (
          <Box sx={{ mt: 1 }}>
            <PatientEducationSectionsEditor
              sections={[reviewSection]}
              onSectionsChange={(next) => setEditableSection(next[0])}
              disabled={isBusy}
              errorMessage={errorMsg}
              helperText="Edit the content below if needed. Use markdown formatting: "#", "##" for section headers, "- " for bullet points. When you approve, the rendered PDF is what charting will use."
            />
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <RoundedButton onClick={onClose} disabled={isBusy}>
          Cancel
        </RoundedButton>
        {showReview && (
          <RoundedButton
            onClick={() => {
              setGeneratedSection(null);
              setEditableSection(null);
            }}
            disabled={isBusy}
          >
            Back
          </RoundedButton>
        )}
        {!showReview ? (
          <RoundedButton
            variant="contained"
            onClick={() => {
              if (!primary) {
                setSubmitAttempted(true);
                return;
              }
              generateMutation.mutate();
            }}
            disabled={isBusy}
            startIcon={isBusy ? <CircularProgress size={16} /> : <SchoolIcon />}
          >
            Generate
          </RoundedButton>
        ) : (
          <RoundedButton
            variant="contained"
            onClick={() => saveMutation.mutate()}
            disabled={isBusy}
            startIcon={isBusy ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
          >
            Approve & Save
          </RoundedButton>
        )}
      </DialogActions>
    </Dialog>
  );
};
