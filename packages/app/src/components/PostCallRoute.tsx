import React from 'react';
import { Route } from 'react-router-dom';
import { ParticipantProvider, PractitionerProvider } from '../store';

export const PostCallRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <Route element={<ParticipantProvider />}>
      <Route element={<PractitionerProvider />}>{children}</Route>
    </Route>
  );
};
