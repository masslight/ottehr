import axios from 'axios';

export interface AppSettingsPayload {
  appName: string;
  logo?: File | null;
  patientLogo?: File | null;
  roundedLogo?: File | null;
}

const API_BASE_URL = import.meta.env.VITE_APP_API_BASE_URL;
const API_TOKEN = import.meta.env.VITE_APP_API_TOKEN;

export const saveAppSettings = async (payload: AppSettingsPayload): Promise<any> => {
  try {
    const formData = new FormData();
    if (payload.appName !== undefined) formData.append('appName', payload.appName);
    if (payload.logo) formData.append('logo', payload.logo);
    if (payload.patientLogo) formData.append('patientLogo', payload.patientLogo);
    if (payload.roundedLogo) formData.append('roundedLogo', payload.roundedLogo);

    const response = await axios.post(`${API_BASE_URL}/app-settings/save`, formData, {
      headers: {
        token: `${API_TOKEN}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (err) {
    console.error('Error saving app settings:', err);
    throw err;
  }
};

export const fetchAppSettings = async (): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/app-settings/fetch`,
      {},
      {
        headers: {
          token: `${API_TOKEN}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      appSettings: response.data.data.appSetting,
    };
  } catch (error) {
    console.error('Error fetching reports:', error);
    return { reports: [], total: 0 };
  }
};
