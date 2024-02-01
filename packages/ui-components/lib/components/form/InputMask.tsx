import { forwardRef } from 'react';
import { IMaskInput } from 'react-imask';

interface InputMaskProps {
  onChange: (event: { target: { name: string; value: string } }) => void;
  name: string;
  mask: string;
  blocks: any;
}

const InputMask = forwardRef<HTMLElement, InputMaskProps>(({ onChange, name, mask, blocks, ...other }, ref) => {
  return (
    <IMaskInput
      {...other}
      mask={mask}
      inputRef={ref as any}
      blocks={blocks}
      onAccept={(value: any) => onChange({ target: { name: name, value } })}
      overwrite
    />
  );
});

InputMask.displayName = 'InputMask';

export default InputMask;
