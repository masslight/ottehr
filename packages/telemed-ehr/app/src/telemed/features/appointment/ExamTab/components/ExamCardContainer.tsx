import { FC, type ReactNode } from 'react';
import { Box, Divider, Typography, useTheme } from '@mui/material';
import { PropsWithChildren } from '../../../../../shared/types';
import { AccordionCard } from '../../../../components';

type ExamCardContainerProps = {
  collapsed?: boolean;
  onSwitch?: () => void;
  label: string;
  rightComponent?: ReactNode;
  grid: Record<string, ReactNode>[];
};

export const ExamCardContainer: FC<ExamCardContainerProps> = (props) => {
  const { collapsed, onSwitch, label, rightComponent, grid } = props;

  const renderGrid = (): ReactNode => {
    const nodes: ReactNode[] = [];

    for (const row of grid) {
      const subNodes: ReactNode[] = [];

      for (const cellName in row) {
        const cell = row[cellName];
        subNodes.push(
          <ExamCell key={cellName} label={cellName}>
            {cell}
          </ExamCell>
        );
      }

      nodes.push(
        subNodes.reduce((prev, curr, index) => [prev, <Divider key={index} orientation="vertical" flexItem />, curr])
      );
    }

    return nodes
      .map<ReactNode>((node, index) => <ExamRow key={index}>{node}</ExamRow>)
      .reduce((prev, curr, index) => [prev, <Divider key={index + 100} flexItem />, curr]);
  };

  return (
    <AccordionCard label={label} collapsed={collapsed} onSwitch={onSwitch}>
      <Box sx={{ p: 2, display: 'flex', gap: 4 }}>
        <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 2 }}>{renderGrid()}</Box>
        {rightComponent && <Box sx={{ width: '260px' }}>{rightComponent}</Box>}
      </Box>
    </AccordionCard>
  );
};

type ExamRowProps = PropsWithChildren;

const ExamRow: FC<ExamRowProps> = (props) => {
  const { children } = props;

  return <Box sx={{ display: 'flex', gap: 2 }}>{children}</Box>;
};

type ExamCellProps = PropsWithChildren<{ label: string }>;

const ExamCell: FC<ExamCellProps> = (props) => {
  const { children, label } = props;

  const theme = useTheme();

  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      <Typography variant="subtitle2" fontSize={16} color={theme.palette.primary.dark}>
        {label}
      </Typography>
      {children}
    </Box>
  );
};
