/* eslint-disable @typescript-eslint/no-unused-vars */
import { useContext } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { IntakeDataContext } from '../store';

function IntakeFlow(): JSX.Element {
  return <Outlet />; // https://reactrouter.com/en/main/start/concepts#outlets
}

export default IntakeFlow;
