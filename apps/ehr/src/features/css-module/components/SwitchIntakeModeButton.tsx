import React from 'react';
import { dataTestIds } from '../../../constants/data-test-ids';
import { ButtonRounded } from './RoundedButton';

export const SwitchIntakeModeButton: React.FC<{
  isDisabled: boolean;
  handleSwitchMode: () => void;
  nextMode: string;
}> = ({ isDisabled, handleSwitchMode, nextMode }) => {
  return (
    <ButtonRounded
      data-testid={dataTestIds.cssHeader.switchModeButton(nextMode)}
      variant="contained"
      disabled={isDisabled}
      onClick={handleSwitchMode}
    >
      Switch to {nextMode.charAt(0).toUpperCase() + nextMode.slice(1)} view
    </ButtonRounded>
  );
};
