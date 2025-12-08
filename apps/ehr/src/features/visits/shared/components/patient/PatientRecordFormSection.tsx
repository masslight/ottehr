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
  const { title, linkId, isHidden } = usePatientRecordFormSection({ formSection, ordinal });
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
  ordinal?: number;
}
export const usePatientRecordFormSection = ({ formSection, ordinal }: UseFormSectionParams): FormSectionDetails => {
  let linkId = formSection.linkId;
  if (ordinal !== undefined && Array.isArray(formSection.linkId)) {
    linkId = formSection.linkId[ordinal];
  }
  if (typeof linkId !== 'string') {
    throw new Error(
      'Form section linkId must be a string when used with useFormSection. Did you forget to pass ordinal?'
    );
  }
  const { title, items, hiddenFields, requiredFields } = formSection;
  const isHidden = Array.isArray(linkId)
    ? PATIENT_RECORD_CONFIG.hiddenFormSections.some((section) => linkId.includes(section))
    : PATIENT_RECORD_CONFIG.hiddenFormSections.includes(linkId);
  let itemsToUse = items;
  if (Array.isArray(items) && ordinal !== undefined) {
    itemsToUse = items[ordinal];
  }

  const validatedItemsToUse = FormFieldItemRecordSchema.safeParse(itemsToUse).data;

  if (!validatedItemsToUse) {
    throw new Error('Form section items could not be validated. Did you forget to pass ordinal?');
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
