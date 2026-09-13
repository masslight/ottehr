import { Add as AddIcon, Close as CloseIcon } from '@mui/icons-material';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  TextField,
  Typography,
} from '@mui/material';
import { ReactElement, useState } from 'react';
import { DateInput } from './DateInput';
import { thSx } from './ReadOnlySection';
import { emptyRemitLine, LineEditor, RemitLine } from './RemitLineEditor';

// Only what an 835 CLP loop actually carries — no DOB (the 835 has no DMG segment).
export interface ManualEraClaim {
  patientName: string;
  memberId: string;
  patientAccountNumber: string;
  payerClaimControlNumber: string;
  serviceDate: string;
  lines: RemitLine[];
}

interface Props {
  onAdd: (claim: ManualEraClaim) => void;
  onClose: () => void;
}

// Manual ERA claim entry (paper/PDF remit line the biller couldn't match to a claim yet). Captures
// the CLP-level identifiers plus adjudicated lines with CARC/RARC coding; UI-only for now.
export function EnterEraClaimDialog({ onAdd, onClose }: Props): ReactElement {
  const [patientName, setPatientName] = useState('');
  const [memberId, setMemberId] = useState('');
  const [patientAccountNumber, setPatientAccountNumber] = useState('');
  const [payerClaimControlNumber, setPayerClaimControlNumber] = useState('');
  const [serviceDate, setServiceDate] = useState('');
  const [lines, setLines] = useState<RemitLine[]>([emptyRemitLine(1)]);

  // claim-level DOS acts as the default: fill lines that don't have their own yet
  const handleServiceDateChange = (value: string): void => {
    setLines((prev) =>
      prev.map((line) =>
        line.serviceDate === '' || line.serviceDate === serviceDate ? { ...line, serviceDate: value } : line
      )
    );
    setServiceDate(value);
  };

  const canAdd = patientName.trim() && lines.some((line) => line.cptCode.trim());

  const handleAdd = (): void => {
    onAdd({
      patientName: patientName.trim(),
      memberId: memberId.trim(),
      patientAccountNumber: patientAccountNumber.trim(),
      payerClaimControlNumber: payerClaimControlNumber.trim(),
      serviceDate,
      lines: lines.filter((line) => line.cptCode.trim()),
    });
  };

  return (
    <Dialog open onClose={onClose} maxWidth={false} PaperProps={{ sx: { width: 1440, maxWidth: '96vw' } }}>
      <DialogTitle sx={{ px: 3, pt: 3, pb: 2, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="h5">Enter ERA Claim Details</Typography>
        <IconButton size="small" onClick={onClose} aria-label="Close">
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>
      <DialogContent sx={{ px: 3, pb: 0 }}>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2.5 }}>
          Key in one claim's remittance details from the paper/PDF ERA. It is added to the remit as an unmatched claim;
          you can match it to a claim later.
        </Typography>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Patient Name *"
            value={patientName}
            onChange={(e) => setPatientName(e.target.value)}
            sx={{ flex: 1.4, minWidth: 200 }}
          />
          <TextField
            size="small"
            label="Member ID"
            value={memberId}
            onChange={(e) => setMemberId(e.target.value)}
            sx={{ flex: 1, minWidth: 150 }}
          />
        </Box>
        <Box sx={{ display: 'flex', gap: 2, mb: 2, flexWrap: 'wrap' }}>
          <TextField
            size="small"
            label="Patient Account # (PCN)"
            value={patientAccountNumber}
            onChange={(e) => setPatientAccountNumber(e.target.value)}
            sx={{ flex: 1, minWidth: 180 }}
          />
          <TextField
            size="small"
            label="Payer Claim Control # (ICN)"
            value={payerClaimControlNumber}
            onChange={(e) => setPayerClaimControlNumber(e.target.value)}
            sx={{ flex: 1, minWidth: 180 }}
          />
          <Box sx={{ width: 170 }}>
            <DateInput
              label="Service Date"
              size="small"
              fullWidth
              value={serviceDate}
              onChange={handleServiceDateChange}
            />
          </Box>
        </Box>
        <Typography variant="h6" color="primary.dark" fontWeight={600} fontSize={16} sx={{ mb: 1 }}>
          Service Lines
        </Typography>
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={thSx}>#</TableCell>
              <TableCell sx={thSx}>DOS</TableCell>
              <TableCell sx={thSx}>Procedure</TableCell>
              <TableCell sx={thSx} align="right">
                Billed
              </TableCell>
              <TableCell sx={thSx} colSpan={2}>
                Adjudication
              </TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {lines.map((line, idx) => (
              <LineEditor
                key={line.sequence}
                line={line}
                disabled={false}
                editableProcedure
                onRemoveLine={
                  lines.length > 1
                    ? () =>
                        setLines((prev) => prev.filter((_, i) => i !== idx).map((l, i) => ({ ...l, sequence: i + 1 })))
                    : undefined
                }
                onChange={(updated) => setLines((prev) => prev.map((l, i) => (i === idx ? updated : l)))}
              />
            ))}
          </TableBody>
        </Table>
        <Button
          size="small"
          startIcon={<AddIcon fontSize="small" />}
          onClick={() => setLines((prev) => [...prev, emptyRemitLine(prev.length + 1, serviceDate)])}
          sx={{ mt: 1 }}
        >
          Add Line
        </Button>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2.5 }}>
        <Button onClick={onClose} sx={{ color: 'text.secondary' }}>
          Cancel
        </Button>
        <Button variant="contained" onClick={handleAdd} disabled={!canAdd}>
          Add to Remit
        </Button>
      </DialogActions>
    </Dialog>
  );
}
