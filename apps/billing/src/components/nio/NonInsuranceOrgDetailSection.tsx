import { ReactElement, useMemo } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  NIO_COVERAGE_CATEGORY_LABELS,
  NonInsuranceOrganizationItem,
} from 'utils/lib/types/data/billing/non-insurance-org.types';
import { formatCurrency } from 'utils/lib/utils/convert';
import { updateBillingNonInsuranceOrg } from '../../api/api';
import { isDemoNioId, loadNioExtras, NIO_ORG_TYPE_LABELS, saveNioExtras } from '../../constants/nioPrototype';
import {
  formatNioAddress,
  nioCoverageSummary,
  nioFormToExtras,
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
    // Demo rows have no backing Organization — only their prototype extras are saved.
    if (!isDemoNioId(item.id)) {
      try {
        await updateBillingNonInsuranceOrg(oystehrZambda, { ...nioFormToInput(data), nioId: item.id });
      } catch (err) {
        return getApiError({ error: err, defaultError: 'Failed to save changes' });
      }
    }
    saveNioExtras(item.id, nioFormToExtras(data));
    await onSaved();
    return null;
  };

  const contactsSummary = item.contacts
    .map((contact) => [contact.name, contact.title].filter(Boolean).join(' — '))
    .join('; ');

  const extras = loadNioExtras(item.id);
  const typeLabel = extras?.type ? NIO_ORG_TYPE_LABELS[extras.type] : item.employer ? 'Employer' : '—';
  const isDocRequestor = extras?.type === 'document-requestor';
  const pricingSummary = extras?.pricing
    ? `${formatCurrency(extras.pricing.perClaim)} per claim + ${formatCurrency(extras.pricing.perDocument)} ` +
      `per document + ${formatCurrency(extras.pricing.perPage)} per page`
    : '—';

  return (
    <EditableSection
      title="Organization Details"
      defaultValues={defaultValues}
      onSave={handleSave}
      editForm={<NonInsuranceOrgFormFields />}
    >
      <Row label="Name" value={item.name} />
      <Row label="Type" value={typeLabel} />
      <Row label="Notes" value={extras?.notes ?? ''} />
      <Row label="Address" value={formatNioAddress(item.address)} />
      <Row label="Contacts" value={contactsSummary} hideBorder={!isDocRequestor && item.covers.length === 0} />
      {isDocRequestor ? (
        <Row label="Document Invoice Pricing" value={pricingSummary} hideBorder />
      ) : (
        item.covers.map((coverage, index) => (
          <Row
            key={coverage.category}
            label={`Covers · ${NIO_COVERAGE_CATEGORY_LABELS[coverage.category]}`}
            value={nioCoverageSummary(coverage)}
            hideBorder={index === item.covers.length - 1}
          />
        ))
      )}
    </EditableSection>
  );
}
