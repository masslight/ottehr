import { FC, useEffect } from 'react';
import { FEATURE_FLAGS } from '../../constants/feature-flags';
import { useApiClients } from '../../hooks/useAppClients';
import useEvolveUser from '../../hooks/useEvolveUser';
import { connectEmployeeChat, disconnectEmployeeChat } from './employee-chat.connection';

export const EmployeeChatManager: FC = () => {
  const { oystehrZambda } = useApiClients();
  const user = useEvolveUser();
  const myProfile = user?.profile;

  useEffect(() => {
    if (!FEATURE_FLAGS.EMPLOYEE_CHAT_ENABLED) return;
    if (!oystehrZambda || !myProfile?.startsWith('Practitioner/')) return;
    void connectEmployeeChat({ oystehrZambda, myProfile });
    return () => {
      disconnectEmployeeChat();
    };
  }, [oystehrZambda, myProfile]);

  return null;
};
