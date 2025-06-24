import { FormControl, InputLabel, MenuItem, Select, Stack, TextField } from '@mui/material';
import { MutableRefObject, useEffect, useState } from 'react';
import { UpdateMedicationOrderInput } from 'utils';
import { ReasonListCodes, reasonListValues } from '../medicationTypes';

export const ReasonSelect: React.FC<{
  updateRequestInputRef: MutableRefObject<UpdateMedicationOrderInput | null>;
  setIsReasonSelected: React.Dispatch<React.SetStateAction<boolean>>;
}> = ({ updateRequestInputRef, setIsReasonSelected }) => {
  const [selectedReason, setSelectedReason] = useState<ReasonListCodes | ''>('');
  const [otherReason, setOtherReason] = useState('');

  useEffect(() => {
    setIsReasonSelected(!selectedReason || (selectedReason === ReasonListCodes.OTHER && !otherReason.trim()));
  }, [selectedReason, otherReason, setIsReasonSelected]);

  const handleReasonChange = (value: ReasonListCodes): void => {
    setSelectedReason(value);
    if (updateRequestInputRef.current?.orderData) {
      updateRequestInputRef.current.orderData.reason = value;
      if (value !== ReasonListCodes.OTHER) {
        updateRequestInputRef.current.orderData.otherReason = '';
        setOtherReason('');
      }
    }
  };

  const handleOtherReasonChange = (value: string): void => {
    setOtherReason(value);
    if (updateRequestInputRef.current?.orderData) {
      updateRequestInputRef.current.orderData.otherReason = value;
    }
  };

  return (
    <Stack spacing={2} sx={{ mt: 2 }}>
      <FormControl fullWidth>
        <InputLabel>Reason</InputLabel>
        <Select
          value={selectedReason}
          onChange={(e) => handleReasonChange(e.target.value as ReasonListCodes)}
          label="Reason"
        >
          {Object.entries(reasonListValues).map(([code, label]) => (
            <MenuItem key={code} value={code}>
              {label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

      {selectedReason === ReasonListCodes.OTHER && (
        <TextField
          fullWidth
          label="Specify reason"
          value={otherReason}
          onChange={(e) => handleOtherReasonChange(e.target.value)}
        />
      )}
    </Stack>
  );
};
