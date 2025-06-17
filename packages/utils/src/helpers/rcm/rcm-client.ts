import { Cms1500 } from '../../types';

interface RCMClient {
  createClaim: (input: Cms1500) => Promise<string>;
}

export function createRCMClient(token: string, projectAPI: string): RCMClient {
  const createClaim = async (input: Cms1500): Promise<string> => {
    const headers = {
      accept: 'application/json',
      'content-type': 'application/json',
      Authorization: `Bearer ${token}`,
    };
    const resp = await fetch(`${projectAPI}/rcm/claim`, {
      method: 'POST',
      headers: headers,
      body: JSON.stringify(input),
    });
    const parsedResponse = await resp.json();
    if (resp.ok && resp.status === 200) {
      return parsedResponse.body.id;
    } else {
      throw new Error(`Error posting claim. Status: ${resp.status}, body: ${JSON.stringify(parsedResponse)}`);
    }
  };
  return {
    createClaim,
  };
}
