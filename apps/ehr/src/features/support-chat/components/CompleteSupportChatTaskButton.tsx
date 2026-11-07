import { FC, useState } from 'react';
import { RoundedButton } from 'src/components/RoundedButton';
import { Task } from 'utils/lib/types/data/tasks/types';
import { SupportChatModal } from './SupportChatModal';

export const CompleteSupportChatTaskButton: FC<{ task: Task }> = ({ task }) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <RoundedButton variant="contained" onClick={() => setIsOpen(true)}>
        Complete
      </RoundedButton>
      {isOpen && <SupportChatModal task={task} onClose={() => setIsOpen(false)} isCompleting />}
    </>
  );
};
