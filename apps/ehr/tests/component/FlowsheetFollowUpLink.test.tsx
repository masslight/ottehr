import { render, screen } from '@testing-library/react';
import { MemoryRouter, Outlet, Route, Routes, useLocation } from 'react-router-dom';
import { toColumns } from 'src/features/flowsheets/components/Flowsheets';
import InPersonRouting from 'src/features/visits/in-person/routing/InPersonRouting';
import { routesInPerson } from 'src/features/visits/in-person/routing/routesInPerson';
import { FlowsheetVisit } from 'utils/lib/types/api/flowsheets.types';
import { describe, expect, it, vi } from 'vitest';

vi.mock('src/api/api', () => ({}));
vi.mock('src/hooks/useEvolveUser', () => ({ default: () => ({ id: 'u1' }) }));
vi.mock('src/features/visits/in-person/layout/InPersonLayout', () => ({ InPersonLayout: () => <Outlet /> }));
// A follow-up encounter puts the visit in follow-up mode: only the routes listed for that mode are available.
vi.mock('src/features/visits/in-person/context/InPersonNavigationContext', () => ({
  InPersonNavigationProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  useInPersonNavigationContext: () => ({
    isLoading: false,
    availableRoutes: Object.values(routesInPerson)
      .filter((route) => route.modes.includes('follow-up'))
      .map((route) => ({ ...route, element: <div>{route.text}</div> })),
  }),
}));

// An annotation follow-up of the visit booked as appointment a0, charted on its own appointment a1.
const followUp: FlowsheetVisit = {
  appointmentId: 'a1',
  originalAppointmentId: 'a0',
  followupSubtype: 'annotation',
  encounterId: 'fu1',
  start: '2026-05-01T14:00:00.000Z',
  isFollowUp: true,
  reason: '',
  primaryDiagnosis: '',
  attending: '',
  values: {},
};

const Where = (): JSX.Element => {
  const location = useLocation();
  return <div data-testid="where">{`${location.pathname}${location.search}`}</div>;
};

describe('a follow-up column header link', () => {
  it('opens the follow-up note for that follow-up', async () => {
    const [column] = toColumns([followUp]);
    render(
      <MemoryRouter initialEntries={[column.url!]}>
        <Routes>
          <Route
            path="/in-person/:id/*"
            element={
              <>
                <InPersonRouting />
                <Where />
              </>
            }
          />
        </Routes>
      </MemoryRouter>
    );
    expect(await screen.findByText('Follow-up Note')).toBeInTheDocument();
    expect(screen.getByTestId('where')).toHaveTextContent('/in-person/a0/follow-up-note?encounterId=fu1');
  });

  it('links the way the Visits tab does: a scheduled follow-up to Review & Sign, one with no original visit nowhere', () => {
    const [scheduled, orphan] = toColumns([
      { ...followUp, encounterId: 'fu2', followupSubtype: 'scheduled' },
      { ...followUp, encounterId: 'fu3', originalAppointmentId: undefined },
    ]);
    expect(scheduled.url).toBe('/in-person/a0/review-and-sign?encounterId=fu2');
    expect(orphan.url).toBeUndefined();
  });
});
