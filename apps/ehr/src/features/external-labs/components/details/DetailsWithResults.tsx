import { Stack } from '@mui/system';
import React from 'react';
import { LabOrderDTO } from 'utils';
import { CSSPageTitle } from '../../../../telemed/components/PageTitle';
import { OrderHistoryCard } from '../OrderHistoryCard';
import { Questionarie } from './Questionarie';
import { ResultItem } from './ResultItem';
import { Typography } from '@mui/material';

export const DetailsWithResults: React.FC<{ labOrder?: LabOrderDTO }> = ({ labOrder }) => {
  if (!labOrder) {
    return null;
  }

  return (
    <div style={{ maxWidth: '714px', margin: '0 auto' }}>
      <Stack spacing={2} sx={{ p: 3 }}>
        <CSSPageTitle>{labOrder.typeLab}</CSSPageTitle>

        <Typography variant="body1" sx={{ fontWeight: 'medium' }}>
          {labOrder.diagnoses.map((dx) => {
            const diagnosis = `${dx.code} - ${dx.display}`;
            return <div key={diagnosis}>{diagnosis}</div>;
          })}
        </Typography>

        {labOrder.resultsDetails.map((result) => (
          <ResultItem resultDetails={result} labOrder={labOrder} />
        ))}

        <Questionarie showActionButtons={false} showOrderInfo={false} isAOECollapsed={true} />
        <OrderHistoryCard orderHistory={labOrder.history} />
      </Stack>
    </div>
  );
};
