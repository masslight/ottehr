import { FC } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { ReferralRow } from './ReferralRow';
import { useReferralsQuery } from './referrals.queries';
import { ReferralsPanel } from './ReferralsPanel';

export const ReferralsCard: FC = () => {
  const { appointment, encounter, resources } = useAppointmentData();
  const encounterId = encounter?.id;
  const { data, isLoading } = useReferralsQuery(encounterId ? { encounterId } : undefined);
  const referrals = data?.referrals ?? [];

  return (
    <ReferralsPanel
      dataTestId={dataTestIds.referrals.card}
      referrals={referrals}
      isLoading={isLoading}
      emptyText="No referrals for this visit."
      patientId={resources?.patient?.id}
      encounterId={encounterId}
      appointmentId={appointment?.id}
    >
      {({ expandedId, toggle, sendFax }) =>
        referrals.map((referral) => (
          <ReferralRow
            key={referral.id}
            referral={referral}
            expanded={expandedId === referral.id}
            onToggle={() => toggle(referral.id)}
            onSendFax={sendFax}
          />
        ))
      }
    </ReferralsPanel>
  );
};
