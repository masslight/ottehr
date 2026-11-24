const REVOKE_CHECK_INTERVAL_MS = 10_000;

export const reserveTab = (): Window | null => window.open('', '_blank');

const revokeWhenClosed = (tab: Window | null, objectUrl: string): void => {
  if (!tab) {
    URL.revokeObjectURL(objectUrl);
    return;
  }
  const timer = window.setInterval(() => {
    if (tab.closed) {
      window.clearInterval(timer);
      URL.revokeObjectURL(objectUrl);
    }
  }, REVOKE_CHECK_INTERVAL_MS);
};

const showPdf = async (presignedURL: string, tab: Window | undefined): Promise<void> => {
  const show = (url: string): Window | null => {
    if (!tab) return window.open(url, '_blank');
    tab.location.href = url;
    return tab;
  };

  let objectUrl: string;
  try {
    const response = await fetch(presignedURL, { method: 'GET', headers: { 'Cache-Control': 'no-cache' } });
    if (!response.ok) {
      throw new Error(`fetching the PDF failed with status ${response.status}`);
    }
    objectUrl = URL.createObjectURL(new Blob([await response.blob()], { type: 'application/pdf' }));
  } catch (error) {
    console.warn('Opening the PDF as a blob failed; opening the URL directly', error);
    show(presignedURL);
    return;
  }
  revokeWhenClosed(show(objectUrl), objectUrl);
};

export const generateAndOpenPdf = async (
  render: () => Promise<{ presignedURL: string }>,
  tab?: Window
): Promise<void> => {
  try {
    const { presignedURL } = await render();
    await showPdf(presignedURL, tab);
  } catch (error) {
    tab?.close();
    throw error;
  }
};
