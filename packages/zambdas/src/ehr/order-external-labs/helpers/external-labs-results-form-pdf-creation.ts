// import { AppointmentPackage } from '../../change-telemed-appointment-status/helpers/types';
// import {  GetChartDataResponse, getQuestionnaireResponseByLinkId, getProviderNameWithProfession  } from 'utils';
// import { Patient } from 'fhir/r4';
// import { DateTime } from 'luxon';
// import { PdfInfo } from '../../shared/pdf/pdf-utils';
// import { ExternalLabsData } from '../../shared/pdf/types';
// import { createExternalLabsOrderFormPDF } from '../../shared/pdf/external-labs-order-form-pdf';

// export async function composeAndCreateVisitNotePdf(
//   chartData: GetChartDataResponse,
//   appointmentPackage: AppointmentPackage,
//   secrets: Secrets | null,
//   token: string
// ): Promise<PdfInfo> {
//   console.log('Start composing data for pdf');
//   const data = composeDataForPdf(chartData, appointmentPackage);
//   console.log('Start creating pdf');
//   return await createExternalLabsOrderFormPDF(data, appointmentPackage.patient!, secrets, token);
// }

// function composeDataForPdf(chartData: GetChartDataResponse, appointmentPackage: AppointmentPackage): ExternalLabsData {
//   const { patient, location, questionnaireResponse, practitioner } = appointmentPackage;
//   if (!patient) throw new Error('No patient found for this encounter');
//   if (!practitioner) throw new Error('No practitioner found for this encounter');

//   // --- Patient information ---
//   const patientName = getPatientLastFirstName(patient);
//   const patientDOB = getPatientDob(patient);
//   const patientPhone = getQuestionnaireResponseByLinkId('guardian-number', questionnaireResponse)?.answer?.[0]
//     .valueString;

//   return {
//     patientFirstName: patientName?.split(', ')[0] || '',
//     patientMiddleName: patientName?.split(', ')[1] || '',
//     patientLastName: patientName?.split(', ')[2] || '',
//     patientDOB: patientDOB!,
//     patientPhone: patientPhone!,
//     todayDate: DateTime.now().toFormat('MM/dd/yyyy'),
//     orderDate: DateTime.now().toFormat('MM/dd/yyyy'),
//     providerName: getProviderNameWithProfession(practitioner),
//     providerTitle: practitioner.qualification?.[0]?.code?.text || '',
//     patientSex: patient.gender || '',
//     locationName: location?.name || '',
//     locationStreetAddress: Array.isArray(location?.address) ? location.address[0]?.text || '' : '',
//     locationCity: Array.isArray(location?.address) ? location.address[1]?.text || '' : '',
//     locationState: Array.isArray(location?.address) ? location.address[2]?.text || '' : '',
//     locationZip: Array.isArray(location?.address) ? location.address[3]?.text || '' : '',
//     locationPhone: location?.telecom?.find((t) => t.system === 'phone')?.value || '',
//     locationFax: location?.telecom?.find((t) => t.system === 'fax')?.value || '',
//     primaryInsuranceAddress: patient.address?.[0]?.text || '',
//     patientAddress: patient.address?.[0]?.text || '',
//     patientId: patient.id || '',
//     reqId: '',
//     serviceName: '',
//     providerNPI: practitioner.identifier?.find((id) => id.system === 'http://hl7.org/fhir/sid/us-npi')?.value || '',
//     aoeAnswers: [''],
//     labType: '',
//     assessmentCode: '',
//     assessmentName: '',
//     orderPriority: '', // Add the missing orderPriority property
//   };
// }

// function getPatientLastFirstName(patient: Patient): string | undefined {
//   const name = patient.name;
//   const firstName = name?.[0]?.given?.[0];
//   const lastName = name?.[0]?.family;
//   // const suffix = name?.[0]?.suffix?.[0];
//   const isFullName = !!firstName && !!lastName;
//   return isFullName ? `${lastName}, ${firstName}` : undefined;
//   // const isFullName = !!firstName && !!lastName && !!suffix;
//   // return isFullName ? `${lastName}${suffix ? ` ${suffix}` : ''}, ${firstName}` : undefined;
// }

// function getPatientDob(patient: Patient): string | undefined {
//   return patient?.birthDate && DateTime.fromFormat(patient.birthDate, 'yyyy-MM-dd').toFormat('MM/dd/yyyy');
// }
