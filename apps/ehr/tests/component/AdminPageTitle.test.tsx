import { fireEvent, render, screen } from '@testing-library/react';
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom';
import { DEFAULT_TAB_TITLE } from 'src/shared/utils/patientTabTitle';
import { describe, expect, it, vi } from 'vitest';
import PageContainer from '../../src/layout/PageContainer';
import { AdminPage } from '../../src/pages/AdminPage';

vi.mock('src/hooks/useEvolveUser', () => ({
  default: () => ({ hasRole: () => true }),
}));

vi.mock('src/features/admin/adminNav', () => {
  const items = [
    { path: '/admin/locations', label: 'Locations', render: () => null },
    { path: '/admin/employees', label: 'Employees', render: () => null },
  ];
  return {
    resolveAccessibleAdminNavGroups: () => [{ label: 'Practice', items }],
    resolveActiveAdminItem: ({ adminTab }: { adminTab?: string }) =>
      items.find((item) => item.path === `/admin/${adminTab}`),
  };
});

describe('AdminPage browser tab title', () => {
  it('updates between Admin screens and resets to the default when leaving Admin', () => {
    render(
      <MemoryRouter initialEntries={['/admin/locations']}>
        <Link to="/admin/employees">Employees</Link>
        <Link to="/visits">Visits</Link>
        <Routes>
          <Route path="/admin/:adminTab" element={<AdminPage />} />
          <Route path="/visits" element={<div>Visits page</div>} />
        </Routes>
      </MemoryRouter>
    );

    const organization = import.meta.env.VITE_APP_ORGANIZATION_NAME_LONG;
    expect(document.title).toBe(`Locations | ${organization} EHR`);

    fireEvent.click(screen.getByRole('link', { name: 'Employees' }));
    expect(document.title).toBe(`Employees | ${organization} EHR`);

    fireEvent.click(screen.getByRole('link', { name: 'Visits' }));
    expect(document.title).toBe(DEFAULT_TAB_TITLE);
  });

  it('preserves a destination page title set during navigation', () => {
    render(
      <MemoryRouter initialEntries={['/admin/locations']}>
        <Link to="/patient">Patient</Link>
        <Routes>
          <Route path="/admin/:adminTab" element={<AdminPage />} />
          <Route
            path="/patient"
            element={
              <PageContainer tabTitle="Jane Doe" showEnvFooter={false}>
                <div>Patient page</div>
              </PageContainer>
            }
          />
        </Routes>
      </MemoryRouter>
    );

    fireEvent.click(screen.getByRole('link', { name: 'Patient' }));
    expect(document.title).toBe(`Jane Doe | ${import.meta.env.VITE_APP_ORGANIZATION_NAME_LONG} EHR`);
  });
});
