import { fireEvent, render, screen } from '@testing-library/react';
import { ReactElement } from 'react';
import { MemoryRouter, Route, Routes, useNavigate } from 'react-router-dom';
import {
  audioRecordingActions,
  useStopAmbientScribeOnLeave,
} from 'src/features/visits/shared/stores/audioRecording.store';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

function Host(): ReactElement {
  useStopAmbientScribeOnLeave();
  const navigate = useNavigate();
  return (
    <button onClick={() => navigate('/other')} type="button">
      go
    </button>
  );
}

// A catch-all route so the Host (and its hook) stays mounted across the navigation, exercising the
// pathname-change path rather than a remount.
const renderHost = (): ReturnType<typeof render> =>
  render(
    <MemoryRouter initialEntries={['/visit']}>
      <Routes>
        <Route path="*" element={<Host />} />
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
    renderHost();
    expect(flushSpy).not.toHaveBeenCalled();
  });

  it('flushes when the route pathname changes while the host stays mounted', () => {
    renderHost();
    fireEvent.click(screen.getByText('go'));
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('flushes on unmount (leaving the host page)', () => {
    const { unmount } = renderHost();
    flushSpy.mockClear();
    unmount();
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });

  it('flushes on pagehide (tab close/reload)', () => {
    renderHost();
    flushSpy.mockClear();
    window.dispatchEvent(new Event('pagehide'));
    expect(flushSpy).toHaveBeenCalledTimes(1);
  });
});
