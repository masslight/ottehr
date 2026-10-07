import { Avatar } from '@mui/material';
import { FC } from 'react';
import { EmployeeChatParticipant } from 'utils/lib/types/api/employee-chat.types';
import { employeeInitials } from './employee-chat.utils';

interface EmployeeAvatarProps {
  employee: Pick<EmployeeChatParticipant, 'firstName' | 'lastName' | 'name'>;
  size?: number;
}

export const EmployeeAvatar: FC<EmployeeAvatarProps> = ({ employee, size = 36 }) => (
  <Avatar
    data-testid="employee-chat-avatar"
    sx={{ width: size, height: size, fontSize: size * 0.4, bgcolor: 'primary.main' }}
    aria-hidden
  >
    {employeeInitials(employee.firstName, employee.lastName, employee.name)}
  </Avatar>
);
