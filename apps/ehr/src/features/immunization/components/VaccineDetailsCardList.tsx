import { Box, Stack, Typography } from '@mui/material';
import React, { useLayoutEffect, useState } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { dataTestIds } from 'src/constants/data-test-ids';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { useGetImmunizationOrders } from '../../visits/in-person/hooks/useImmunization';
import { ordersRecentFirstComparator } from '../common';
import { ImmunizationNotes } from './ImmunizationNotes';
import { OrderHistoryTable } from './OrderHistoryTable';
import { VaccineDetailsCard } from './VaccineDetailsCard';

export const VaccineDetailsCardList: React.FC = () => {
  const { id: appointmentId } = useParams();
  const [searchParams] = useSearchParams();
  const scrollTo = searchParams.get('scrollTo');
  const [isImmunizationHistoryCollapsed, setIsImmunizationHistoryCollapsed] = useState(false);

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

        const url = new URL(window.location.href);
        url.searchParams.delete('scrollTo');
        window.history.replaceState({}, '', url.toString());
      });
    }
  }, [scrollTo, nonCancelledOrders]);

  if (nonCancelledOrders.length === 0) {
    return <Typography>No orders found.</Typography>;
  }

  return (
    <Stack spacing={2}>
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
          <VaccineDetailsCard order={order} />
        </Box>
      ))}
      <ImmunizationNotes />
    </Stack>
  );
};
