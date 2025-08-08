import { Skeleton, TableBody, TableCell, TableRow } from '@mui/material';
import React, { ReactElement } from 'react';

export const OrderHistoryTableSkeletonBody: React.FC = () => {
  const skeletonCell = (): ReactElement => {
    return (
      <TableCell>
        <Skeleton width={'100%'} height={24} />
      </TableCell>
    );
  };
  const skeletonRow = (): ReactElement => {
    return (
      <TableRow>
        {skeletonCell()}
        {skeletonCell()}
        {skeletonCell()}
        {skeletonCell()}
        {skeletonCell()}
      </TableRow>
    );
  };
  return (
    <TableBody>
      {skeletonRow()}
      {skeletonRow()}
      {skeletonRow()}
    </TableBody>
  );
};
