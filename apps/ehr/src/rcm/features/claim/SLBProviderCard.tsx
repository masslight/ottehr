import React, { FC, useMemo } from 'react';
import { getSelectors } from '../../../shared/store/getSelectors';
import { useClaimStore } from '../../state';
import { ClaimListCard } from './ClaimListCard';
import { SLBProviderModal } from './modals';

export const SLBProviderCard: FC = () => {
  const { organizations, facilities, claimData, coverageData } = getSelectors(useClaimStore, [
    'organizations',
    'facilities',
    'claimData',
    'coverageData',
  ]);

  const facility = useMemo(
    () => facilities?.find((facility) => facility.id === claimData?.facilityId),
    [claimData?.facilityId, facilities]
  );

  const organization = useMemo(
    () =>
      organizations?.find(
        (organization) =>
          organization.id ===
          facilities
            ?.find((facility) => facility.id === claimData?.facilityId)
            ?.managingOrganization?.reference?.split('/')?.[1]
      ),
    [claimData?.facilityId, facilities, organizations]
  );

  return (
    <ClaimListCard
      title="Signature, Location and Billing Provider"
      items={[
        {
          label: '31.Signature of Physician or Supplier',
          value: organizations?.find((organization) => organization.id === coverageData?.organizationId)?.name,
        },
        {
          label: '32.Service Facility Location',
          value: facility?.name,
        },
        {
          label: '33.Billing Provider',
          value: organization?.name,
        },
        // {
        //   label: 'Pay-to',
        //   value: 'TODO',
        // },
      ]}
      editButton={<SLBProviderModal />}
    />
  );
};
