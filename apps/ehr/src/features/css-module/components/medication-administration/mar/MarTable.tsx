import { Paper, Table, TableBody, TableCell, TableContainer, TableHead, TableRow } from '@mui/material';
import { DateTime } from 'luxon';
import React, { useState } from 'react';
import { CSSProperties } from 'react';
import { ExtendedMedicationDataForResponse } from 'utils';
import { AccordionCard } from '../../../../../telemed/components';
import { useMedicationAPI } from '../../../hooks/useMedicationOperations';
import { CSSLoader } from '../../CSSLoader';
import { MarTableRow } from './MarTableRow';

interface ColumnStyles {
  [key: string]: CSSProperties;
}

const cellStyles = {
  padding: '8px',
  wordWrap: 'break-word',
  wordBreak: 'break-word',
  hyphens: 'auto',
  verticalAlign: 'top',
} as CSSProperties;

const HEADER_CELL_STYLES = {
  fontWeight: 'bold',
} as CSSProperties;

const sortByDateTimeCreated = (
  items: ExtendedMedicationDataForResponse[] = []
): ExtendedMedicationDataForResponse[] => {
  return items.sort((a, b) => {
    const dateA = DateTime.fromISO(a.dateTimeCreated);
    const dateB = DateTime.fromISO(b.dateTimeCreated);

    if (!dateA.isValid && !dateB.isValid) return 0;
    if (!dateA.isValid) return 1;
    if (!dateB.isValid) return -1;

    return dateB.toMillis() - dateA.toMillis();
  });
};

export const MarTable: React.FC = () => {
  const [isPendingCollapsed, setIsPendingCollapsed] = useState(false);
  const [isCompletedCollapsed, setIsCompletedCollapsed] = useState(false);
  const { medications, isLoading } = useMedicationAPI();

  const pendingMedications = sortByDateTimeCreated(medications?.filter?.((med) => med.status === 'pending') || []);
  const completedMedications = sortByDateTimeCreated(medications?.filter?.((med) => med.status !== 'pending') || []);

  const handlePendingToggle = (): void => {
    setIsPendingCollapsed((prev) => !prev);
  };

  const handleCompletedToggle = (): void => {
    setIsCompletedCollapsed((prev) => !prev);
  };

  const columnStyles: ColumnStyles = {
    medication: { width: '25%', ...cellStyles, paddingLeft: '16px' },
    dose: { width: '7%', ...cellStyles },
    route: { width: '10%', ...cellStyles },
    orderDateTime: { width: '12%', ...cellStyles },
    orderedBy: { width: '12%', ...cellStyles },
    instructions: { width: '15%', ...cellStyles },
    status: {
      width: 'auto',
      textWrap: 'nowrap',
      ...cellStyles,
      paddingRight: '16px',
    } as CSSProperties,
  };

  if (isLoading) {
    return <CSSLoader height={'300px'} />;
  }

  return (
    <TableContainer component={Paper}>
      <Table
        sx={{ minWidth: 650, tableLayout: 'fixed', borderCollapse: 'separate', borderSpacing: 0 }}
        aria-label="medication table"
      >
        <TableBody>
          <TableRow>
            <TableCell colSpan={6} sx={{ padding: 0 }}>
              <AccordionCard
                label={`Pending (${pendingMedications.length})`}
                collapsed={isPendingCollapsed}
                onSwitch={handlePendingToggle}
                withBorder={false}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...columnStyles.medication, ...HEADER_CELL_STYLES }}>Medication</TableCell>
                      <TableCell sx={{ ...columnStyles.dose, ...HEADER_CELL_STYLES }}>Dose</TableCell>
                      <TableCell sx={{ ...columnStyles.route, ...HEADER_CELL_STYLES }}>Route</TableCell>
                      <TableCell sx={{ ...columnStyles.orderDateTime, ...HEADER_CELL_STYLES }}>
                        Order date/time
                      </TableCell>
                      <TableCell sx={{ ...columnStyles.orderDateTime, ...HEADER_CELL_STYLES }}>Ordered by</TableCell>
                      <TableCell sx={{ ...columnStyles.instructions, ...HEADER_CELL_STYLES }}>Instructions</TableCell>
                      <TableCell sx={{ ...columnStyles.status, ...HEADER_CELL_STYLES }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {pendingMedications.map((row) => (
                      <MarTableRow key={row.id} medication={row} columnStyles={columnStyles} />
                    ))}
                  </TableBody>
                </Table>
              </AccordionCard>
            </TableCell>
          </TableRow>
          <TableRow>
            <TableCell colSpan={6} sx={{ padding: 0 }}>
              <AccordionCard
                label={`Completed (${completedMedications.length})`}
                collapsed={isCompletedCollapsed}
                onSwitch={handleCompletedToggle}
                withBorder={false}
              >
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell sx={{ ...columnStyles.medication, ...HEADER_CELL_STYLES }}>Medication</TableCell>
                      <TableCell sx={{ ...columnStyles.dose, ...HEADER_CELL_STYLES }}>Dose</TableCell>
                      <TableCell sx={{ ...columnStyles.route, ...HEADER_CELL_STYLES }}>Route</TableCell>
                      <TableCell sx={{ ...columnStyles.orderDateTime, ...HEADER_CELL_STYLES }}>
                        Order date/time
                      </TableCell>
                      <TableCell sx={{ ...columnStyles.orderDateTime, ...HEADER_CELL_STYLES }}>Ordered by</TableCell>
                      <TableCell sx={{ ...columnStyles.orderDateTime, ...HEADER_CELL_STYLES }}>Given</TableCell>
                      <TableCell sx={{ ...columnStyles.orderDateTime, ...HEADER_CELL_STYLES }}>Given by</TableCell>
                      <TableCell sx={{ ...columnStyles.instructions, ...HEADER_CELL_STYLES }}>Instructions</TableCell>
                      <TableCell sx={{ ...columnStyles.status, ...HEADER_CELL_STYLES }}>Status</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {completedMedications.map((row) => (
                      <MarTableRow key={row.id} medication={row} columnStyles={columnStyles} />
                    ))}
                  </TableBody>
                </Table>
              </AccordionCard>
            </TableCell>
          </TableRow>
        </TableBody>
      </Table>
    </TableContainer>
  );
};
