import { t } from 'i18next';
import { useIntakeCommonStore } from '../features/common';

export async function downloadFile(presignedURL: string, filename: string): Promise<void> {
  let downloadResponse;
  try {
    downloadResponse = await fetch(presignedURL, { method: 'GET' });
  } catch {
    useIntakeCommonStore.setState({ error: t('general.errors.general') });
    return;
  }

  if (!downloadResponse || downloadResponse.status != 200) {
    useIntakeCommonStore.setState({ error: t('general.errors.general') });
    return;
  }

  const blob = await downloadResponse.blob();
  const newBlob = new Blob([blob]);
  const blobUrl = URL.createObjectURL(newBlob);
  const fakeLink = document.createElement('a');
  fakeLink.style.display = 'none';
  document.body.appendChild(fakeLink);
  fakeLink.setAttribute('href', blobUrl);
  fakeLink.setAttribute('download', filename);
  fakeLink.click();
  document.body.removeChild(fakeLink);
  URL.revokeObjectURL(blobUrl);
}
