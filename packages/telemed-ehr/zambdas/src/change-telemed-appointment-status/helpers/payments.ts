export async function postChargeIssueRequest(apiUrl: string, token: string, encounterId?: string): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/charge/issue`;

  console.debug(`Posting to payment charge service at ${serviceUrl} for encounter ${encounterId}`);

  if (encounterId === undefined) {
    throw new Error('Encounter ID must be specified for payments.');
  }

  return fetch(serviceUrl, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
    method: 'POST',
    body: JSON.stringify({ encounterId: encounterId }),
  }).then((response) => {
    if (!response.ok) {
      throw new Error(`Error charging for the encounter. Status: ${response.statusText}`);
    }
    return response.json();
  });
}
