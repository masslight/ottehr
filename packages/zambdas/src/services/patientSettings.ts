import axios from 'axios';
import { SECRETS } from '../../test/data/secrets';

export interface PatientSettingsPayload {
  provider_id: string;
  patient_id: string;
  staff_id: string;
  order: number;
  is_notification_enabled: boolean;
  is_reports_enabled: boolean;
}

export interface DeletePatientSettingsPayload {
  type: 'provider' | 'staff' | 'patient';
  providerId?: string;
  staffId?: string;
  patientId?: string;
}

const API_BASE_URL = SECRETS.API_BASE_URL;
const API_TOKEN = SECRETS.API_TOKEN;
const PROJECT_ID = SECRETS.PROJECT_ID;

export const savePatientSettings = async (payload: any): Promise<any> => {
  try {
    const response = await axios.post(`${API_BASE_URL}/patient-settings/save`, payload, {
      headers: {
        token: `${API_TOKEN}`,
        'project-id': `${PROJECT_ID}`,
        'Content-Type': 'application/json',
      },
    });

    return response.data;
  } catch (err) {
    console.error('Error saving patient settings:', err);
    throw err;
  }
};

export const fetchPatientSettings = async (): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/patient-settings/fetch`,
      {},
      {
        headers: {
          token: `${API_TOKEN}`,
          'project-id': `${PROJECT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error('Error fetching patient settings:', error);
    return { reports: [], total: 0 };
  }
};

export const fetchPatientSettingsById = async (patientId: string): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/patient-settings/id`,
      {
        patientId,
      },
      {
        headers: {
          token: `${API_TOKEN}`,
          'project-id': `${PROJECT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data.data;
  } catch (error) {
    console.error('Error fetching patient settings by Id:', error);
    return { reports: [], total: 0 };
  }
};

export const deletePatientSettings = async (payload: DeletePatientSettingsPayload): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/patient-settings/delete`,
      {
        payload,
      },
      {
        headers: {
          token: `${API_TOKEN}`,
          'project-id': `${PROJECT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data;
  } catch (err) {
    console.error('Error deleting patient settings:', err);
    throw err;
  }
};
