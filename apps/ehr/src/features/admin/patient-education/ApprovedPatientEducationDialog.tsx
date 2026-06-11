import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SchoolIcon from '@mui/icons-material/School';
import {
  Box,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Radio,
  RadioGroup,
  Stack,
  Typography,
} from '@mui/material';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { enqueueSnackbar } from 'notistack';
import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { PatientEducationSectionsEditor } from 'src/features/visits/shared/components/PatientEducationSectionsEditor';
import { useOystehrAPIClient } from 'src/features/visits/shared/hooks/useOystehrAPIClient';
import { EducationSection, generateCombinedPdf } from 'src/features/visits/shared/hooks/usePatientEducation';
import { ApprovedPatientEducationIcdCode, getApiError, PatientEducationLanguage } from 'utils';
import { AlternateDiagnosesInput, PrimaryDiagnosisInput } from './IcdDiagnosisInputs';
import { APPROVED_PATIENT_EDUCATION_QUERY_KEY } from './PatientEducationAdminPage';
import { Icd10Option } from './useIcd10SearchInput';

type DialogProps = {
  open: boolean;
  onClose: () => void;
};

export const ApprovedPatientEducationDialog: FC<DialogProps> = ({ open, onClose }) => {
  const apiClient = useOystehrAPIClient();
  const queryClient = useQueryClient();

  const [primary, setPrimary] = useState<Icd10Option | null>(null);
  const [alternates, setAlternates] = useState<Icd10Option[]>([]);
  const [language, setLanguage] = useState<PatientEducationLanguage>('en');

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
        language,
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
      setErrorMsg(getApiError({ error: err, defaultError: 'Failed to generate patient education.' }));
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
      return apiClient.saveApprovedPatientEducation({ pdfBase64, title, icdCodes, language });
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
      setErrorMsg(getApiError({ error: err, defaultError: 'Failed to save approved patient education.' }));
    },
  });

  const isBusy = generateMutation.isPending || saveMutation.isPending;
  const showReview = !!generatedSection;
  const reviewSection = editableSection ?? generatedSection;
  const primaryErrorMessage = submitAttempted && !primary ? 'This field is required' : undefined;

  return (
    <Dialog open={open} onClose={() => !isBusy && onClose()} maxWidth="md" fullWidth>
      <DialogTitle>{showReview ? 'Review Patient Education' : 'New Approved Patient Education'}</DialogTitle>
      <DialogContent>
        {!showReview && (
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Box>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 0.5 }}>
                Language
              </Typography>
              <RadioGroup
                row
                value={language}
                onChange={(e) => setLanguage(e.target.value as PatientEducationLanguage)}
              >
                <FormControlLabel value="en" control={<Radio size="small" disabled={isBusy} />} label="English" />
                <FormControlLabel value="es" control={<Radio size="small" disabled={isBusy} />} label="Español" />
              </RadioGroup>
              <Divider sx={{ mt: 1 }} />
            </Box>
            <Typography variant="body2" color="text.secondary">
              Pick the diagnosis the AI should use to generate the PDF. Add alternative ICD-10 codes if the same PDF
              should also apply to other diagnoses. A code can have separate English and Spanish approved PDFs.
            </Typography>
            <PrimaryDiagnosisInput value={primary} onChange={setPrimary} required errorMessage={primaryErrorMessage} />
            <AlternateDiagnosesInput value={alternates} onChange={setAlternates} primary={primary} />
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
              helperText='Edit the content below if needed. Use markdown formatting: "#", "##" for section headers, "- " for bullet points. When you approve, the rendered PDF is what charting will use.'
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
