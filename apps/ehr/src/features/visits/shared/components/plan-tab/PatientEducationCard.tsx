import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import SchoolIcon from '@mui/icons-material/School';
import {
  Box,
  Checkbox,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  Link,
  Tooltip,
  Typography,
} from '@mui/material';
import { DocumentReference } from 'fhir/r4b';
import { enqueueSnackbar } from 'notistack';
import { FC, useCallback, useEffect, useRef, useState } from 'react';
import { useApiClients } from 'src/hooks/useAppClients';
import { CommunicationDTO, getPresignedURL, PatientEducationLanguage } from 'utils';
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
import { PatientEducationLanguageSelector } from '../PatientEducationLanguageSelector';
import { PatientEducationSectionsEditor } from '../PatientEducationSectionsEditor';

export const PatientEducationCard: FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();
  const [educationModalOpen, setEducationModalOpen] = useState(false);
  const [selectedDiagnoses, setSelectedDiagnoses] = useState<string[]>([]);
  const {
    prefetchAllDiagnoses,
    generateDiagnoses,
    saveFromSections,
    generatedSections,
    clearGeneratedSections,
    isLoading: isEducationLoading,
    isSaving: isEducationSaving,
    error: educationError,
    progress: educationProgress,
    allDiagnoses,
    approvedFor,
    defaultLanguage,
  } = usePatientEducation();
  // Language the clinician chose for this generate run; seeded from the patient's preferred language
  // each time the dialog opens (never auto-generates — the clinician still clicks Generate).
  const [language, setLanguage] = useState<PatientEducationLanguage>(defaultLanguage);
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

  const openEducationPdf = useCallback(
    async (docRefId: string) => {
      // Open the tab synchronously inside the click handler so the browser treats it as
      // a user-initiated popup (otherwise the await chain below can trip popup blockers).
      const newTab = window.open('', '_blank');

      const cachedUrl = getEducationPdfUrl(docRefId);
      if (cachedUrl) {
        if (newTab) newTab.location.href = cachedUrl;
        else window.open(cachedUrl, '_blank');
        return;
      }
      if (!oystehr) {
        newTab?.close();
        return;
      }
      try {
        const docRef = await oystehr.fhir.get<DocumentReference>({
          resourceType: 'DocumentReference',
          id: docRefId,
        });
        const z3Url = docRef.content?.[0]?.attachment?.url;
        if (!z3Url) {
          newTab?.close();
          enqueueSnackbar('Could not find PDF attachment.', { variant: 'error' });
          return;
        }
        const accessToken = oystehr.config.accessToken;
        if (!accessToken) {
          newTab?.close();
          enqueueSnackbar('Auth token unavailable.', { variant: 'error' });
          return;
        }
        const presignedUrl = await getPresignedURL(z3Url, accessToken);
        if (newTab) newTab.location.href = presignedUrl;
        else window.open(presignedUrl, '_blank');
      } catch (err) {
        newTab?.close();
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
                      setLanguage(defaultLanguage);
                      prefetchAllDiagnoses(defaultLanguage);
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
          {allDiagnoses.length > 0 && (
            <Box sx={{ mb: 2 }}>
              <PatientEducationLanguageSelector
                value={language}
                onChange={(next) => {
                  setLanguage(next);
                  // Warm the cache for the newly-selected language so Generate is fast.
                  prefetchAllDiagnoses(next);
                }}
                disabled={isEducationLoading}
                showPreferredSpanishHint={defaultLanguage === 'es'}
              />
            </Box>
          )}
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
                          const next = e.target.checked
                            ? prev.includes(diagnosis.code)
                              ? prev
                              : [...prev, diagnosis.code]
                            : prev.filter((code) => code !== diagnosis.code);
                          // Keep selection in the picker's display order so a previously-edited
                          // diagnosis stays at the same position in the review step when it is
                          // toggled off and back on. Otherwise the re-checked diagnosis jumps to
                          // the end and clinicians perceive their edits as lost.
                          const positionByCode = new Map(allDiagnoses.map((d, i) => [d.code, i]));
                          return [...next].sort((a, b) => (positionByCode.get(a) ?? 0) - (positionByCode.get(b) ?? 0));
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
                      {approvedFor(diagnosis.code, language) && (
                        <Typography component="span" variant="caption" color="success.main" sx={{ ml: 1 }}>
                          (Pre-approved PDF)
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
              const outcome = await generateDiagnoses(selected, language);
              if (outcome === 'completed') {
                resetEducationFlow();
                setEducationModalOpen(false);
              }
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
          <PatientEducationSectionsEditor
            sections={editableSections.length > 0 ? editableSections : (generatedSections ?? [])}
            onSectionsChange={(nextSections) => {
              setEditableSections(nextSections);
              nextSections.forEach((section) => {
                draftSectionsRef.current[section.icdCode] = section;
              });
            }}
            disabled={isEducationSaving}
            errorMessage={educationError}
          />
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
              const sections = editableSections.length > 0 ? editableSections : (generatedSections ?? []);
              const didSave = await saveFromSections(sections, language);
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
