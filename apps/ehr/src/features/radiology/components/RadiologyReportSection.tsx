import CheckIcon from '@mui/icons-material/Check';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { Box, CircularProgress, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import React, { useState } from 'react';
import { dataTestIds } from 'src/constants/data-test-ids';
import { decodeRadiologyReportText } from 'utils/lib/fhir/radiology';
import { RadiologyReportType } from 'utils/lib/types/api/radiology';
import { safeRadiologyReportHtml } from '../reportHtml';

interface RadiologyReportSectionProps {
  label: string;
  reportType: RadiologyReportType;
  /** The report exactly as stored on the DiagnosticReport: base64-encoded `text/html`. */
  report: string;
  /** When false the report is read-only and no edit affordance is offered. */
  canEdit: boolean;
  /** Resolves true when the edit was persisted; only then does the field close. */
  onSave: (report: string) => Promise<boolean>;
}

/**
 * One saved read, with the inline edit the provider uses to correct a mistake: the pencil turns the text
 * into a field, the checkmark saves it.
 */
export const RadiologyReportSection: React.FC<RadiologyReportSectionProps> = ({
  label,
  reportType,
  report,
  canEdit,
  onSave,
}) => {
  const [draft, setDraft] = useState<string | undefined>();
  // Local to this read: the two reads can be open at once, and saving one must not put the other into a
  // saving state it isn't in.
  const [isSaving, setIsSaving] = useState(false);
  const isEditing = draft !== undefined;

  // Two views of the same stored read: the markup for display, the words for the edit field.
  const savedHtml = safeRadiologyReportHtml(report);
  const savedText = decodeRadiologyReportText(report);
  // Nothing to save until the text actually differs from what is stored — an unchanged "correction" would
  // otherwise rewrite the report (and, for a preliminary read, push it to AdvaPACS) for no reason.
  const isUnchanged = draft !== undefined && draft === savedText;

  const handleSave = async (): Promise<void> => {
    if (draft === undefined || isSaving || isUnchanged) {
      return;
    }
    setIsSaving(true);
    try {
      if (await onSave(draft)) {
        setDraft(undefined);
      }
    } finally {
      setIsSaving(false);
    }
  };

  // Reads sit on one line with their label, the way every other field on the card does — the edit control
  // follows the value rather than heading its own block.
  return (
    <Box sx={{ mt: 1.5, display: 'flex', alignItems: isEditing ? 'flex-start' : 'baseline', gap: 1 }}>
      <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap', pt: isEditing ? '4px' : 0 }}>
        {label}:
      </Typography>

      {isEditing ? (
        <>
          <TextField
            data-testid={dataTestIds.radiologyPage.editReportInput(reportType)}
            id={`${reportType}-report-edit-field`}
            // Underline only, no box: in edit mode the row keeps the same shape as every other line on the
            // card, with just the value turning into a field.
            variant="standard"
            // The label to the left already names the field, so it carries no visible MUI label — this is
            // what gives the input an accessible name in its place.
            inputProps={{ 'aria-label': label, style: { fontSize: '0.875rem' } }}
            fullWidth
            multiline
            maxRows={10}
            autoFocus
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            // No cancel button in the design, so Escape is the way back out of an edit started by mistake.
            onKeyDown={(e) => {
              if (e.key === 'Escape') {
                setDraft(undefined);
              }
            }}
            disabled={isSaving}
          />
          {isSaving ? (
            <Box sx={{ display: 'flex', p: '5px' }}>
              <CircularProgress size={18} />
            </Box>
          ) : (
            <Tooltip placement="top" title={isUnchanged ? 'No changes to save' : `Save ${label.toLowerCase()}`}>
              <span>
                <IconButton
                  data-testid={dataTestIds.radiologyPage.saveEditedReportButton(reportType)}
                  aria-label={`Save ${label.toLowerCase()}`}
                  size="small"
                  color="primary"
                  sx={{ p: '3px' }}
                  disabled={isUnchanged || draft.trim().length === 0}
                  onClick={() => void handleSave()}
                >
                  <CheckIcon fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          )}
        </>
      ) : (
        <>
          {/* Rendered as the radiologist sent it, sanitized in `safeRadiologyReportHtml`. */}
          <Typography
            variant="body2"
            component="span"
            sx={{ '& p': { margin: 0 } }}
            dangerouslySetInnerHTML={{ __html: savedHtml }}
          />
          {canEdit && (
            <Tooltip placement="top" title={`Edit ${label.toLowerCase()}`}>
              <IconButton
                data-testid={dataTestIds.radiologyPage.editReportButton(reportType)}
                aria-label={`Edit ${label.toLowerCase()}`}
                size="small"
                color="primary"
                sx={{ p: 0.25 }}
                onClick={() => setDraft(savedText)}
              >
                <EditOutlinedIcon fontSize="small" />
              </IconButton>
            </Tooltip>
          )}
        </>
      )}
    </Box>
  );
};
