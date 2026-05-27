import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SchoolIcon from '@mui/icons-material/School';
import {
  Alert,
  Box,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  FormControlLabel,
  Link,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DocumentReference } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { CommunicationDTO, getPresignedURL } from 'utils';
import { AccordionCard } from '../../../../../components/AccordionCard';
import { ActionsList } from '../../../../../components/ActionsList';
import { DeleteIconButton } from '../../../../../components/DeleteIconButton';
import { RoundedButton } from '../../../../../components/RoundedButton';
import { useGetAppointmentAccessibility } from '../../hooks/useGetAppointmentAccessibility';
import {
  clearEducationPdfUrl,
  EducationSection,
  getEducationPdfUrl,
  usePatientEducation,
} from '../../hooks/usePatientEducation';
import { useChartData, useDeleteChartData } from '../../stores/appointment/appointment.store';

export const PatientEducationCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const {
    prefetchAllDiagnoses,
    generateForDiagnoses,
    saveFromSections,
    generatedSections,
    clearGeneratedSections,
    isLoading: isEducationLoading,
    isSaving: isEducationSaving,
    error: educationError,
    progress: educationProgress,
    allDiagnoses,
  } = usePatientEducation();
  const [editableSections, setEditableSections] = useState<EducationSection[]>([]);
  const draftSectionsRef = useRef<Record<string, EducationSection>>({});
  const { chartData, setPartialChartData } = useChartData();
  const { mutate: deleteChartData } = useDeleteChartData();
  const educationItems = (chartData?.instructions || []).filter((item) => item.educationDocRefId);
  const { oystehr } = useApiClients();

  useEffect(() => {
    if (!generatedSections) return;

    setEditableSections(
      generatedSections.map((section) => {
        return draftSectionsRef.current[section.icdCode] ?? section;
      })
    );
  }, [generatedSections]);

  const resetEducationFlow = useCallback(() => {
    draftSectionsRef.current = {};
    setEditableSections([]);
    setSelectedDiagnoses([]);
    clearGeneratedSections();
  }, [clearGeneratedSections]);

  const updateSectionDraft = useCallback(
    (index: number, updates: Partial<EducationSection>) => {
      setEditableSections((prev) => {
        const sourceSections = prev.length > 0 ? prev : generatedSections ?? [];
        const nextSections = sourceSections.map((section, sectionIndex) =>
          sectionIndex === index ? { ...section, ...updates } : section
        );
        const updatedSection = nextSections[index];
        if (updatedSection) {
          draftSectionsRef.current[updatedSection.icdCode] = updatedSection;
        }
        return nextSections;
      });
    },
    [generatedSections]
  );

  const openEducationPdf = useCallback(
    async (docRefId: string) => {
      const cachedUrl = getEducationPdfUrl(docRefId);
      if (cachedUrl) {
        window.open(cachedUrl, '_blank');
        return;
      }
      if (!oystehr) return;
      try {
        const docRef = await oystehr.fhir.get<DocumentReference>({
          resourceType: 'DocumentReference',
          id: docRefId,
        });
        const z3Url = docRef.content?.[0]?.attachment?.url;
        if (!z3Url) {
          enqueueSnackbar('Could not find PDF attachment.', { variant: 'error' });
          return;
        }
        const accessToken = oystehr.config.accessToken;
        if (!accessToken) {
          enqueueSnackbar('Auth token unavailable.', { variant: 'error' });
          return;
        }
        const presignedUrl = await getPresignedURL(z3Url, accessToken);
        window.open(presignedUrl, '_blank');
      } catch (err) {
        console.error('Failed to open education PDF:', err);
        enqueueSnackbar('Failed to open education PDF.', { variant: 'error' });
      }
    },
    [oystehr]
  );

  const onDelete = (value: CommunicationDTO): void => {
    const prevInstructions = chartData?.instructions || [];
    setPartialChartData(
      {
        instructions: prevInstructions.filter((item) => item.resourceId !== value.resourceId),
      },
      { invalidateQueries: false }
    );
    deleteChartData(
      {
        instructions: [value],
      },
      {
        onSuccess: () => {
          if (value.educationDocRefId) clearEducationPdfUrl(value.educationDocRefId);
        },
        onError: () => {
          enqueueSnackbar('An error has occurred while deleting patient education. Please try again.', {
            variant: 'error',
          });
          setPartialChartData({ instructions: prevInstructions });
        },
      }
    );
  };

  return (
    <>
      <AccordionCard
        label="Patient Education"
        collapsed={collapsed}
        onSwitch={() => setCollapsed((prevState) => !prevState)}
      >
        <Box sx={{ p: 2, display: 'flex', flexDirection: 'column', gap: 2 }}>
          {!isReadOnly && (
            <Box sx={{ display: 'flex', gap: 2, alignItems: 'center' }}>
              <Tooltip
                title={
                  allDiagnoses.length === 0
                    ? 'Add at least one diagnosis on the Assessment tab to generate patient education.'
                    : ''
                }
              >
                <span>
                  <RoundedButton
                    onClick={() => {
                      resetEducationFlow();
                      setSelectedDiagnoses(allDiagnoses.map((d) => d.code));
                      prefetchAllDiagnoses();
                      setEducationModalOpen(true);
                    }}
                    disabled={allDiagnoses.length === 0 || isEducationLoading}
                    startIcon={isEducationLoading ? <CircularProgress size={16} /> : <SchoolIcon />}
                  >
                    Patient Education
                  </RoundedButton>
                </span>
              </Tooltip>
              {(educationError || educationProgress) && (
                <Typography color={educationError ? 'error' : 'text.secondary'} variant="body2">
                  {educationError || educationProgress}
                </Typography>
              )}
            </Box>
          )}

          {educationItems.length > 0 && (
            <ActionsList
              data={educationItems}
              getKey={(value, index) => value.resourceId || index}
              renderItem={(value) => (
                <Link
                  component="button"
                  onClick={() => openEducationPdf(value.educationDocRefId!)}
                  sx={{ display: 'flex', alignItems: 'center', gap: 0.5, textAlign: 'left' }}
                >
                  <PictureAsPdfIcon fontSize="small" color="error" />
                  <Typography fontWeight={600} color="primary">
                    {value.title || 'Patient Education'}
                  </Typography>
                </Link>
              )}
              renderActions={
                isReadOnly
                  ? undefined
                  : (value) => <DeleteIconButton disabled={!value.resourceId} onClick={() => onDelete(value)} />
              }
              divider
              gap={1}
            />
          )}

          {educationItems.length === 0 && isReadOnly && (
            <Typography color="secondary.light">No patient education provided</Typography>
          )}
        </Box>
      </AccordionCard>

      <Dialog
        open={educationModalOpen && !generatedSections}
        onClose={() => !isEducationLoading && setEducationModalOpen(false)}
        maxWidth="sm"
        fullWidth
      >
        <DialogTitle>Generate Patient Education Materials</DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Select the diagnoses to include in the patient education document.
          </Typography>
          {allDiagnoses.length === 0 ? (
            <Typography color="text.secondary">
              No diagnoses on this visit. Add diagnoses in the Assessment tab first.
            </Typography>
          ) : (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
              {allDiagnoses.map((diagnosis) => (
                <FormControlLabel
                  key={diagnosis.code}
                  control={
                    <Checkbox
                      checked={selectedDiagnoses.includes(diagnosis.code)}
                      onChange={(e) => {
                        setSelectedDiagnoses((prev) => {
                          if (e.target.checked) {
                            return prev.includes(diagnosis.code) ? prev : [...prev, diagnosis.code];
                          }
                          return prev.filter((code) => code !== diagnosis.code);
                        });
                      }}
                      disabled={isEducationLoading}
                    />
                  }
                  label={
                    <Typography variant="body2">
                      <strong>{diagnosis.code}</strong> — {diagnosis.display}
                      {diagnosis.isPrimary && (
                        <Typography component="span" variant="caption" color="primary" sx={{ ml: 1 }}>
                          (Primary)
                        </Typography>
                      )}
                    </Typography>
                  }
                />
              ))}
            </Box>
          )}
          {educationProgress && (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mt: 2 }}>
              <CircularProgress size={16} />
              <Typography variant="body2" color="text.secondary">
                {educationProgress}
              </Typography>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <RoundedButton onClick={() => setEducationModalOpen(false)} disabled={isEducationLoading}>
            Cancel
          </RoundedButton>
          <RoundedButton
            variant="contained"
            onClick={async () => {
              const selected = selectedDiagnoses
                .map((code) => allDiagnoses.find((diagnosis) => diagnosis.code === code))
                .filter((diagnosis): diagnosis is NonNullable<typeof diagnosis> => !!diagnosis);
              await generateForDiagnoses(selected);
            }}
            disabled={selectedDiagnoses.length === 0 || isEducationLoading || isEducationSaving}
            startIcon={isEducationLoading || isEducationSaving ? <CircularProgress size={16} /> : <SchoolIcon />}
          >
            Generate ({selectedDiagnoses.length})
          </RoundedButton>
        </DialogActions>
      </Dialog>

      <Dialog
        open={!!generatedSections}
        onClose={() => !isEducationSaving && clearGeneratedSections()}
        maxWidth="md"
        fullWidth
      >
        <DialogTitle component={Typography} variant="h4" color="primary.dark" sx={{ pb: 2 }}>
          Review Patient Education Materials
        </DialogTitle>
        <DialogContent>
          <Alert severity="warning" sx={{ mb: 2 }}>
            This content was generated by AI and may contain mistakes. Review it carefully before approving.
          </Alert>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            Review and edit the content below. Use markdown formatting: "##" for section headers, "- " for bullet
            points.
          </Typography>
          {(editableSections.length > 0 ? editableSections : generatedSections ?? []).map((section, idx) => (
            <Box key={section.icdCode} sx={{ mb: idx < (generatedSections?.length ?? 1) - 1 ? 3 : 0 }}>
              <TextField
                label="Title"
                value={section.patientTitle}
                onChange={(e) => updateSectionDraft(idx, { patientTitle: e.target.value })}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
                disabled={isEducationSaving}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mb: 0.5, display: 'block' }}>
                {section.icdCode} — {section.icdDescription}
              </Typography>
              <TextField
                value={section.content}
                onChange={(e) => updateSectionDraft(idx, { content: e.target.value })}
                fullWidth
                multiline
                minRows={10}
                maxRows={20}
                disabled={isEducationSaving}
                sx={{ '& .MuiInputBase-root': { fontFamily: 'monospace', fontSize: 13 } }}
              />
              {idx < (generatedSections?.length ?? 1) - 1 && <Divider sx={{ mt: 2 }} />}
            </Box>
          ))}
          {educationError && (
            <Typography color="error" variant="body2" sx={{ mt: 1 }}>
              {educationError}
            </Typography>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Box sx={{ mr: 'auto', display: 'flex', gap: 1 }}>
            <RoundedButton
              onClick={() => {
                resetEducationFlow();
                setEducationModalOpen(false);
              }}
              disabled={isEducationSaving}
            >
              Cancel
            </RoundedButton>
            <RoundedButton
              onClick={() => {
                clearGeneratedSections();
              }}
              disabled={isEducationSaving}
            >
              Back
            </RoundedButton>
          </Box>
          <RoundedButton
            variant="contained"
            onClick={async () => {
              const sections = editableSections.length > 0 ? editableSections : generatedSections ?? [];
              const didSave = await saveFromSections(sections);
              if (didSave) {
                resetEducationFlow();
                setEducationModalOpen(false);
              }
            }}
            disabled={isEducationSaving}
            startIcon={isEducationSaving ? <CircularProgress size={16} /> : <PictureAsPdfIcon />}
          >
            Create PDF
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </>
  );
};
