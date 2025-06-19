import React from 'react';
import { ButtonRounded } from './RoundedButton';
import { dataTestIds } from '../../../constants/data-test-ids';

export const SwitchIntakeModeButton: React.FC<{
  isDisabled: boolean;
  handleSwitchMode: () => void;
  nextMode: string;
}> = ({ isDisabled, handleSwitchMode, nextMode }) => {
  return (
    <ButtonRounded
      data-testid={dataTestIds.cssHeader.switchStatusButton(nextMode)}
      variant="contained"
      disabled={isDisabled}
      onClick={handleSwitchMode}
    >
      Switch to {nextMode.charAt(0).toUpperCase() + nextMode.slice(1)} view
    </ButtonRounded>
  );
};
