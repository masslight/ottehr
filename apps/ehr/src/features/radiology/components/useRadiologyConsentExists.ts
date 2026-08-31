import { useEffect, useState } from 'react';

export const useRadiologyConsentExists = (): boolean => {
  const [consentExists, setConsentExists] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/consent_radiology.pdf', { method: 'HEAD', signal: controller.signal })
      .then((res) => {
        const contentType = res.headers.get('content-type');
        setConsentExists(res.ok && (contentType?.includes('application/pdf') ?? false));
      })
      .catch(() => {
        setConsentExists(false);
      });
    return () => {
      controller.abort();
    };
  }, []);

  return consentExists;
};
