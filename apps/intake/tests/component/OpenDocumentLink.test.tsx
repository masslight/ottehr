import { render, screen, waitFor } from '@testing-library/react';
import { StrictMode } from 'react';
import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import OpenDocumentLink, {
  moveDocumentLinkTokenOutOfUrl,
  OPEN_DOCUMENT_LINK_ZAMBDA_ID,
} from '../../src/pages/OpenDocumentLink';

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

describe('OpenDocumentLink', () => {
  const replace = vi.fn();
  const originalLocation = window.location;

  const setLocation = (pathname: string, hash: string): void => {
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: { ...originalLocation, pathname, search: '', hash, replace },
    });
  };

  /** Opens the emailed URL the way the app does: the token leaves the URL at startup, then the page renders. */
  const renderAt = (token: string): ReturnType<typeof render> => {
    setLocation('/documents', `#${token}`);
    moveDocumentLinkTokenOutOfUrl();
    return render(
      <StrictMode>
        <OpenDocumentLink />
      </StrictMode>
    );
  };

  beforeEach(() => {
    vi.clearAllMocks();
    setLocation('/', '');
  });
  afterEach(() => {
    vi.restoreAllMocks();
    window.history.replaceState(null, '');
    Object.defineProperty(window, 'location', { configurable: true, value: originalLocation });
  });

  // Sentry reads location.href into every event, and GTM tags see the full URL; the token is a live credential.
  test('moves the token out of the URL into the history entry, before telemetry can record it', () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    setLocation('/documents', '#tok.en.value');

    moveDocumentLinkTokenOutOfUrl();

    expect(replaceState).toHaveBeenCalledWith(
      expect.objectContaining({ documentLinkToken: 'tok.en.value' }),
      '',
      '/documents'
    );
  });

  test("leaves other pages' URLs alone", () => {
    const replaceState = vi.spyOn(window.history, 'replaceState');
    setLocation('/home', '#section');

    moveDocumentLinkTokenOutOfUrl();

    expect(replaceState).not.toHaveBeenCalled();
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
    // The fallback button repeats the redirect for browsers that blocked it.
    replace.mockClear();
    screen.getByRole('button', { name: 'Open document' }).click();
    expect(replace).toHaveBeenCalledWith('https://z3.example.test/signed.pdf');
  });

  test('points at the inbox when a newer link is still live instead of re-sending', async () => {
    mockExecutePublic.mockResolvedValue({
      output: { status: 'expired', resent: false, sentAt: '2026-09-21T14:05:00.000Z' },
    });

    renderAt('expired.token');

    expect(await screen.findByText(/A newer link was emailed to you at .*; please check your inbox\./)).toBeDefined();
    expect(replace).not.toHaveBeenCalled();
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
