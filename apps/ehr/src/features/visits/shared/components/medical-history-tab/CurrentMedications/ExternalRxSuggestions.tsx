import { otherColors } from '@ehrTheme/colors';
import { MedicationOutlined, WarningAmberOutlined } from '@mui/icons-material';
import {
  Box,
  CircularProgress,
  Container,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Link,
  Typography,
} from '@mui/material';
import { ErxSearchMedicationsResponse } from '@oystehr/sdk';
import { FC, useCallback, useMemo, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { formatDateForDisplay, MedicationDTO } from 'utils';
import { ExternalMedication, useExternalMedicationHistory } from '../../../hooks/useExternalMedicationHistory';
import { ExtractObjectType } from '../../../stores/appointment/appointment.queries';

const COLLAPSED_COUNT = 5;

export interface ExternalMedicationSelection {
  medication: ExtractObjectType<ErxSearchMedicationsResponse>;
  dose: string | null;
  directions: string | null;
  type?: MedicationDTO['type'];
  date?: string;
  patientCouldNotConfirmDosage?: boolean;
}

interface ExternalRxSuggestionsProps {
  chartedMedications: MedicationDTO[];
  onSelectMedication?: (selection: ExternalMedicationSelection) => void;
}

export const ExternalRxSuggestions: FC<ExternalRxSuggestionsProps> = ({ chartedMedications, onSelectMedication }) => {
  const { isLoading, isAvailable, externalMedications } = useExternalMedicationHistory(chartedMedications);
  const [expanded, setExpanded] = useState(false);
  // Track medication IDs that were just clicked (optimistic hide).
  const [addedIds, setAddedIds] = useState<Set<number>>(new Set());
  // Track which IDs have been confirmed in chartedMedications at least once.
  const [confirmedIds, setConfirmedIds] = useState<Set<number>>(new Set());

  // Inexact match confirmation dialog state
  const [inexactConfirmMed, setInexactConfirmMed] = useState<ExternalMedication | null>(null);

  const chartedIds = useMemo(() => new Set(chartedMedications.map((m) => m.id).filter(Boolean)), [chartedMedications]);

  // When charted medications change, check if any optimistically-added IDs were removed by the user
  const reconciledAddedIds = useMemo(() => {
    if (addedIds.size === 0) return addedIds;
    let needsUpdate = false;
    const newAdded = new Set(addedIds);
    const newConfirmed = new Set(confirmedIds);

    for (const id of addedIds) {
      const idStr = String(id);
      if (chartedIds.has(idStr)) {
        if (!confirmedIds.has(id)) {
          newConfirmed.add(id);
          needsUpdate = true;
        }
      } else if (confirmedIds.has(id)) {
        // Was confirmed before but now gone — user deleted it
        newAdded.delete(id);
        newConfirmed.delete(id);
        needsUpdate = true;
      }
    }

    if (needsUpdate) {
      // Schedule state updates for next render
      setAddedIds(newAdded);
      setConfirmedIds(newConfirmed);
      return newAdded;
    }
    return addedIds;
  }, [addedIds, confirmedIds, chartedIds]);

  const addMedication = useCallback(
    (med: ExternalMedication) => {
      const matched = med.matchedMedication;
      if (matched && onSelectMedication) {
        onSelectMedication({
          medication: matched,
          dose: med.strength,
          directions: med.directions,
        });
        setAddedIds((prev) => new Set(prev).add(matched.id));
      }
    },
    [onSelectMedication]
  );

  const handleMedicationClick = useCallback(
    (med: ExternalMedication) => {
      if (!med.matchedMedication || !onSelectMedication) return;

      if (med.isExactMatch) {
        addMedication(med);
      } else {
        setInexactConfirmMed(med);
      }
    },
    [onSelectMedication, addMedication]
  );

  const visibleMedications = useMemo(
    () =>
      externalMedications.filter((med) => !med.matchedMedication || !reconciledAddedIds.has(med.matchedMedication.id)),
    [externalMedications, reconciledAddedIds]
  );
  const displayedMeds = expanded ? visibleMedications : visibleMedications.slice(0, COLLAPSED_COUNT);
  const hasMore = visibleMedications.length > COLLAPSED_COUNT;

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
        ) : visibleMedications.length === 0 ? (
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

      {/* Inexact match confirmation dialog */}
      <Dialog open={!!inexactConfirmMed} onClose={() => setInexactConfirmMed(null)} maxWidth="sm" fullWidth>
        <DialogTitle variant="h4" color="primary.dark">
          Confirm Inexact Medication Match
        </DialogTitle>
        <DialogContent>
          {inexactConfirmMed && (
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2, pt: 1 }}>
              <Typography variant="body2">
                The medication from the patient&apos;s history does not exactly match a medication in our system. Please
                confirm you want to add the matched medication.
              </Typography>
              <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1, p: 2, bgcolor: 'grey.50', borderRadius: 1 }}>
                <Typography variant="body2">
                  <strong>From history:</strong>{' '}
                  {[inexactConfirmMed.name, inexactConfirmMed.strength, inexactConfirmMed.doseForm]
                    .filter(Boolean)
                    .join(' ')}
                </Typography>
                <Typography variant="body2">
                  <strong>Matched to:</strong>{' '}
                  {inexactConfirmMed.matchedMedication
                    ? `${inexactConfirmMed.matchedMedication.name}${
                        inexactConfirmMed.matchedMedication.strength
                          ? ` ${inexactConfirmMed.matchedMedication.strength}`
                          : ''
                      }`
                    : ''}
                </Typography>
              </Box>
            </Box>
          )}
        </DialogContent>
        <DialogActions sx={{ py: 2, px: 3, display: 'flex', justifyContent: 'space-between' }}>
          <RoundedButton onClick={() => setInexactConfirmMed(null)}>Cancel</RoundedButton>
          <RoundedButton
            variant="contained"
            onClick={() => {
              if (inexactConfirmMed) {
                addMedication(inexactConfirmMed);
                setInexactConfirmMed(null);
              }
            }}
          >
            Confirm
          </RoundedButton>
        </DialogActions>
      </Dialog>
    </Box>
  );
};

interface ExternalMedicationItemProps {
  medication: ExternalMedication;
  onClick: (med: ExternalMedication) => void;
}

const ExternalMedicationItem: FC<ExternalMedicationItemProps> = ({ medication, onClick }) => {
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
    medication.writtenDate ? `Prescribed: ${formatDateForDisplay(medication.writtenDate)}` : 'Prescribed: Date unknown',
    medication.lastFillDate ? `Last filled: ${formatDateForDisplay(medication.lastFillDate)}` : null,
    medication.refills != null ? `${medication.refills} refills` : 'Refills unknown',
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
