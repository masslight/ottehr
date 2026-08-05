import { Box } from '@mui/material';
import { FC, ReactElement, useEffect, useMemo } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Row } from 'src/components/layout';
import { PATIENT_RECORD_CONFIG } from 'utils';
import { InsuranceCardAiSuggestionRow } from './InsuranceCardAiSuggestionRow';
import PatientRecordFormField from './PatientRecordFormField';
import PatientRecordFormSection, { usePatientRecordFormSection } from './PatientRecordFormSection';
import { SectionSaveButton } from './SectionSaveButton';
import { CardFieldSuggestion } from './useInsuranceCardExtraction';
import { buildPhotoIdOptionSuggestion, usePhotoIdExtraction } from './usePhotoIdExtraction';

const contactSection = PATIENT_RECORD_CONFIG.FormFields.patientContactInformation;

const FIELD_KEYS = Object.values(contactSection.items).map((item) => item.key);

interface ContactContainerProps {
  isLoading: boolean;
  patientId?: string;
  encounterId?: string;
}

export const ContactContainer: FC<ContactContainerProps> = ({ isLoading, patientId, encounterId }) => {
  const {
    items: contact,
    hiddenFields: hiddenFormFields,
    requiredFields: requiredFormFields,
  } = usePatientRecordFormSection({
    formSection: contactSection,
  });

  const { setValue } = useFormContext();
  const noEmailChecked = useWatch({ name: 'patient-no-email' });

  // Photo-ID OCR suggestions for the address fields. The extraction is stored on the photo-ID
  // front DocumentReference by the extract-photo-id zambda; this only reads it. Keyed by form
  // field key so each row mounts directly under the field it suggests for.
  const { fields: photoIdFields } = usePhotoIdExtraction(patientId);
  const photoIdSuggestions = useMemo(() => {
    const suggestions: Record<string, CardFieldSuggestion> = {};
    if (!photoIdFields) return suggestions;
    const addTextSuggestion = (item: { key: string }, value: string | null): void => {
      if (value) suggestions[item.key] = { display: value, formValue: value, comparable: value };
    };
    addTextSuggestion(contactSection.items.streetAddress, photoIdFields.addressLine1);
    addTextSuggestion(contactSection.items.city, photoIdFields.addressCity);
    addTextSuggestion(contactSection.items.zip, photoIdFields.addressZip);
    const stateItem = contactSection.items.state;
    const stateSuggestion = buildPhotoIdOptionSuggestion(
      photoIdFields.addressState,
      'options' in stateItem ? stateItem.options : undefined
    );
    if (stateSuggestion) suggestions[stateItem.key] = stateSuggestion;
    return suggestions;
  }, [photoIdFields]);

  // Always returns an element (empty fragment when there is nothing to suggest) because the
  // section's children prop does not accept nulls.
  const renderPhotoIdSuggestion = (fieldKey: string): ReactElement => {
    const suggestion = hiddenFormFields.includes(fieldKey) ? undefined : photoIdSuggestions[fieldKey];
    if (!suggestion) return <></>;
    return (
      <InsuranceCardAiSuggestionRow
        fieldKey={fieldKey}
        suggestedDisplay={suggestion.display}
        suggestedFormValue={suggestion.formValue}
        suggestedComparable={suggestion.comparable}
      />
    );
  };

  useEffect(() => {
    if (noEmailChecked) {
      setValue('patient-email', '', { shouldDirty: true });
    }
  }, [noEmailChecked, setValue]);

  const effectiveRequiredFormFields = useMemo(
    () => (noEmailChecked ? (requiredFormFields ?? []).filter((k) => k !== 'patient-email') : requiredFormFields),
    [noEmailChecked, requiredFormFields]
  );

  return (
    <PatientRecordFormSection
      formSection={contactSection}
      titleWidget={<SectionSaveButton fieldKeys={FIELD_KEYS} patientId={patientId} encounterId={encounterId} />}
    >
      <PatientRecordFormField
        item={contact.streetAddress}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      {renderPhotoIdSuggestion(contact.streetAddress.key)}
      <PatientRecordFormField
        item={contact.addressLine2}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      <Row label="City, State, ZIP" required>
        <Box sx={{ display: 'flex', gap: 2 }}>
          <PatientRecordFormField
            item={contact.city}
            hiddenFormFields={hiddenFormFields}
            requiredFormFields={requiredFormFields}
            isLoading={isLoading}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={contact.state}
            hiddenFormFields={hiddenFormFields}
            requiredFormFields={requiredFormFields}
            isLoading={isLoading}
            omitRowWrapper
          />
          <PatientRecordFormField
            item={contact.zip}
            hiddenFormFields={hiddenFormFields}
            requiredFormFields={requiredFormFields}
            isLoading={isLoading}
            omitRowWrapper
          />
        </Box>
      </Row>
      {/* City/state/ZIP share one visual Row, so their suggestion rows stack directly below it. */}
      {renderPhotoIdSuggestion(contact.city.key)}
      {renderPhotoIdSuggestion(contact.state.key)}
      {renderPhotoIdSuggestion(contact.zip.key)}
      <PatientRecordFormField
        item={contact.email}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={effectiveRequiredFormFields}
        isLoading={isLoading}
      />
      <PatientRecordFormField
        item={contact.noEmail}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      <PatientRecordFormField
        item={contact.phone}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
      <PatientRecordFormField
        item={contact.preferredCommunicationMethod}
        hiddenFormFields={hiddenFormFields}
        requiredFormFields={requiredFormFields}
        isLoading={isLoading}
      />
    </PatientRecordFormSection>
  );
};
