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
import { COLLAPSED_MEDS_COUNT } from 'src/features/css-module/hooks/useMedicationHistory';
import { STUB_IMMUNIZATION_ORDERS } from '../ImmunizationOrder';
import { OrderHistoryTableRow } from './OrderHistoryTableRow';
import { OrderHistoryTableSkeletonBody } from './OrderHistoryTableSkeletonBody';

interface Props {
  showActions: boolean;
}

export const OrderHistoryTable: React.FC<Props> = ({ showActions }) => {
  const [seeMoreOpen, setSeeMoreOpen] = useState(false);

  const isLoading = false;
  const immunizationHistory = STUB_IMMUNIZATION_ORDERS;

  const orders = useMemo(() => {
    if (!seeMoreOpen) {
      return immunizationHistory.slice(0, COLLAPSED_MEDS_COUNT);
    } else {
      return immunizationHistory;
    }
  }, [seeMoreOpen, immunizationHistory]);

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
            {immunizationHistory.length > COLLAPSED_MEDS_COUNT && (
              <Button onClick={toggleShowMore} startIcon={seeMoreOpen ? <ArrowDropUpIcon /> : <ArrowDropDownIcon />}>
                {getSeeMoreButtonLabel()}
              </Button>
            )}
            {immunizationHistory.length === 0 && (
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
