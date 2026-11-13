import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter, Route, Routes, useNavigate } from 'react-router-dom';
import { describe, expect, it } from 'vitest';
import { useNavigateBack } from '../../src/hooks/useNavigateBack';

function DocsPage(): JSX.Element {
  const navigate = useNavigate();
  const navigateBack = useNavigateBack('/patient/p1');
  return (
    <>
      <button onClick={() => navigate('/patient/p1/docs?folder=labs', { replace: true })}>Open folder</button>
      <button onClick={navigateBack}>Back</button>
    </>
  );
}

function VisitsPage(): JSX.Element {
  const navigate = useNavigate();
  return <button onClick={() => navigate('/patient/p1/docs')}>Open docs</button>;
}

const renderAppAt = (path: string): void => {
  window.history.replaceState(null, '', path);
  render(
    <BrowserRouter>
      <Routes>
        <Route path="/visits" element={<VisitsPage />} />
        <Route path="/patient/p1" element={<p>Patient record</p>} />
        <Route path="/patient/p1/docs" element={<DocsPage />} />
      </Routes>
    </BrowserRouter>
  );
};

describe('useNavigateBack', () => {
  it('returns to the in-app page the user came from', async () => {
    renderAppAt('/visits');
    await userEvent.click(screen.getByRole('button', { name: 'Open docs' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByRole('button', { name: 'Open docs' })).toBeInTheDocument();
  });

  it('opens the fallback page when the page was opened directly, e.g. in a new tab', async () => {
    renderAppAt('/patient/p1/docs');
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Patient record')).toBeInTheDocument();
  });

  it('still opens the fallback page after the directly opened page replaced its own entry', async () => {
    renderAppAt('/patient/p1/docs');
    await userEvent.click(screen.getByRole('button', { name: 'Open folder' }));
    await userEvent.click(screen.getByRole('button', { name: 'Back' }));
    expect(await screen.findByText('Patient record')).toBeInTheDocument();
  });
});
