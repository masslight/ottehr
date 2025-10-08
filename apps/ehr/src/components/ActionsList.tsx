import { Box, Divider } from '@mui/material';
import React, { CSSProperties, ReactElement, ReactNode } from 'react';

type ActionsListProps<T extends unknown[], K = T[0]> = {
  data: T;
  getKey: (value: K, index: number) => string | number;
  renderItem: (value: K, index: number) => ReactNode;
  renderActions?: (value: K, index: number) => ReactNode;
  gap?: number;
  divider?: boolean;
  alignItems?: CSSProperties['alignItems'];
  itemDataTestId?: string;
};

export const ActionsList = <T extends unknown[]>(props: ActionsListProps<T>): ReactElement => {
  const { data, getKey, renderItem, renderActions, gap = 1, divider, alignItems = 'center', itemDataTestId } = props;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: gap }}>
      {data.map((item, index, arr) => (
        <Box key={getKey(item, index)} data-testid={itemDataTestId}>
          <Box sx={{ display: 'flex', alignItems, justifyContent: 'space-between', gap: 2 }}>
            {renderItem(item, index)}
            {renderActions && renderActions(item, index)}
          </Box>
          {divider && index + 1 !== arr.length && <Divider sx={{ pt: gap }} />}
        </Box>
      ))}
    </Box>
  );
};
