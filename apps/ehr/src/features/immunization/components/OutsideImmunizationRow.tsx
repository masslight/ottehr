import { TableCell, TableRow, Typography } from '@mui/material';
import { DateTime } from 'luxon';
import React from 'react';
import { OrderStatusChip } from 'src/features/immunization/components/OrderStatusChip';
import { IMMUNIZATION_OUTSIDE_SOURCES, IMMUNIZATION_SOURCE_UNSPECIFIED } from 'utils/lib/fhir/immunization';
import { PatientImmunizationRecord } from 'utils/lib/types/data/immunization/types';

/** The history reads an undated outside dose as this. */
export const DATE_UNKNOWN_LABEL = 'Date unknown';

const sourceLabel = (record: PatientImmunizationRecord): string =>
  IMMUNIZATION_OUTSIDE_SOURCES.find((source) => source.value === record.source)?.label ??
  IMMUNIZATION_SOURCE_UNSPECIFIED.label;

/** A dose administered externally in the immunization history: tagged Outside, with where and from what source. */
export const OutsideImmunizationRow: React.FC<{ record: PatientImmunizationRecord }> = ({ record }) => (
  <TableRow sx={{ cursor: 'default' }} data-testid={`outside-immunization-${record.id}`}>
    <TableCell>
      {record.vaccineName}
      {record.place && <Typography sx={{ fontSize: '14px', color: '#00000099' }}>{record.place}</Typography>}
    </TableCell>
    <TableCell>
      <Typography sx={{ fontSize: '14px', color: '#00000099' }}>
        {[`from ${sourceLabel(record)}`, record.lot && `lot ${record.lot}`, record.manufacturer]
          .filter(Boolean)
          .join(' · ')}
      </Typography>
    </TableCell>
    <TableCell />
    <TableCell>
      {record.dateGiven ? DateTime.fromISO(record.dateGiven).toFormat('MM/dd/yyyy') : DATE_UNKNOWN_LABEL}
    </TableCell>
    <TableCell>
      <OrderStatusChip status="outside" />
    </TableCell>
  </TableRow>
);
