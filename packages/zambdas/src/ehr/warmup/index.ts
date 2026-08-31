import Oystehr from '@oystehr/sdk';
import { APIGatewayProxyResult } from 'aws-lambda';
import { Patient } from 'fhir/r4b';
import { checkOrCreateM2MClientToken } from '../../shared/auth';
import { ZambdaInput } from '../../shared/types/common';

let m2mToken: string;

const WARMUP_SIZE = 100;

export const index = async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
  try {
    m2mToken = await checkOrCreateM2MClientToken(m2mToken, input.secrets);
    const oystehr = new Oystehr({
      accessToken: m2mToken,
    });

    console.time(`FHIR warmup. Performed ${WARMUP_SIZE} FHIR requests at the same instant`);
    const _fhirWarmupResults = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: 'warmup-attempt' })
      )
    );
    console.timeEnd(`FHIR warmup. Performed ${WARMUP_SIZE} FHIR requests at the same instant`);
    // console.log('FHIR warmup results: ', JSON.stringify(fhirWarmupResults));

    console.time(`FHIR warmup 2. Performed ${WARMUP_SIZE} FHIR requests at the same instant`);
    const _fhirWarmupResults2 = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: 'warmup-attempt' })
      )
    );
    console.timeEnd(`FHIR warmup 2. Performed ${WARMUP_SIZE} FHIR requests at the same instant`);
    // console.log('FHIR warmup results: ', JSON.stringify(fhirWarmupResults2));

    console.time(
      `Zambda Execute Public warmup 1. Performed ${WARMUP_SIZE} execute-public requests at the same instant`
    );
    const _executePublicWarmupResults1 = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.zambda.executePublic({
          id: '4fa9d3fe-0713-49d8-a4ee-bb19da738aab',
        })
      )
    );
    console.timeEnd(
      `Zambda Execute Public warmup 1. Performed ${WARMUP_SIZE} execute-public requests at the same instant`
    );
    // console.log('execute public warmup 1 results: ', JSON.stringify(executePublicWarmupResults1));

    console.time(
      `Zambda Execute Public warmup 2. Performed ${WARMUP_SIZE} execute-public requests at the same instant`
    );
    const _executePublicWarmupResults2 = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.zambda.executePublic({
          id: '4fa9d3fe-0713-49d8-a4ee-bb19da738aab',
        })
      )
    );
    console.timeEnd(
      `Zambda Execute Public warmup 2. Performed ${WARMUP_SIZE} execute-public requests at the same instant`
    );
    // console.log('execute public warmup 2 results: ', JSON.stringify(executePublicWarmupResults2));

    console.time(`Zambda Execute Auth warmup 1. Performed ${WARMUP_SIZE} execute-auth requests at the same instant`);
    const _executeAuthWarmupResults1 = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.zambda.execute({
          id: 'warmup-execute-auth-do-nothing',
        })
      )
    );
    console.timeEnd(`Zambda Execute Auth warmup 1. Performed ${WARMUP_SIZE} execute-auth requests at the same instant`);
    // console.log('execute auth warmup 1 results: ', JSON.stringify(executeAuthWarmupResults1));

    console.time(`Zambda Execute Auth warmup 2. Performed ${WARMUP_SIZE} execute-auth requests at the same instant`);
    const _executeAuthWarmupResults2 = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.zambda.execute({
          id: 'warmup-execute-auth-do-nothing',
        })
      )
    );
    console.timeEnd(`Zambda Execute Auth warmup 2. Performed ${WARMUP_SIZE} execute-auth requests at the same instant`);
    // console.log('execute auth warmup 2 results: ', JSON.stringify(executeAuthWarmupResults2));

    console.time(`Terminology CPT search warmup. Performed ${WARMUP_SIZE} CPT search requests at the same instant`);
    const _cptWarmupResults = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.terminology.searchCpt({ searchType: 'code', strictMatch: true, query: 'warmup-attempt', limit: 1 })
      )
    );
    console.timeEnd(`Terminology CPT search warmup. Performed ${WARMUP_SIZE} CPT search requests at the same instant`);
    // console.log('CPT search warmup results: ', JSON.stringify(cptWarmupResults));

    console.time(`Terminology HCPCS search warmup. Performed ${WARMUP_SIZE} HCPCS search requests at the same instant`);
    const _hcpcsWarmupResults = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.terminology.searchHcpcs({ searchType: 'code', strictMatch: true, query: 'warmup-attempt', limit: 1 })
      )
    );
    console.timeEnd(
      `Terminology HCPCS search warmup. Performed ${WARMUP_SIZE} HCPCS search requests at the same instant`
    );
    // console.log('HCPCS search warmup results: ', JSON.stringify(hcpcsWarmupResults));

    console.time(
      `Terminology ICD-10 search warmup. Performed ${WARMUP_SIZE} ICD-10 search requests at the same instant`
    );
    const _icd10WarmupResults = await Promise.allSettled(
      Array.from({ length: WARMUP_SIZE }, () =>
        oystehr.terminology.searchIcd10({ searchType: 'code', strictMatch: true, query: 'warmup-attempt', limit: 1 })
      )
    );
    console.timeEnd(
      `Terminology ICD-10 search warmup. Performed ${WARMUP_SIZE} ICD-10 search requests at the same instant`
    );
    // console.log('ICD-10 search warmup results: ', JSON.stringify(icd10WarmupResults));

    return {
      body: JSON.stringify('warmup completed'),
      statusCode: 200,
    };
  } catch (error: any) {
    console.log('top level catch, ', error);
    return {
      body: JSON.stringify('warmup failed - top level catch'),
      statusCode: 500,
    };
  }
};
