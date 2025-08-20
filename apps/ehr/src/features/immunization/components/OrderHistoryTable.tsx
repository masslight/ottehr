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
import React, { useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { useAppointment } from 'src/features/css-module/hooks/useAppointment';
import { COLLAPSED_MEDS_COUNT } from 'src/features/css-module/hooks/useMedicationHistory';
import { useGetImmunizationOrders } from '../useImmunizationOrders';
import { OrderHistoryTableRow } from './OrderHistoryTableRow';
import { OrderHistoryTableSkeletonBody } from './OrderHistoryTableSkeletonBody';

interface Props {
  showActions: boolean;
}

export const OrderHistoryTable: React.FC<Props> = ({ showActions }) => {
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);
  const { id: appointmentId } = useParams();

  const {
    resources: { patient },
    isLoading: patientIdLoading,
  } = useAppointment(appointmentId);

  const { immunizationOrders, isLoading: ordersLoading } = useGetImmunizationOrders({ patientId: patient?.id ?? '' });

  const isLoading = patientIdLoading || ordersLoading;

  const orders = useMemo(() => {
    if (!seeMoreOpen) {
      return immunizationOrders.slice(0, COLLAPSED_MEDS_COUNT);
    } else {
      return immunizationOrders;
    }
  }, [seeMoreOpen, immunizationOrders]);

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
            {orders.map((order) => (
              <OrderHistoryTableRow key={order.id} order={order} showActions={showActions} />
            ))}
            {immunizationOrders.length > COLLAPSED_MEDS_COUNT && (
              <Button onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}>
                {getSeeMoreButtonLabel()}
              </Button>
            )}
            {immunizationOrders.length === 0 && (
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
