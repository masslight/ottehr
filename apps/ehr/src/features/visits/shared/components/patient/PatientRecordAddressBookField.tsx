import { ComponentProps, FC } from 'react';
import { useFormContext } from 'react-hook-form';
import { Row } from 'src/components/layout/Row';
import { addressBookContactLabel } from 'src/features/address-book/AddressBookDialog';
import { AddressBookPicker } from 'src/features/address-book/AddressBookPicker';
import { evaluateFieldTriggers } from 'utils/lib/config-helpers/patient-record';
import { AddressBookContact } from 'utils/lib/types/data/address-book';
import PatientRecordFormField from './PatientRecordFormField';

const organizationFieldValue = (contact: AddressBookContact): string =>
  contact.organizationName || addressBookContactLabel(contact);

type PatientRecordAddressBookFieldProps = Pick<
  ComponentProps<typeof PatientRecordFormField>,
  'item' | 'isLoading' | 'hiddenFormFields' | 'requiredFormFields'
> & {
  tag: string;
  /** What the pick writes into this field; defaults to the contact's organization. */
  fieldValue?: (contact: AddressBookContact) => string;
  /** Fills the section's other fields from the picked contact. */
  onSelect: (contact: AddressBookContact) => void;
};

/** A section's organization field backed by the directory; picking a contact fills the fields around it. */
export const PatientRecordAddressBookField: FC<PatientRecordAddressBookFieldProps> = ({
  tag,
  fieldValue,
  onSelect,
  ...props
}) => {
  const { watch } = useFormContext();
  const { item, isLoading, hiddenFormFields, requiredFormFields } = props;
  const triggeredEffects = item && evaluateFieldTriggers(item, watch(), item.enableBehavior);
  // The picker has no disabled state, so whatever the generic field would hide or disable stays generic.
  if (
    !item ||
    item.type !== 'string' ||
    isLoading ||
    hiddenFormFields?.includes(item.key) ||
    triggeredEffects?.enabled === false
  ) {
    return <PatientRecordFormField {...props} />;
  }
  const { key, label } = item;
  return (
    <Row label={label} inputId={key} required={requiredFormFields?.includes(key) || triggeredEffects?.required}>
      <AddressBookPicker
        name={key}
        variant="standard"
        tag={tag}
        fieldValue={fieldValue ?? organizationFieldValue}
        onSelect={onSelect}
      />
    </Row>
  );
};
