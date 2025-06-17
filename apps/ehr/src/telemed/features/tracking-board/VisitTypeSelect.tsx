import { Autocomplete, TextField } from '@mui/material';
import { ReactElement } from 'react';
import { getSelectors } from 'utils';
import { VisitType, VisitTypeToLabelTelemed } from '../../../types/types';
import { useTrackingBoardStore } from '../../state/tracking-board/tracking-board.store';

export function VisitTypeSelect(): ReactElement {
  const { visitTypes } = getSelectors(useTrackingBoardStore, ['visitTypes']);
  const visitTypesOptions = Object.keys(VisitTypeToLabelTelemed).filter(
    (key) => key === VisitType.PreBook || key === VisitType.WalkIn
  );

  return (
    <Autocomplete
      id="visitTypes"
      sx={{
        '.MuiButtonBase-root.MuiChip-root': {
          width: { xs: '100%', sm: '120px' },
          textAlign: 'start',
        },
      }}
      value={visitTypes != null ? visitTypes : visitTypesOptions}
      options={visitTypesOptions}
      getOptionLabel={(option) => {
        return VisitTypeToLabelTelemed[option as VisitType];
      }}
      onChange={(_, value) => {
        useTrackingBoardStore.setState({ visitTypes: value as VisitType[] });
      }}
      multiple
      renderInput={(params) => <TextField name="visitTypes" {...params} label="Visit type" required={false} />}
    />
  );
}
