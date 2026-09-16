import { ReactElement, useMemo } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  NIO_COVERAGE_CATEGORY_LABELS,
  NonInsuranceOrganizationItem,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { updateBillingNonInsuranceOrg } from '../../api/api';
import {
  formatNioAddress,
  nioCoverageSummary,
  nioFormToInput,
  nioItemToFormValues,
  NonInsuranceOrgForm,
} from '../../constants/nonInsuranceOrg';
import { useApiClients } from '../../hooks/useAppClients';
import { EditableSection } from '../claim/EditableSection';
import { Row } from '../Row';
import { NonInsuranceOrgFormFields } from './NonInsuranceOrgFormFields';

export function NonInsuranceOrgDetailSection({
  item,
  onSaved,
}: {
  item: NonInsuranceOrganizationItem;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const defaultValues = useMemo(() => nioItemToFormValues(item), [item]);

  const handleSave = async (data: NonInsuranceOrgForm): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';
    try {
      await updateBillingNonInsuranceOrg(oystehrZambda, { ...nioFormToInput(data), nioId: item.id });
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save changes' });
    }
    await onSaved();
    return null;
  };

  const contactsSummary = item.contacts
    .map((contact) => [contact.name, contact.title].filter(Boolean).join(' — '))
    .join('; ');

  return (
    <EditableSection
      title="Organization Details"
      defaultValues={defaultValues}
      onSave={handleSave}
      editForm={<NonInsuranceOrgFormFields />}
    >
      <Row label="Name" value={item.name} />
      <Row label="Employer" value={item.employer ? 'Yes' : 'No'} />
      <Row label="Address" value={formatNioAddress(item.address)} />
      <Row label="Contacts" value={contactsSummary} hideBorder={item.covers.length === 0} />
      {item.covers.map((coverage, index) => (
        <Row
          key={coverage.category}
          label={`Covers · ${NIO_COVERAGE_CATEGORY_LABELS[coverage.category]}`}
          value={nioCoverageSummary(coverage)}
          hideBorder={index === item.covers.length - 1}
        />
      ))}
    </EditableSection>
  );
}
