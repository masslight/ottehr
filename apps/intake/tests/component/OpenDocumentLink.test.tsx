import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import OpenDocumentLink, { OPEN_DOCUMENT_LINK_ZAMBDA_ID } from '../../src/pages/OpenDocumentLink';

const mockExecutePublic = vi.fn();
vi.mock('../../src/hooks/useUCZambdaClient', () => ({
  useUCZambdaClient: () => ({ executePublic: (...args: unknown[]) => mockExecutePublic(...args) }),
}));

// The container and loading screen pull in branding assets happy-dom cannot resolve.
vi.mock('../../src/telemed/features/common/CustomContainer', () => ({
  CustomContainer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));
vi.mock('../../src/telemed/features/common/LoadingScreen', () => ({
  LoadingScreen: () => <div>loading</div>,
}));

const renderAt = (token: string): ReturnType<typeof render> =>
  render(
    <StrictMode>
      <MemoryRouter initialEntries={[`/documents#${token}`]}>
        <Routes>
          <Route path="/documents" element={<OpenDocumentLink />} />
        </Routes>
      </MemoryRouter>
    </StrictMode>
  );

describe('OpenDocumentLink', () => {
  const replace = vi.fn();
  const originalLocation = window.location;

  beforeEach(() => {
    vi.clearAllMocks();
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, replace },
    });
  });
  afterEach(() => {
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  test('exchanges the path token once, redirects to the document and offers a fallback button', async () => {
    mockExecutePublic.mockResolvedValue({
      output: { status: 'ok', url: 'https://z3.example.test/signed.pdf', title: 'Packet.pdf' },
    });

    renderAt('tok.en.value');

    await waitFor(() => expect(replace).toHaveBeenCalledWith('https://z3.example.test/signed.pdf'));
    // StrictMode mounts twice; an expired link would re-send on every call, so exactly one call is allowed.
    expect(mockExecutePublic).toHaveBeenCalledTimes(1);
    expect(mockExecutePublic).toHaveBeenCalledWith(OPEN_DOCUMENT_LINK_ZAMBDA_ID, { token: 'tok.en.value' });
    expect(screen.getByRole('link', { name: 'Open document' }).getAttribute('href')).toBe(
      'https://z3.example.test/signed.pdf'
    );
  });

  test('tells the recipient a fresh link was emailed when the token has expired', async () => {
    mockExecutePublic.mockResolvedValue({ output: { status: 'expired', resent: true } });

    renderAt('expired.token');

    expect(await screen.findByText('This link has expired. A new link has been emailed to you.')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });

  test('shows a generic message when the token is rejected', async () => {
    mockExecutePublic.mockRejectedValue({ statusCode: 401, message: 'You are not authorized to access this data' });

    renderAt('forged.token');

    expect(await screen.findByText('This link is not valid. Please contact the practice for a new one.')).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
  });
});
