import { FC, PropsWithChildren } from 'react';
import { AppDialog } from 'src/components/dialogs/AppDialog';

type GenerateExcuseDialogContainerProps = PropsWithChildren<{
  open: boolean;
  onClose: () => void;
  onSubmit: () => void;
  label: string;
}>;

export const GenerateExcuseDialogContainer: FC<GenerateExcuseDialogContainerProps> = (props) => {
  const { open, onClose, onSubmit, label, children } = props;

  return (
    <AppDialog
      variant="form"
      size="m"
      open={open}
      onClose={onClose}
      title={label}
      primary={{
        label: 'Generate Note',
        // Not returned: the caller closes the dialog itself, so the shell has nothing to wait for.
        onClick: () => {
          onSubmit();
        },
      }}
    >
      {children}
    </AppDialog>
  );
};
