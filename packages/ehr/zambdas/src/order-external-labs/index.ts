// import { FhirClient } from '@zapehr/sdk';
// import { APIGatewayProxyResult } from 'aws-lambda';
// import { ChangeTelemedAppointmentStatusInput, ChangeTelemedAppointmentStatusResponse } from 'utils';
// import { checkOrCreateM2MClientToken, createFhirClient } from '../shared/helpers';
// import { ZambdaInput } from 'zambda-utils';
// import { getVideoResources } from './helpers/fhir-utils';
// import { makeVisitNotePdfDocumentReference } from './helpers/helpers';
// import { validateRequestParameters } from './validateRequestParameters';
// import { createExternalLabsResultsFormPDF } from '../shared/pdf/external-labs-results-form-pdf';

// // Lifting up value to outside of the handler allows it to stay in memory across warm lambda invocations
// let m2mtoken: string;

// export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
//   try {
//     const validatedParameters = validateRequestParameters(input);

//     m2mtoken = await checkOrCreateM2MClientToken(m2mtoken, validatedParameters.secrets);

//     const fhirClient = createFhirClient(m2mtoken, validatedParameters.secrets);
//     console.log('Created zapToken and fhir client');

//     const response = await performEffect(fhirClient, validatedParameters);
//     return {
//       statusCode: 200,
//       body: JSON.stringify(response),
//     };
//   } catch (error: any) {
//     console.error('Stringified error: ' + JSON.stringify(error));
//     console.error('Error: ' + error);
//     return {
//       statusCode: 500,
//       body: JSON.stringify({ message: 'Error changing appointment status and creating a charge.' }),
//     };
//   }
// };

// export const performEffect = async (
//   fhirClient: FhirClient,
//   params: ChangeTelemedAppointmentStatusInput
// ): Promise<ChangeTelemedAppointmentStatusResponse> => {
//   const { appointmentId, secrets } = params;

//   const visitResources = await getVideoResources(fhirClient, appointmentId);
//   if (!visitResources) {
//     {
//       throw new Error(`Visit resources are not properly defined for appointment ${appointmentId}`);
//     }
//   }
//   const { encounter, patient, appointment } = visitResources;

//   console.log(`appointment and encounter statuses: ${appointment.status}, ${encounter.status}`);

//   console.debug(`Status has been changed.`);

//   // Define labsData before using it
//   const labsData = {
//     locationName: 'North Babylon, NY',
//     locationStreetAddress: '123 Example Address',
//     locationCity: 'North Babylon',
//     locationState: 'NY',
//     locationZip: '12345',
//     locationPhone: '123 456 7890',
//     locationFax: '123 456 7891',
//     serviceName: 'In Person',
//     reqId: 'RG45890N21',
//     providerName: 'Dr. Smith',
//     providerTitle: 'MD',
//     providerNPI: '12345678290',
//     providerPhone: '123 456 7890',
//     providerFax: '123 456 7891',
//     providerEmail: 'provider@example.com',
//     patientFirstName: 'First',
//     patientMiddleName: 'Middle',
//     patientLastName: 'Last',
//     patientDOB: '01/01/2000',
//     patientGender: 'Male',
//     patientSex: 'Male',
//     patientPhone: '123 456 7890',
//     patientEmail: 'patient@example.com',
//     patientAddress: '123 Example Address',
//     patientCity: 'Example City',
//     patientState: 'EX',
//     patientZip: '12345',
//     primaryInsuranceName: 'BCBS Gold PPO',
//     primaryInsurancePhone: '123 456 7890',
//     primaryInsuranceAddress: '123 Example Address',
//     insuredName: 'Example Insured Name',
//     insuredAddress: '123 Example Address',
//     primaryInsuranceSubNum: '123423121',
//     primaryInsuranceState: 'EX',
//     primaryInsuranceZip: '12345',
//     patientId: '983728975',
//     todayDate: '10/10/2024',
//     patientInsuranceType: 'Example Insurance Type',
//     patientInsurancePolicy: 'Example Policy',
//     patientInsuranceGroupNumber: 'Example Group Number',
//     orderDate: '10/11/2024',
//     aoeAnswers: [
//       'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla augue lorem, fermentum placerat iaculis ut, dapibus at odio. In tempor lacus vel nulla ultrices mattis. Sed sed nunc mattis, eleifend ipsum id, dapibus neque. Vivamus mattis non lacus nec feugiat. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.',
//       'Nulla augue lorem',
//       'dapibus at odio',
//       'Lorem',
//       'ipsum',
//     ],
//     priority: 'stat',
//     labType: 'Culture, throat',
//     orderType: 'new',
//     orderStatus: 'pending',
//     assessmentCode: '-J02.9',
//     assessmentName: 'Sore throat',
//     instructions: 'Example Instructions',
//     accessionNumber: '123456',
//     requisitionNumber: '123456',
//     orderReceived: '10/10/2024',
//     specimenReceived: '10/10/2024',
//     reportDate: '10/10/2024',
//     specimenSource: 'Throat',
//     Dx: 'Sore throat',
//     specimenDescription: 'Throat culture',
//     specimenValue: 'Positive',
//     specimenReferenceRange: 'Negative',
//     resultBody:
//       'Lorem ipsum dolor sit amet, consectetur adipiscing elit. Nulla augue lorem, fermentum placerat iaculis ut, dapibus at odio. In tempor lacus vel nulla ultrices mattis. Sed sed nunc mattis, eleifend ipsum id, dapibus neque. Vivamus mattis non lacus nec feugiat. Orci varius natoque penatibus et magnis dis parturient montes, nascetur ridiculus mus.',
//     resultPhase: 'F',
//     reviewingProviderFirst: 'Sally',
//     reviewingProviderLast: 'Mink',
//     reviewingProviderTitle: 'Dr.',
//     reviewDate: '10/10/2024',
//     performingLabCode: '123456',
//     performingLabName: 'MedFusion',
//     performingLabStreetAddress: '123 Example Address',
//     performingLabCity: 'Example City',
//     performingLabState: 'EX',
//     performingLabZip: '12345',
//     performingLabDirectorLast: 'White',
//     performingLabPhone: '123 456 7890',
//     abnormalResult: true,
//     performingLabProviderFirstName: 'John',
//     performingLabProviderLastName: 'Smith',
//     performingLabProviderTitle: 'MD',
//     performingLabDirector: 'Dr. White',
//     orderPriority: 'routine',
//   };

//   await createExternalLabsResultsFormPDF(labsData, visitResources.patient!, secrets, m2mtoken);
//   console.log('creating dft sync task');
//   console.log('Creating external labs results form PDF');
//   const externalLabsResultsFormPdf = await createExternalLabsResultsFormPDF(
//     labsData,
//     visitResources.patient!,
//     secrets,
//     m2mtoken
//   );
//   console.log('External labs results form PDF created:', externalLabsResultsFormPdf);
//   await makeVisitNotePdfDocumentReference(
//     fhirClient,
//     externalLabsResultsFormPdf,
//     patient?.id || '',
//     appointmentId,
//     encounter.id!
//   );
//   return { message: 'Status has been changed.' };
// };
