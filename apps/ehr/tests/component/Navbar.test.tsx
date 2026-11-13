import { TabContext } from '@mui/lab';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import { CustomThemeProvider } from '../../src/CustomThemeProvider';

vi.hoisted(() => vi.stubEnv('VITE_APP_ORGANIZATION_NAME_SHORT', 'Test'));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => undefined }));
vi.mock('src/features/support-chat/support-chat.queries', () => ({ useHasUnreadSupportChatsQuery: () => false }));
vi.mock('src/components/navigation/UserMenu', () => ({ UserMenu: () => null }));

import Navbar from '../../src/components/navigation/Navbar';

const renderAt = (path: string): void => {
  render(
    <CustomThemeProvider>
      <MemoryRouter initialEntries={[path]}>
        <TabContext value="Tracking Board">
          <Navbar />
        </TabContext>
      </MemoryRouter>
    </CustomThemeProvider>
  );
};

describe('Navbar', () => {
  it.each([
    '/visit/appointment-1',
    '/patient/patient-1/info',
    '/patient/patient-1/docs',
    '/patient/patient-1/action-logs',
  ])('leaves the patient header as the only header on %s', (path) => {
    renderAt(path);
    expect(screen.queryByRole('banner')).not.toBeInTheDocument();
  });

  it.each(['/visits', '/patients', '/patient/patient-1'])('shows the navigation on %s', (path) => {
    renderAt(path);
    expect(screen.getByRole('banner')).toBeInTheDocument();
  });
});
