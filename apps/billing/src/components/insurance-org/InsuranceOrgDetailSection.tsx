import { ReactElement, useMemo } from 'react';
import { getApiError } from 'utils/lib/helpers/oystehrApi';
import {
  INSURANCE_ORG_CLAIM_FORM_LABELS,
  INSURANCE_ORG_SUBMISSION_MECHANISM_LABELS,
  INSURANCE_ORG_TYPE_LABELS,
  InsuranceOrganizationItem,
} from 'utils/lib/types/data/billing/insurance-org.types';
import { updateBillingInsuranceOrg } from '../../api/api';
import {
  formatInsuranceOrgAddress,
  InsuranceOrgForm,
  insuranceOrgFormToInput,
  insuranceOrgItemToFormValues,
} from '../../constants/insuranceOrg';
import { useApiClients } from '../../hooks/useAppClients';
import { EditableSection } from '../claim/EditableSection';
import { Row } from '../Row';
import { InsuranceOrgFormFields } from './InsuranceOrgFormFields';

export function InsuranceOrgDetailSection({
  item,
  onSaved,
}: {
  item: InsuranceOrganizationItem;
  onSaved: () => Promise<void>;
}): ReactElement {
  const { oystehrZambda } = useApiClients();
  const defaultValues = useMemo(() => insuranceOrgItemToFormValues(item), [item]);

  const handleSave = async (data: InsuranceOrgForm): Promise<string | null> => {
    if (!oystehrZambda) return 'Client not ready';
    try {
      await updateBillingInsuranceOrg(oystehrZambda, { ...insuranceOrgFormToInput(data), insuranceOrgId: item.id });
    } catch (err) {
      return getApiError({ error: err, defaultError: 'Failed to save changes' });
    }
    await onSaved();
    return null;
  };

  const insuranceTypesSummary = item.insuranceTypes.map((type) => INSURANCE_ORG_TYPE_LABELS[type]).join(', ');

  return (
    <EditableSection
      title="Organization Details"
      defaultValues={defaultValues}
      onSave={handleSave}
      editForm={<InsuranceOrgFormFields />}
    >
      <Row label="Name" value={item.name} />
      <Row label="Id" value={item.orgId} />
      <Row label="Insurance Type" value={insuranceTypesSummary} />
      <Row label="Submission Mechanism" value={INSURANCE_ORG_SUBMISSION_MECHANISM_LABELS[item.submissionMechanism]} />
      {item.submissionMechanism === 'email' && (
        <Row label="Email Address" value={item.submissionDetails?.email ?? ''} />
      )}
      {item.submissionMechanism === 'portal' && (
        <>
          <Row label="Portal URL" value={item.submissionDetails?.portalUrl ?? ''} />
          <Row label="Portal Details" value={item.submissionDetails?.portalDetails ?? ''} />
        </>
      )}
      {item.submissionMechanism === 'fax' && <Row label="Fax Number" value={item.submissionDetails?.faxNumber ?? ''} />}
      {item.submissionMechanism === 'mail' && (
        <Row label="Mail Address" value={formatInsuranceOrgAddress(item.submissionDetails?.mailAddress)} />
      )}
      <Row label="Accepted Claim Form" value={INSURANCE_ORG_CLAIM_FORM_LABELS[item.acceptedClaimForm]} />
      <Row label="Note" value={item.note ?? ''} hideBorder />
    </EditableSection>
  );
}
