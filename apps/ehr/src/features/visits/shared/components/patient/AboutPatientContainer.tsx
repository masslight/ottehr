import { Box } from '@mui/material';
import { FC, Fragment, ReactNode, useMemo } from 'react';
import { PATIENT_RECORD_CONFIG } from 'utils';
import { InsuranceCardAiSuggestionRow } from './InsuranceCardAiSuggestionRow';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';
import { CardFieldSuggestion } from './useInsuranceCardExtraction';
import { buildPhotoIdOptionSuggestion, usePhotoIdExtraction } from './usePhotoIdExtraction';

const { patientSummary } = PATIENT_RECORD_CONFIG.FormFields;
const FIELD_KEYS = Object.values(patientSummary.items).map((item) => item.key);

interface AboutPatientContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
  /**
   * Optional content rendered right-aligned in the section header, next to the "Patient summary"
   * title (e.g. the visit page's compact photo-ID card thumbnail). Omitted on the standalone
   * patient-info page.
   */
  headerSlot?: ReactNode;
}

export const AboutPatientContainer: FC<AboutPatientContainerProps> = ({
  isLoading,
  patientId,
  encounterId,
  headerSlot,
}) => {
  const { hiddenFields, requiredFields } = usePatientRecordFormSection({
    formSection: patientSummary,
  });

  // Photo-ID OCR suggestions. The extraction is stored on the photo-ID front DocumentReference
  // by the extract-photo-id zambda; this only reads it. Keyed by form field key so each row
  // mounts directly under the field it suggests for.
  const { fields: photoIdFields } = usePhotoIdExtraction(patientId);
  const photoIdSuggestions = useMemo(() => {
    const suggestions: Record<string, CardFieldSuggestion> = {};
    if (!photoIdFields) return suggestions;
    const addTextSuggestion = (item: { key: string } | undefined, value: string | null): void => {
      if (item && value) suggestions[item.key] = { display: value, formValue: value, comparable: value };
    };
    addTextSuggestion(patientSummary.items.firstName, photoIdFields.firstName);
    addTextSuggestion(patientSummary.items.middleName, photoIdFields.middleName);
    addTextSuggestion(patientSummary.items.lastName, photoIdFields.lastName);
    addTextSuggestion(patientSummary.items.suffix, photoIdFields.suffix);
    // The date field stores YYYY-MM-DD — the exact format the extraction uses.
    addTextSuggestion(patientSummary.items.birthDate, photoIdFields.dateOfBirth);
    const birthSexItem = patientSummary.items.birthSex;
    const sexSuggestion = buildPhotoIdOptionSuggestion(
      photoIdFields.sex,
      birthSexItem && 'options' in birthSexItem ? birthSexItem.options : undefined
    );
    if (birthSexItem && sexSuggestion) suggestions[birthSexItem.key] = sexSuggestion;
    return suggestions;
  }, [photoIdFields]);

  const saveButton = <SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />;
  return (
    <PatientRecordFormSection
      formSection={patientSummary}
      titleWidget={
        headerSlot ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {headerSlot}
            {saveButton}
          </Box>
        ) : (
          saveButton
        )
      }
    >
      {Object.values(patientSummary.items).map((item) => {
        const suggestion = hiddenFields.includes(item.key) ? undefined : photoIdSuggestions[item.key];
        return (
          <Fragment key={item.key}>
            <PatientRecordFormField
              item={item}
              hiddenFormFields={hiddenFields}
              requiredFormFields={requiredFields}
              isLoading={isLoading}
            />
            {suggestion && (
              <InsuranceCardAiSuggestionRow
                fieldKey={item.key}
                suggestedDisplay={suggestion.display}
                suggestedFormValue={suggestion.formValue}
                suggestedComparable={suggestion.comparable}
              />
            )}
          </Fragment>
        );
      })}
    </PatientRecordFormSection>
  );
};
