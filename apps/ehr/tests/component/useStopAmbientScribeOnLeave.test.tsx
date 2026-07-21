import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom';
import {
  audioRecordingActions,
  useStopAmbientScribeOnLeave,
} from 'src/features/visits/shared/stores/audioRecording.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

// Fake encounter ids standing in for the recorder identity the in-person layout passes as `hostKey`.
const VISIT_A_ENCOUNTER_ID = 'fake-enc-0000-0000-0000-000000000001';
const VISIT_B_ENCOUNTER_ID = 'fake-enc-0000-0000-0000-000000000002';

function InPersonHost({ hostKey }: { hostKey: string }): ReactElement {
  useStopAmbientScribeOnLeave({ hostKey });
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate(`/in-person/${VISIT_A_ENCOUNTER_ID}/vitals`)} type="button">
      switch tab
    </button>
  );
}

// The Appointments page passes the pathname as `hostKey`, exactly as Appointments.tsx wires it up.
function AppointmentsHost(): ReactElement {
  const { pathname } = useLocation();
  useStopAmbientScribeOnLeave({ hostKey: pathname });
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/telemed')} type="button">
      navigate
    </button>
  );
}

// Catch-all route so the host stays mounted across navigation (exercising identity change, not remount).
const renderMounted = (element: ReactElement, initialPath: string): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={[initialPath]}>
      <Routes>
        <Route path="*" element={element} />
      </Routes>
    </MemoryRouter>
  );

describe('useStopAmbientScribeOnLeave', () => {
  let flushSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    flushSpy = vi.spyOn(audioRecordingActions, 'flushActiveSession').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('does not flush on initial mount', () => {
    renderMounted(<InPersonHost hostKey={VISIT_A_ENCOUNTER_ID} />, `/in-person/${VISIT_A_ENCOUNTER_ID}/progress-note`);
    expect(flushSpy).not.toHaveBeenCalled();
  });

  describe('in-person layout (hostKey = encounter id)', () => {
    const renderInPerson = (hostKey: string): ReturnType<typeof render> =>
      renderMounted(<InPersonHost hostKey={hostKey} />, `/in-person/${VISIT_A_ENCOUNTER_ID}/progress-note`);

    // Same visit, but the pathname changes as the provider switches tabs: the recording must survive.
    it('does not flush when switching charting tabs', () => {
      renderInPerson(VISIT_A_ENCOUNTER_ID);
      fireEvent.click(screen.getByText('switch tab'));
      expect(flushSpy).not.toHaveBeenCalled();
    });

    it('flushes when the visit (encounter id) changes while the host stays mounted', () => {
      const { rerender } = renderInPerson(VISIT_A_ENCOUNTER_ID);
      rerender(
        <MemoryRouter initialEntries={[`/in-person/${VISIT_A_ENCOUNTER_ID}/progress-note`]}>
          <Routes>
            <Route path="*" element={<InPersonHost hostKey={VISIT_B_ENCOUNTER_ID} />} />
          </Routes>
        </MemoryRouter>
      );
      expect(flushSpy).toHaveBeenCalledTimes(1);
    });
  });

  describe('appointments page (hostKey = pathname)', () => {
    it('flushes when the pathname changes while the host stays mounted', () => {
      renderMounted(<AppointmentsHost />, '/appointments');
      fireEvent.click(screen.getByText('navigate'));
      expect(flushSpy).toHaveBeenCalledTimes(1);
    });
  });

  it('flushes on unmount (leaving the host page)', () => {
    const { unmount } = renderMounted(
      <InPersonHost hostKey={VISIT_A_ENCOUNTER_ID} />,
      `/in-person/${VISIT_A_ENCOUNTER_ID}/progress-note`
    );
    flushSpy.mockClear();
    unmount();
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('flushes on pagehide (tab close/reload)', () => {
    renderMounted(<InPersonHost hostKey={VISIT_A_ENCOUNTER_ID} />, `/in-person/${VISIT_A_ENCOUNTER_ID}/progress-note`);
    flushSpy.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });
});
