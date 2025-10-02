import { Stack } from '@mui/material';
import React from 'react';
import { Task } from 'utils';

interface Props {
  tasks: Task[];
}

export const TasksList: React.FC<Props> = (_rows) => {
  return <Stack spacing="1"></Stack>;
};
