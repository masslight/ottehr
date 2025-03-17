import { Location, Patient } from 'fhir/r4b';
import { DateTime } from 'luxon';
import { AllStatesToNames, FacilitiesTelemed, GetChartDataResponse, StateType } from 'utils';
import { Secrets } from 'zambda-utils';
import { PdfInfo } from '../../shared/pdf/pdf-utils';
import { createReceiptPdf } from '../../shared/pdf/receipt-pdf';
import { GetPaymentDataResponse, ReceiptData } from '../../shared/pdf/types';
import { VideoResourcesAppointmentPackage } from '../../shared/pdf/visit-details-pdf/types';

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
  });
}

export async function getPaymentDataRequest(apiUrl: string, token: string, encounterId?: string): Promise<any> {
  const serviceUrl = `${apiUrl}/payment/charge/status`;

  console.debug(`Geting payment data at ${serviceUrl} for encounter ${encounterId}`);

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
      throw new Error(`Error getting charge status for the encounter. Status: ${response.statusText}`);
    }
    return response.json();
  });
}

export async function composeAndCreateReceiptPdf(
  paymentData: GetPaymentDataResponse,
  chartData: GetChartDataResponse,
  appointmentPackage: VideoResourcesAppointmentPackage,
  secrets: Secrets | null,
  token: string
): Promise<PdfInfo> {
  console.log('Start composing data for pdf');
  const data = composeDataForPdf(paymentData, chartData, appointmentPackage);
  console.log('Start creating pdf');
  return await createReceiptPdf(data, appointmentPackage.patient!, secrets, token);
}

function composeDataForPdf(
  paymentData: GetPaymentDataResponse,
  chartData: GetChartDataResponse,
  appointmentPackage: VideoResourcesAppointmentPackage
): ReceiptData {
  const { patient, location } = appointmentPackage;
  if (!patient) throw new Error('No patient found for this encounter');

  // --- Facility information ---
  console.log('Location: ' + JSON.stringify(location));
  const facilityInfo = getFacilityInfo(location);

  // --- Patient information ---
  const patientName = getPatientFullName(patient);
  const patientDOB = getPatientDob(patient);
  const patientAccountId = chartData.patientId;

  // --- Payment information ---
  const paymentAmount = `${paymentData.amount} ${paymentData.currency.toUpperCase()}`;
  const paymentDate = getPaymentDate(paymentData.date);

  return {
    facility: facilityInfo,
    patient: {
      name: patientName || '',
      dob: patientDOB || '',
      account: patientAccountId,
    },
    amount: paymentAmount,
    date: paymentDate || '',
  };
}

function getPatientFullName(patient: Patient): string | undefined {
  const name = patient.name;
  const firstName = name?.[0]?.given?.[0];
  const lastName = name?.[0]?.family;
  // const suffix = name?.[0]?.suffix?.[0];
  // const isFullName = !!firstName && !!lastName && !!suffix;
  // return isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;
  const isFullName = !!firstName && !!lastName;
  return isFullName ? `${lastName}, ${firstName}` : undefined;
}

function getPatientDob(patient: Patient): string | undefined {
  return patient?.birthDate && DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
}

function getPaymentDate(paymentDate: string): string | undefined {
  return paymentDate && DateTime.fromFormat(paymentDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
}

function getFacilityInfo(location: Location | undefined): { name: string; address: string; phone: string } | undefined {
  if (!location || !location.address || !location.address.state) {
    return undefined;
  }

  const state = location.address.state as StateType;
  const stateFullName = AllStatesToNames[state];

  if (!stateFullName) {
    return undefined;
  }

  const facility = FacilitiesTelemed.find((facility) => facility.name.includes(stateFullName));

  if (!facility) {
    return undefined;
  }

  return {
    name: facility.name,
    address: facility.address,
    phone: facility.phone,
  };
}
