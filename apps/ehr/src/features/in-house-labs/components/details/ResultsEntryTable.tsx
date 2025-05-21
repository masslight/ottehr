import { Typography, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { TestItemComponent } from 'utils';
import { ResultEntryTableRow } from './ResultsEntryTableRow';

interface ResultEntryTableProps {
  testItemComponents: TestItemComponent[];
}

const HEADER_ROW_STYLING = { borderBottom: 'none', padding: '0 8px 6px 0' };

export const ResultEntryTable: React.FC<ResultEntryTableProps> = ({ testItemComponents }) => {
  return (
    <TableContainer>
      <Table
        aria-label="lab results table"
        sx={{ backgroundColor: 'rgba(217, 217, 217, 0.2)', padding: 2, borderCollapse: 'separate' }}
      >
        <TableHead>
          <TableRow>
            <TableCell sx={{ width: '23%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                NAME
              </Typography>
            </TableCell>
            <TableCell sx={{ width: '28%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                VALUE
              </Typography>
            </TableCell>
            <TableCell sx={{ width: '15%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                UNITS
              </Typography>
            </TableCell>
            <TableCell sx={{ width: '25%', ...HEADER_ROW_STYLING }}>
              <Typography variant="body2" fontSize="12px">
                REFERENCE RANCE
              </Typography>
            </TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {testItemComponents.map((component) => (
            <ResultEntryTableRow component={component} />
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
};
