import {
  alpha,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  useTheme,
} from '@mui/material';
import { FC } from 'react';
import { ControlledExamCheckbox, ExamCommentField } from 'src/telemed/features/appointment';
import { ExamCardComponent, ExamItemConfig } from 'utils';

type ExamTableProps = {
  examConfig: ExamItemConfig;
};

export const ExamTable: FC<ExamTableProps> = ({ examConfig }) => {
  const theme = useTheme();

  const border = '1px solid rgba(224, 224, 224, 1)';
  const cards: (keyof typeof examConfig)[] = Object.keys(examConfig) as (keyof typeof examConfig)[];

  return (
    <TableContainer component={Paper} elevation={0} sx={{ border }}>
      <Table
        size="small"
        sx={{
          tableLayout: 'fixed',
          '& .MuiTableCell-root': {
            borderRight: border,
            borderBottom: border,
          },
          '& .MuiTableBody-root .MuiTableRow-root:last-child .MuiTableCell-root': {
            borderBottom: 'none',
          },
          '& .MuiTableCell-root:last-child': {
            borderRight: 'none',
          },
          '& .MuiTableHead-root .MuiTableCell-root': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
          },
          '& .MuiTableBody-root .MuiTableCell-root:first-of-type': {
            backgroundColor: alpha(theme.palette.primary.main, 0.05),
            fontWeight: 500,
            color: theme.palette.primary.dark,
          },
        }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '110px' }}></TableCell>
            <TableCell sx={{ color: theme.palette.success.main, width: 'calc((100% - 370px) / 2)' }}>Normal</TableCell>
            <TableCell sx={{ color: theme.palette.error.main, width: 'calc((100% - 370px) / 2)' }}>Abnormal</TableCell>
            <TableCell sx={{ color: theme.palette.primary.dark, width: '260px' }}>Provider Comment</TableCell>
          </TableRow>
        </TableHead>
        <TableBody sx={{ '& .MuiTableCell-root': { verticalAlign: 'top' } }}>
          {cards.map((card) => (
            <TableRow key={card}>
              <TableCell>{examConfig[card].label}</TableCell>
              <TableCell>
                <ExamTableCellComponent elements={examConfig[card].components.normal} />
              </TableCell>
              <TableCell>
                <ExamTableCellComponent elements={examConfig[card].components.abnormal} abnormal />
              </TableCell>
              <TableCell>
                <ExamTableCellComponent elements={examConfig[card].components.comment} />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};

const ExamTableCellComponent: FC<{
  elements: Record<string, ExamCardComponent>;
  abnormal?: boolean;
}> = ({ elements, abnormal }) => {
  return (
    <Box sx={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
      {Object.keys(elements).map((component) =>
        elements[component].type === 'checkbox' ? (
          <ControlledExamCheckbox
            key={component}
            name={component}
            label={elements[component].label}
            abnormal={abnormal}
          />
        ) : elements[component].type === 'text' ? (
          <ExamCommentField key={component} name={component} />
        ) : null
      )}
    </Box>
  );
};
