import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import {
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import React, { useState } from 'react';
import { useParams } from 'react-router-dom';
import { COLLAPSED_MEDS_COUNT } from 'src/features/css-module/hooks/useMedicationHistory';
import { useAppointmentData } from 'src/telemed';
import { useGetImmunizationOrders } from '../../css-module/hooks/useImmunization';
import { ordersRecentFirstComparator } from '../common';
import { OrderHistoryTableRow } from './OrderHistoryTableRow';
import { OrderHistoryTableSkeletonBody } from './OrderHistoryTableSkeletonBody';

interface Props {
  showActions: boolean;
  administeredOnly?: boolean;
}

export const OrderHistoryTable: React.FC<Props> = ({ showActions, administeredOnly }) => {
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);
  const { id: appointmentId } = useParams();

  const {
    resources: { patient },
    isLoading: patientIdLoading,
  } = useAppointmentData(appointmentId);

  const { data: ordersResponse, isLoading: ordersLoading } = useGetImmunizationOrders({
    patientId: patient?.id,
  });

  const orders = (ordersResponse?.orders ?? [])
    .sort(ordersRecentFirstComparator)
    .filter((order) => (administeredOnly ? ['administered', 'administered-partly'].includes(order.status) : true));
  const ordersToShow = seeMoreOpen ? orders : orders.slice(0, COLLAPSED_MEDS_COUNT);
  const isLoading = patientIdLoading || ordersLoading;

  const toggleShowMore = (): void => {
    setSeeMoreOpen((state) => !state);
  };

  const getSeeMoreButtonLabel = (): string => {
    return seeMoreOpen ? 'See less' : 'See more';
  };

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
            {ordersToShow.map((order) => (
              <OrderHistoryTableRow key={order.id} order={order} showActions={showActions} />
            ))}
            {orders.length > COLLAPSED_MEDS_COUNT && (
              <Button onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}>
                {getSeeMoreButtonLabel()}
              </Button>
            )}
            {orders.length === 0 && (
              <Typography variant="body1" sx={{ opacity: 0.65 }}>
                No items
              </Typography>
            )}
          </TableBody>
        )}
      </Table>
    </TableContainer>
  );
};
