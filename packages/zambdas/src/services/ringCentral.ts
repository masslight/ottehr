import axios from 'axios';
import { SECRETS } from '../../test/data/secrets';

const API_BASE_URL = SECRETS.API_BASE_URL;
const API_TOKEN = SECRETS.API_TOKEN;
const PROJECT_ID = SECRETS.PROJECT_ID;

export const getRingCentralToken = async (): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/ringcentral/token`,
      {},
      {
        headers: {
          token: `${API_TOKEN}`,
          'project-id': `${PROJECT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    const tokenData = response.data.data;

    return {
      access_token: tokenData.access_token,
      refresh_token: tokenData.refresh_token,
      expires_in: tokenData.expires_in,
      token_type: tokenData.token_type,
      endpoint_id: tokenData.endpoint_id,
      owner_id: tokenData.owner_id,
      server: tokenData.server,
      scope: tokenData.scope,
    };
  } catch (error) {
    console.error('Error fetching reports:', error);
    return { access_token: null, expire_time: null };
  }
};
