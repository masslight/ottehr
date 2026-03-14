import { otherColors } from '@ehrTheme/colors';
import { MedicationOutlined, WarningAmberOutlined } from '@mui/icons-material';
import { Box, CircularProgress, Container, Link, Typography } from '@mui/material';
import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { DateTime } from 'luxon';
import { FC, useCallback, useState } from 'react';
import { MedicationDTO } from 'utils';
import { ExternalMedication, useExternalMedicationHistory } from '../../../hooks/useExternalMedicationHistory';
import { ExtractObjectType } from '../../../stores/appointment/appointment.queries';

const COLLAPSED_COUNT = 5;

export interface ExternalMedicationSelection {
  medication: ExtractObjectType<ErxSearchMedicationsResponse>;
  dose: string | null;
  directions: string | null;
}

interface ExternalRxSuggestionsProps {
  chartedMedications: MedicationDTO[];
  onSelectMedication?: (selection: ExternalMedicationSelection) => void;
}

export const ExternalRxSuggestions: FC<ExternalRxSuggestionsProps> = ({ chartedMedications, onSelectMedication }) => {
  const { isLoading, isAvailable, externalMedications } = useExternalMedicationHistory(chartedMedications);
  const [expanded, setExpanded] = useState(false);

  const handleMedicationClick = useCallback(
    (med: ExternalMedication) => {
      if (med.matchedMedication && onSelectMedication) {
        onSelectMedication({
          medication: med.matchedMedication,
          dose: med.strength,
          directions: med.directions,
        });
      }
    },
    [onSelectMedication]
  );

  const displayedMeds = expanded ? externalMedications : externalMedications.slice(0, COLLAPSED_COUNT);
  const hasMore = externalMedications.length > COLLAPSED_COUNT;

  const formatDate = (dateStr: string | null): string | null => {
    if (!dateStr) return null;
    const dt = DateTime.fromISO(dateStr);
    return dt.isValid ? dt.toFormat('MM/dd/yyyy') : dateStr;
  };

  return (
    <Box sx={{ marginBottom: '10px' }}>
      {/* Header */}
      <Container
        style={{
          background: '#E1F5FECC',
          borderRadius: '8px',
          padding: '4px 8px',
          marginBottom: '8px',
        }}
      >
        <Box style={{ display: 'flex', alignItems: 'center' }}>
          <MedicationOutlined sx={{ fontSize: '24px', marginRight: '8px', color: '#0277BD' }} />
          <Typography variant="subtitle2" style={{ fontWeight: 700, fontSize: '14px' }}>
            External Rx
          </Typography>
        </Box>
      </Container>

      {/* Content */}
      <Container
        style={{
          background: '#E1F5FECC',
          borderRadius: '8px',
          padding: '8px',
        }}
      >
        {isLoading ? (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 1 }}>
            <CircularProgress size={17} />
            <Typography variant="body2" color="text.secondary">
              Loading external medication history...
            </Typography>
          </Box>
        ) : !isAvailable ? (
          <Typography variant="body2" color="text.secondary">
            Not available
          </Typography>
        ) : externalMedications.length === 0 ? (
          <Typography variant="body2" color="text.secondary">
            No external medications found, or all have been reconciled.
          </Typography>
        ) : (
          <>
            {displayedMeds.map((med, index) => (
              <ExternalMedicationItem
                key={`${med.name}-${med.writtenDate}-${index}`}
                medication={med}
                onClick={handleMedicationClick}
                formatDate={formatDate}
              />
            ))}
            {hasMore && (
              <Link
                component="button"
                variant="body2"
                onClick={() => setExpanded(!expanded)}
                sx={{ mt: 1, cursor: 'pointer' }}
              >
                {expanded ? 'Show less' : `Show more`}
              </Link>
            )}
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
              Click on area to apply to the note.
            </Typography>
          </>
        )}
      </Container>
    </Box>
  );
};

interface ExternalMedicationItemProps {
  medication: ExternalMedication;
  onClick: (med: ExternalMedication) => void;
  formatDate: (dateStr: string | null) => string | null;
}

const ExternalMedicationItem: FC<ExternalMedicationItemProps> = ({ medication, onClick, formatDate }) => {
  const isClickable = !!medication.matchedMedication;
  const isExact = medication.isExactMatch;
  const displayName = [medication.name, medication.strength, medication.doseForm].filter(Boolean).join(' ');
  const closestMatchName = medication.matchedMedication
    ? `${medication.matchedMedication.name}${
        medication.matchedMedication.strength ? ` ${medication.matchedMedication.strength}` : ''
      }`
    : null;

  const detailParts = [medication.route, medication.directions].filter(Boolean);
  const detailLine = detailParts.join(' | ');

  const dateParts = [
    medication.writtenDate ? `Prescribed: ${formatDate(medication.writtenDate)}` : null,
    medication.lastFillDate ? `Last filled: ${formatDate(medication.lastFillDate)}` : null,
    `${medication.refills} refills`,
  ].filter(Boolean);
  const dateLine = dateParts.join(' | ');

  return (
    <Box
      sx={{
        py: 0.75,
        cursor: isClickable ? 'pointer' : 'default',
        '&:hover': isClickable ? { backgroundColor: '#B3E5FC80', borderRadius: '4px' } : undefined,
        px: 0.5,
      }}
      onClick={isClickable ? () => onClick(medication) : undefined}
    >
      {isClickable && isExact ? (
        <Typography variant="body2" sx={{ fontWeight: 700 }}>
          {displayName}
        </Typography>
      ) : isClickable && !isExact ? (
        <>
          <Typography variant="body2" sx={{ fontWeight: 700 }}>
            {displayName}
          </Typography>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
            <WarningAmberOutlined sx={{ fontSize: '14px', color: otherColors.warningIcon }} />
            <Typography variant="caption" sx={{ fontWeight: 700, fontStyle: 'italic', color: otherColors.warningText }}>
              inexact match: {closestMatchName}
            </Typography>
          </Box>
        </>
      ) : (
        <Typography variant="body2" sx={{ fontWeight: 400, fontStyle: 'italic', color: 'text.secondary' }}>
          not recognized medication [{displayName}]
        </Typography>
      )}
      {detailLine && (
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
          {detailLine}
        </Typography>
      )}
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
        {dateLine}
      </Typography>
    </Box>
  );
};
