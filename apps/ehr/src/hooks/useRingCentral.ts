const RC_CLIENT_ID = import.meta.env.VITE_APP_RC_CLIENT_ID;

// useRingCentral.tsx
export async function loadRingCentralWidget(): Promise<void> {
  return new Promise((resolve, reject) => {
    // If already loaded, resolve immediately
    if (document.getElementById('rc-widget-adapter-frame')) {
      resolve();
      return;
    }

    // Avoid duplicate script tags
    if (document.getElementById('rc-embeddable-script')) {
      resolve();
      return;
    }

    const script = document.createElement('script');
    script.id = 'rc-embeddable-script';
    script.src = `https://apps.ringcentral.com/integration/ringcentral-embeddable/2.2.0/adapter.js?clientId=${RC_CLIENT_ID}&appServer=https://platform.ringcentral.com`;
    script.onload = () => {
      // Hide the widget initially
      setTimeout(() => {
        postToEmbeddable({ type: 'rc-adapter-hide' });
        resolve();
      }, 1000);
    };
    script.onerror = (err) => reject(err);
    document.body.appendChild(script);
  });
}

export const waitForRingCentralReady = (): Promise<void> => {
  return new Promise((resolve) => {
    const check = (): void => {
      const iframe = document.getElementById('rc-widget-adapter-frame') as HTMLIFrameElement | null;
      if (iframe && iframe.contentWindow) {
        resolve();
      } else {
        setTimeout(check, 500);
      }
    };
    check();
  });
};

export function postToEmbeddable(msg: any): boolean {
  const iframe = findEmbeddableIframe();
  if (iframe && iframe.contentWindow) {
    iframe.contentWindow.postMessage(msg, '*');
    return true;
  }
  console.warn('RingCentral embeddable iframe not found (yet).');
  return false;
}

// Attempt to find the embeddable iframe injected by adapter.js
function findEmbeddableIframe(): HTMLIFrameElement | null {
  const byId = document.getElementById('rc-widget-adapter-frame') as HTMLIFrameElement | null;
  if (byId) return byId;

  const iframe = Array.from(document.getElementsByTagName('iframe')).find((f) =>
    (f.src || '').includes('ringcentral-embeddable')
  ) as HTMLIFrameElement | undefined;
  return iframe ?? null;
}

// New function to hide the widget
export function hideRingCentralWidget(): void {
  postToEmbeddable({ type: 'rc-adapter-hide' });
}

// New function to show the widget
export function showRingCentralWidget(): void {
  postToEmbeddable({ type: 'rc-adapter-show' });
}
