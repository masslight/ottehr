import { forwardRef } from 'react';
import { IMaskInput } from 'react-imask';

interface InputMaskProps {
  blocks: any;
  mask: string;
  name: string;
  onChange: (event: { target: { name: string; value: string } }) => void;
}

export const InputMask = forwardRef<HTMLElement, InputMaskProps>(({ blocks, mask, name, onChange, ...other }, ref) => {
  return (
    <IMaskInput
      {...other}
      blocks={blocks}
      inputRef={ref as any}
      mask={mask}
      onAccept={(value: any) => onChange({ target: { name: name, value } })}
      overwrite
    />
  );
});
