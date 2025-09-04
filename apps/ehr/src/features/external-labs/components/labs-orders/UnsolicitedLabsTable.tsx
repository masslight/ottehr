import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Typography,
} from '@mui/material';
import { FC } from 'react';
import { useNavigate } from 'react-router-dom';
import { useGetUnsolicitedResultsForPatientList } from 'src/telemed';
import { UnsolicitedLabListPageDTO, UnsolicitedResultsRequestType } from 'utils';
import { LabOrderLoading } from './LabOrderLoading';
import { LabsTableColumn } from './LabsTable';
import { LabsTableRow } from './LabsTableRow';

interface UnsolicitedLabsTableProps {
  patientId: string;
  columns: LabsTableColumn[];
  getColumnWidth: (column: LabsTableColumn) => string;
  getColumnHeader: (column: LabsTableColumn) => string;
}

export const UnsolicitedLabsTable: FC<UnsolicitedLabsTableProps> = ({
  patientId,
  columns,
  getColumnWidth,
  getColumnHeader,
}) => {
  const navigate = useNavigate();

  const { data, isLoading } = useGetUnsolicitedResultsForPatientList({
    requestType: UnsolicitedResultsRequestType.UNSOLICITED_RESULTS_PATIENT_LIST,
    patientId,
  });
  const unsolicitedLabListDTOs = data?.unsolicitedLabListDTOs;

  if (!unsolicitedLabListDTOs) return null;

  const onRowClick = (unsolicitedLab: UnsolicitedLabListPageDTO): void => {
    navigate(`/unsolicited-results/${unsolicitedLab.diagnosticReportId}/review`);
  };

  return (
    <Paper
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 3,
        mt: 2,
        p: 3,
        position: 'relative',
      }}
    >
      {isLoading && <LabOrderLoading />}

      <Typography
        variant="h3"
        color="primary.dark"
        sx={{ mb: -2, mt: 2, width: '100%', display: 'flex', justifyContent: 'flex-start' }}
      >
        Unsolicited Labs
      </Typography>

      <Box sx={{ width: '100%' }}>
        <TableContainer sx={{ border: '1px solid #e0e0e0' }}>
          <Table>
            <TableHead>
              <TableRow>
                {columns.map((column) => (
                  <TableCell
                    key={column}
                    align="left"
                    sx={{
                      fontWeight: 'bold',
                      width: getColumnWidth(column),
                      padding: column === 'testType' ? '16px 16px' : '8px 16px',
                    }}
                  >
                    {getColumnHeader(column)}
                  </TableCell>
                ))}
              </TableRow>
            </TableHead>
            <TableBody>
              {unsolicitedLabListDTOs.map((lab, idx) => (
                <LabsTableRow
                  key={`unsolicited-${idx}-${lab.diagnosticReportId}`}
                  labOrderData={lab}
                  onRowClick={() => onRowClick(lab)}
                  columns={columns}
                  allowDelete={false}
                />
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      </Box>
    </Paper>
  );
};
