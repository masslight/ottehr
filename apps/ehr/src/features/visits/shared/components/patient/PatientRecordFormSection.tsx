import { FC, ReactElement } from 'react';
import { Section } from 'src/components/layout';
import { FormFieldItemRecord, FormFieldItemRecordSchema, FormFieldSection, PATIENT_RECORD_CONFIG } from 'utils';

interface PatientRecordFormSectionInput {
  formSection: FormFieldSection;
  titleWidget?: ReactElement;
  children?: ReactElement | ReactElement[];
  ordinal?: number;
}
const PatientRecordFormSection: FC<PatientRecordFormSectionInput> = ({
  formSection,
  children,
  titleWidget,
  ordinal,
}) => {
  const { title, linkId, isHidden } = usePatientRecordFormSection({ formSection, index: ordinal });
  if (isHidden) {
    return null;
  }
  return (
    <Section title={title} id={linkId} titleWidget={titleWidget}>
      {children}
    </Section>
  );
};

interface FormSectionDetails {
  title: string;
  isHidden: boolean;
  items: FormFieldItemRecord;
  hiddenFields: string[];
  requiredFields: string[];
  linkId: string;
}
interface UseFormSectionParams {
  formSection: FormFieldSection;
  index?: number;
}
export const usePatientRecordFormSection = ({ formSection, index }: UseFormSectionParams): FormSectionDetails => {
  let linkId = formSection.linkId;
  if (index !== undefined && Array.isArray(formSection.linkId)) {
    linkId = formSection.linkId[index];
  }
  if (typeof linkId !== 'string') {
    throw new Error(
      'Form section linkId must be a string when used with useFormSection. Did you forget to pass index?'
    );
  }
  const { title, items, hiddenFields, requiredFields } = formSection;
  const isHidden = Array.isArray(linkId)
    ? PATIENT_RECORD_CONFIG.hiddenFormSections.some((section) => linkId.includes(section))
    : PATIENT_RECORD_CONFIG.hiddenFormSections.includes(linkId);
  let itemsToUse = items;
  if (Array.isArray(items) && index !== undefined) {
    itemsToUse = items[index];
  }

  const validatedItemsToUse = FormFieldItemRecordSchema.safeParse(itemsToUse).data;

  if (!validatedItemsToUse) {
    throw new Error('Form section items could not be validated. Did you forget to pass index?');
  }

  return {
    title,
    linkId,
    isHidden,
    items: validatedItemsToUse,
    hiddenFields: hiddenFields ?? [],
    requiredFields: requiredFields ?? [],
  };
};

export default PatientRecordFormSection;
