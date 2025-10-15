import axios from 'axios';
import { SECRETS } from '../../test/data/secrets';

interface Report {
  id: string;
  patientId: string;
  reportType: string;
  reportFileFormat: string;
  path?: string;
  notes?: string;
  startDate?: string;
  endDate?: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReportSettingsPayload {
  title: string;
  fileFormat: 'pdf' | 'csv';
  frequency: 'daily' | 'weekly' | 'monthly';
  header?: string;
  footer?: string;
  logo?: File | null;
}

const API_BASE_URL = SECRETS.API_BASE_URL;
const API_TOKEN = SECRETS.API_TOKEN;
const PROJECT_ID = SECRETS.PROJECT_ID;

export const fetchReports = async (
  patientId: string,
  page: number,
  limit: number
): Promise<{ reports: Report[]; total: number }> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/reports/list`,
      { patientId, page, limit },
      {
        headers: {
          token: `${API_TOKEN}`,
          'project-id': `${PROJECT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      reports: response.data.data.reports,
      total: response.data.data.pagination.total,
    };
  } catch (error) {
    console.error('Error fetching reports:', error);
    return { reports: [], total: 0 };
  }
};

export const getReportDownloadUrl = async (path: string): Promise<string | null> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/reports/download/`,
      { path },
      {
        headers: {
          token: `${API_TOKEN}`,
          'project-id': `${PROJECT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return response.data?.data?.downloadURL;
  } catch (err) {
    console.error('Error fetching signed download URL:', err);
    return null;
  }
};

export const genreateManualReport = async (
  patientId: string,
  startDate: string,
  endDate: string,
  fileFormat: string,
  reportType: string
): Promise<string | null> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/reports/create`,
      { patientId, fileFormat, reportType, startDate, endDate },
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
    console.error('Error fetching signed download URL:', err);
    return null;
  }
};

export const saveReportSettings = async (payload: ReportSettingsPayload): Promise<any> => {
  try {
    const formData = new FormData();
    formData.append('title', payload.title);
    formData.append('fileFormat', payload.fileFormat);
    formData.append('frequency', payload.frequency);

    if (payload.fileFormat === 'pdf') {
      if (payload.header) formData.append('header', payload.header);
      if (payload.footer) formData.append('footer', payload.footer);
      if (payload.logo) formData.append('file', payload.logo);
    }

    const response = await axios.post(`${API_BASE_URL}/reports/reportSettings`, formData, {
      headers: {
        token: `${API_TOKEN}`,
        'project-id': `${PROJECT_ID}`,
        'Content-Type': 'multipart/form-data',
      },
    });

    return response.data;
  } catch (err) {
    console.error('Error saving report settings:', err);
    throw err;
  }
};

export const fetchReportSettings = async (): Promise<any> => {
  try {
    const response = await axios.post(
      `${API_BASE_URL}/reports/getSettings`,
      {},
      {
        headers: {
          token: `${API_TOKEN}`,
          'project-id': `${PROJECT_ID}`,
          'Content-Type': 'application/json',
        },
      }
    );

    return {
      reports: response.data.data.report[0],
    };
  } catch (error) {
    console.error('Error fetching reports:', error);
    return { reports: [], total: 0 };
  }
};
