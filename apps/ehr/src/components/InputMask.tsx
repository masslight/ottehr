import { forwardRef } from 'react';
import { IMaskInput } from 'react-imask';

interface InputMaskProps {
  onChange: (event: { target: { name: string; value: string } }) => void;
  name: string;
  mask: string;
  blocks: any;
  unmask?: boolean | 'typed';
}

const InputMask = forwardRef<HTMLElement, InputMaskProps>(({ onChange, name, mask, blocks, unmask, ...other }, ref) => {
  return (
    <IMaskInput
      {...other}
      mask={mask}
      inputRef={ref as any}
      blocks={blocks}
      unmask={unmask}
      onAccept={(value: any) => onChange({ target: { name: name, value } })}
      overwrite
      name={name} // todo check why name is not included when there is a mask
    />
  );
});

export default InputMask;
