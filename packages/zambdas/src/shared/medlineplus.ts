// Thin client for MedlinePlus Connect — the public NLM service that returns curated
// patient-education links keyed by ICD-10-CM code. Lives at the zambda-shared level
// so any zambda that needs to look up MedlinePlus
// resources can import it; promote to packages/utils if the EHR/intake apps ever
// need to call it directly.

import { PatientEducationLanguage } from 'utils';

const MEDLINE_BASE_URL = 'https://connect.medlineplus.gov/service';

// MedlinePlus's required value-set OID for ICD-10-CM. Distinct from the FHIR URN
// form (`http://hl7.org/fhir/sid/icd-10`, exported as ICD_10_CODE_SYSTEM in utils)
// — MedlinePlus's API only accepts the HL7 OID.
const ICD10_CM_OID = '2.16.840.1.113883.6.90';

interface MedlineEntry {
  title: { _value: string };
  link: { href: string; rel: string }[];
  summary: { _value: string; type: string };
}

interface MedlineResponse {
  feed: {
    entry?: MedlineEntry[];
  };
}

export interface MedlineLink {
  title: string;
  url: string;
}

export async function fetchMedlineLinks(
  icdCode: string,
  language: PatientEducationLanguage = 'en'
): Promise<MedlineLink[]> {
  // `informationRecipient.languageCode.c` controls the language of the returned materials:
  // `en` (default) → English, `es` → Spanish. MedlinePlus returns Spanish-language resources for
  // the same ICD-10 code when es is requested.
  const url = `${MEDLINE_BASE_URL}?mainSearchCriteria.v.cs=${ICD10_CM_OID}&mainSearchCriteria.v.c=${encodeURIComponent(
    icdCode
  )}&informationRecipient.languageCode.c=${language}&knowledgeResponseType=application/json`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`MedlinePlus request failed: ${response.status}`);
  }
  const data: MedlineResponse = await response.json();
  const entries = data.feed.entry ?? [];
  return entries.map((entry) => ({
    title: entry.title._value,
    url: entry.link[0]?.href ?? '',
  }));
}
