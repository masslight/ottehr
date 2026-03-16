import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, Typography } from '@mui/material';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { AccordionCard } from 'src/components/AccordionCard';
import { useAppointmentData } from 'src/features/visits/shared/stores/appointment/appointment.store';
import { GetImmunizationOrdersRequest } from 'utils/lib/types/data/immunization/types';
import { useGetImmunizationOrders } from '../../visits/in-person/hooks/useImmunization';
import { ordersRecentFirstComparator } from '../common';
import { OrderHistoryTableRow } from './OrderHistoryTableRow';
import { OrderHistoryTableSkeletonBody } from './OrderHistoryTableSkeletonBody';

interface Props {
  showActions: boolean;
  administeredOnly?: boolean;
  immunizationInput?: GetImmunizationOrdersRequest;
}

export const OrderHistoryTable: React.FC<Props> = ({ showActions, administeredOnly, immunizationInput }) => {
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(false);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(false);
  const { id: appointmentId } = useParams();

  const { encounter, isLoading: patientIdLoading } = useAppointmentData(appointmentId);

  const { data: ordersResponse, isLoading: ordersLoading } = useGetImmunizationOrders(
    immunizationInput ?? {
      encounterIds: [encounter.id!],
    }
  );

  const orders = (ordersResponse?.orders ?? [])
    .sort(ordersRecentFirstComparator)
    .filter((order) => (administeredOnly ? ['administered', 'administered-partly'].includes(order.status) : true));

  const isLoading = patientIdLoading || ordersLoading;

  // When administeredOnly is true (backward compat for pre-visit history accordion), show flat table
  if (administeredOnly) {
    return (
      <TableContainer component={Paper} elevation={0}>
        <Table>
          <TableHead>
            <TableRow>
              <TableCell>Vaccine</TableCell>
              <TableCell>Dose / Route / Instructions</TableCell>
              <TableCell>Ordered</TableCell>
              <TableCell>Given</TableCell>
              <TableCell>Status</TableCell>
            </TableRow>
          </TableHead>
          {isLoading ? (
            <OrderHistoryTableSkeletonBody />
          ) : (
            <TableBody>
              {orders.map((order) => (
                <OrderHistoryTableRow key={order.id} order={order} showActions={showActions} />
              ))}
              {orders.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5}>
                    <Typography variant="body1" sx={{ opacity: 0.65 }}>
                      No items
                    </Typography>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          )}
        </Table>
      </TableContainer>
    );
  }

  const pendingOrders = orders.filter((order) => order.status === 'pending');
  const completedOrders = orders.filter((order) => order.status !== 'pending');

  if (isLoading) {
    return (
      <TableContainer component={Paper} elevation={0}>
        <Table>
          <OrderHistoryTableSkeletonBody />
        </Table>
      </TableContainer>
    );
  }

  return (
    <TableContainer component={Paper} elevation={0}>
      <Table sx={{ tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}>
        <TableBody>
          <TableRow>
            <TableCell colSpan={5} sx={{ padding: 0 }}>
              <AccordionCard
                label={`Pending (${pendingOrders.length})`}
                collapsed={isPendingCollapsed}
                onSwitch={() => setIsPendingCollapsed((prev) => !prev)}
                withBorder={false}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Vaccine</TableCell>
                      <TableCell>Dose / Route / Instructions</TableCell>
                      <TableCell>Ordered</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingOrders.map((order) => (
                      <OrderHistoryTableRow key={order.id} order={order} showActions={showActions} />
                    ))}
                  </TableBody>
                </Table>
              </AccordionCard>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={5} sx={{ padding: 0 }}>
              <AccordionCard
                label={`Completed (${completedOrders.length})`}
                collapsed={isCompletedCollapsed}
                onSwitch={() => setIsCompletedCollapsed((prev) => !prev)}
                withBorder={false}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Vaccine</TableCell>
                      <TableCell>Dose / Route / Instructions</TableCell>
                      <TableCell>Ordered</TableCell>
                      <TableCell>Given</TableCell>
                      <TableCell>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {completedOrders.map((order) => (
                      <OrderHistoryTableRow key={order.id} order={order} showActions={showActions} />
                    ))}
                  </TableBody>
                </Table>
              </AccordionCard>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};
