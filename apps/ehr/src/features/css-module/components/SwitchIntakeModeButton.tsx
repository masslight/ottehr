import React from 'react';
import { ButtonRounded } from './RoundedButton';

export const SwitchIntakeModeButton: React.FC<{
  isDisabled: boolean;
  handleSwitchMode: () => void;
  nextMode: string;
}> = ({ isDisabled, handleSwitchMode, nextMode }) => {
  return (
    <ButtonRounded variant="contained" disabled={isDisabled} onClick={handleSwitchMode}>
      {nextMode.charAt(0).toUpperCase() + nextMode.slice(1)}
    </ButtonRounded>
  );
};
