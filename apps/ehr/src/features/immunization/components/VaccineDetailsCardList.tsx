import { Box, Stack, Typography } from '@mui/material';
import React, { useLayoutEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useGetAppointmentAccessibility } from 'src/features/visits/shared/hooks/useGetAppointmentAccessibility';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { replaceUrlKeepingRouterState } from 'src/helpers/misc.helper';
import { useGetImmunizationOrders } from '../../visits/in-person/hooks/useImmunization';
import { ordersRecentFirstComparator } from '../common';
import { ImmunizationNotes } from './ImmunizationNotes';
import { OrderHistoryTable } from './OrderHistoryTable';
import { VaccineDetailsCard } from './VaccineDetailsCard';
import { VfcEligibilityBox } from './VfcEligibilityBox';

interface Props {
  onOrderFinished?: () => void;
  scrollToOrderId?: string;
}

export const VaccineDetailsCardList: React.FC<Props> = ({ onOrderFinished, scrollToOrderId }) => {
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scrollTo = scrollToOrderId ?? searchParams.get('scrollTo');
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);
  const { isAppointmentReadOnly: isReadOnly } = useGetAppointmentAccessibility();

  const {
    encounter,
    resources: { patient },
  } = useAppointmentData(appointmentId);

  const { data: ordersResponse } = useGetImmunizationOrders({
    encounterIds: [encounter.id!],
  });

  const nonCancelledOrders = (ordersResponse?.orders ?? [])
    .filter((order) => order.status !== 'cancelled')
    .sort(ordersRecentFirstComparator);

  useLayoutEffect(() => {
    if (scrollTo && nonCancelledOrders.length > 0) {
      requestAnimationFrame(() => {
        const element = document.getElementById(`order-${scrollTo}`);
        element?.scrollIntoView?.({ behavior: 'auto', block: 'start', inline: 'nearest' });

        if (!scrollToOrderId) {
          const url = new URL(window.location.href);
          url.searchParams.delete('scrollTo');
          replaceUrlKeepingRouterState(url.toString());
        }
      });
    }
  }, [scrollTo, nonCancelledOrders, scrollToOrderId]);

  if (nonCancelledOrders.length === 0) {
    return <Typography>No orders found.</Typography>;
  }

  return (
    <Stack spacing={2}>
      <VfcEligibilityBox encounterId={encounter.id} readOnly={isReadOnly} />
      <AccordionCard
        label="Immunization history"
        collapsed={isImmunizationHistoryCollapsed}
        onSwitch={() => setIsImmunizationHistoryCollapsed((prev) => !prev)}
        withBorder={false}
      >
        <OrderHistoryTable showActions={false} administeredOnly immunizationInput={{ patientId: patient?.id }} />
      </AccordionCard>
      {nonCancelledOrders.map((order) => (
        <Box
          sx={{
            scrollMarginTop: '48px',
          }}
          key={order.id}
          id={`order-${order.id}`}
          data-testid={dataTestIds.immunizationPage.vaccineDetailsCard}
        >
          <VaccineDetailsCard order={order} onFinished={onOrderFinished} />
        </Box>
      ))}
      <ImmunizationNotes />
    </Stack>
  );
};
