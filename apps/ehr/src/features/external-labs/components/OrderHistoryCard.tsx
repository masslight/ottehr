import {
  // TextField,
  CircularProgress,
  Table,
  TableRow,
  TableCell,
} from '@mui/material';
import { AccordionCard } from '../../../telemed/components/AccordionCard';
import React, { useState } from 'react';

interface OrderHistoryProps {
  instructions?: string;
}

export const OrderHistoryCard: React.FC<OrderHistoryProps> = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [isLoading, _setLoading] = useState(false);

  return (
    <>
      <AccordionCard
        label={'Order History'}
        collapsed={collapsed}
        withBorder={false}
        onSwitch={() => {
          setCollapsed((prevState) => !prevState);
        }}
      >
        {isLoading ? (
          <CircularProgress />
        ) : (
          <Table>
            <TableRow>
              <TableCell>Ordered</TableCell>
              <TableCell>Dr. Smith</TableCell>
              <TableCell>10/21/2024 at 8:07 AM</TableCell>
            </TableRow>
          </Table>
        )}
      </AccordionCard>
    </>
  );
};
