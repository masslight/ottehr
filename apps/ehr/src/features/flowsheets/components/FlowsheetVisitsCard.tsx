import { Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { ReactElement } from 'react';
import { AccordionCard } from 'src/components/AccordionCard';
import { useServiceCategoryAbbreviationResolver } from 'src/hooks/useServiceCategoryAbbreviation';
import { VisitColumn, visitTypeLabel } from '../format';
import { VisitLink } from './VisitLink';

const HEADERS = ['Date', 'Type & Service Category', 'Reason for visit', 'Primary diagnosis', 'Provider'];

export const FlowsheetVisitsCard = ({ columns }: { columns: VisitColumn[] }): ReactElement => {
  const resolveServiceCategoryAbbreviation = useServiceCategoryAbbreviationResolver();
  return (
    <AccordionCard label="Visits">
      <TableContainer sx={{ bgcolor: 'background.paper' }}>
        <Table size="small" aria-label="Visits">
          <TableHead>
            <TableRow>
              {HEADERS.map((header) => (
                <TableCell key={header} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>
                  {header}
                </TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {columns.map((visit, index) => (
              <TableRow key={index}>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  <VisitLink visit={visit} />
                </TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>
                  {visitTypeLabel(visit, resolveServiceCategoryAbbreviation)}
                </TableCell>
                <TableCell>{visit.reason || '-'}</TableCell>
                <TableCell>{visit.primaryDiagnosis || '-'}</TableCell>
                <TableCell sx={{ whiteSpace: 'nowrap' }}>{visit.provider || '-'}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </AccordionCard>
  );
};
