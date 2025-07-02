import { Box, Divider, Typography } from '@mui/material';
import React, { FC, Fragment, ReactNode, useMemo } from 'react';
import { ClaimCard } from './ClaimCard';

type ClaimListCardProps = {
  title: string;
  items: { label: string; value?: string; hideValue?: boolean }[];
  comment?: string;
  editButton?: ReactNode;
};

export const ClaimListCard: FC<ClaimListCardProps> = (props) => {
  const { title, items, comment, editButton } = props;

  const length = useMemo(() => items.length, [items]);

  return (
    <ClaimCard title={title} editButton={editButton}>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
        {items.map((item, index) => (
          <Fragment key={item.label}>
            <Box sx={{ display: 'flex', justifyContent: 'space-between', gap: 2, alignItems: 'center' }}>
              <Typography color="primary.dark">{item.label}</Typography>
              {!item.hideValue && <Typography textAlign="end">{item.value || '-'}</Typography>}
            </Box>
            {(!!comment || length - 1 > index) && <Divider flexItem />}
          </Fragment>
        ))}
        {comment && <Typography color="primary.dark">{comment}</Typography>}
      </Box>
    </ClaimCard>
  );
};
