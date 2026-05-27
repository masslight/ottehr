import { useCallback, useRef, useState } from 'react';
import { CommunicationDTO } from 'utils';
import { useAppointmentData, useChartData, useSaveChartData } from '../stores/appointment/appointment.store';
import { useOystehrAPIClient } from './useOystehrAPIClient';

export interface DiagnosisOption {
  code: string;
  display: string;
  isPrimary: boolean;
}

// Presigned download URLs returned by save-patient-education-pdf, keyed by DocumentReference id.
// Lets the UI open a just-approved PDF without a second fetch+presign round-trip.
// Presigned URLs eventually expire; PatientEducationCard falls back to fetching a fresh URL.
const educationPdfUrls = new Map<string, string>();

export function getEducationPdfUrl(docRefId: string): string | undefined {
  return educationPdfUrls.get(docRefId);
}

export function clearEducationPdfUrl(docRefId: string): void {
  educationPdfUrls.delete(docRefId);
}

export interface EducationSection {
  content: string;
  patientTitle: string;
  icdCode: string;
  icdDescription: string;
}

export type GenerateOutcome = 'review';

export interface UsePatientEducationResult {
  prefetchAllDiagnoses: () => void;
  generateForDiagnoses: (diagnoses: DiagnosisOption[]) => Promise<GenerateOutcome | null>;
  saveFromSections: (sections: EducationSection[]) => Promise<boolean>;
  generatedSections: EducationSection[] | null;
  clearGeneratedSections: () => void;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
  progress: string | null;
  allDiagnoses: DiagnosisOption[];
}

export function usePatientEducation(): UsePatientEducationResult {
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  const [generatedSections, setGeneratedSections] = useState<EducationSection[] | null>(null);
  const { chartData, setPartialChartData } = useChartData();
  const { encounter, patient } = useAppointmentData();
  const { mutateAsync: saveChartData } = useSaveChartData();
  const apiClient = useOystehrAPIClient();

  const allDiagnoses: DiagnosisOption[] = (chartData?.diagnosis ?? []).map((d) => ({
    code: d.code,
    display: d.display,
    isPrimary: d.isPrimary,
  }));

  const clearGeneratedSections = useCallback(() => {
    setGeneratedSections(null);
    setError(null);
  }, []);

  const prefetchCacheRef = useRef<Map<string, Promise<EducationSection | null>>>(new Map());

  const prefetchAllDiagnoses = useCallback(() => {
    if (!apiClient) return;
    for (const diagnosis of allDiagnoses) {
      if (prefetchCacheRef.current.has(diagnosis.code)) continue;
      const promise = apiClient
        .generatePatientEducation({
          icdCode: diagnosis.code,
          icdDescription: diagnosis.display,
        })
        .then((result): EducationSection | null =>
          result.content
            ? {
                content: result.content,
                patientTitle: result.patientTitle || diagnosis.display,
                icdCode: diagnosis.code,
                icdDescription: diagnosis.display,
              }
            : null
        )
        .catch((err) => {
          console.error(`Prefetch failed for ${diagnosis.code}:`, err);
          prefetchCacheRef.current.delete(diagnosis.code);
          return null;
        });
      prefetchCacheRef.current.set(diagnosis.code, promise);
    }
  }, [apiClient, allDiagnoses]);

  const savePdfFromSections = useCallback(
    async (sections: EducationSection[]): Promise<void> => {
      if (!apiClient) {
        setError('API client not available.');
        return;
      }

      const titleParts = sections.map((s) => s.patientTitle || s.icdDescription);
      const title = 'Patient Education: ' + titleParts.join(', ');

      const { documentReferenceId, presignedDownloadUrl } = await apiClient.savePatientEducationPdf({
        encounterId: encounter.id!,
        patientId: patient!.id!,
        sections,
        title,
      });

      educationPdfUrls.set(documentReferenceId, presignedDownloadUrl);

      const instructions = chartData?.instructions || [];
      const newInstruction: CommunicationDTO = {
        title,
        educationDocRefId: documentReferenceId,
      };
      const localInstructions = [...instructions, newInstruction];
      setPartialChartData({ instructions: localInstructions });

      try {
        await saveChartData(
          { instructions: [newInstruction] },
          {
            onSuccess: (data) => {
              const saved = (data?.chartData?.instructions || [])[0];
              if (saved) {
                setPartialChartData({
                  instructions: localInstructions.map((item) =>
                    item.resourceId ? item : { ...saved, educationDocRefId: documentReferenceId }
                  ),
                });
              }
            },
            onError: () => {
              setPartialChartData({ instructions });
            },
          }
        );
      } catch (error) {
        setPartialChartData({ instructions });
        clearEducationPdfUrl(documentReferenceId);

        try {
          await apiClient.deletePatientDocument({ documentRefId: documentReferenceId });
        } catch (cleanupError) {
          console.error('Failed to clean up patient education PDF after chart save failure:', cleanupError);
        }

        throw error;
      }
    },
    [apiClient, chartData?.instructions, encounter, patient, saveChartData, setPartialChartData]
  );

  const generateForDiagnoses = useCallback(
    async (selectedDiagnoses: DiagnosisOption[]): Promise<GenerateOutcome | null> => {
      if (selectedDiagnoses.length === 0) {
        setError('No diagnoses selected.');
        return null;
      }
      if (!apiClient) {
        setError('API client not available.');
        return null;
      }

      setIsLoading(true);
      setError(null);
      setProgress(null);
      setGeneratedSections(null);

      try {
        const sections: EducationSection[] = [];
        for (let i = 0; i < selectedDiagnoses.length; i++) {
          const diagnosis = selectedDiagnoses[i];
          setProgress(`Loading ${i + 1} of ${selectedDiagnoses.length}: ${diagnosis.display}...`);

          let sectionPromise = prefetchCacheRef.current.get(diagnosis.code);
          if (!sectionPromise) {
            sectionPromise = apiClient
              .generatePatientEducation({
                icdCode: diagnosis.code,
                icdDescription: diagnosis.display,
              })
              .then((result): EducationSection | null =>
                result.content
                  ? {
                      content: result.content,
                      patientTitle: result.patientTitle || diagnosis.display,
                      icdCode: diagnosis.code,
                      icdDescription: diagnosis.display,
                    }
                  : null
              );
          }
          const section = await sectionPromise;
          if (section) sections.push(section);
        }

        if (sections.length === 0) {
          setError('No content was generated for any of the selected diagnoses.');
          return null;
        }

        setGeneratedSections(sections);
        return 'review';
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        console.error('Patient education generation failed:', err);
        return null;
      } finally {
        setIsLoading(false);
        setProgress(null);
      }
    },
    [apiClient]
  );

  const saveFromSections = useCallback(
    async (sections: EducationSection[]): Promise<boolean> => {
      if (!apiClient) {
        setError('API client not available.');
        return false;
      }
      setIsSaving(true);
      setError(null);
      try {
        await savePdfFromSections(sections);
        setGeneratedSections(null);
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'An unknown error occurred';
        setError(message);
        console.error('Patient education save failed:', err);
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [apiClient, savePdfFromSections]
  );

  return {
    prefetchAllDiagnoses,
    generateForDiagnoses,
    saveFromSections,
    generatedSections,
    clearGeneratedSections,
    isLoading,
    isSaving,
    error,
    progress,
    allDiagnoses,
  };
}
