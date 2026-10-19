import Oystehr from '@oystehr/sdk';
import { Coding } from 'fhir/r4b';
import { PROVIDER_CONFIG } from 'utils/lib/ottehr-config/provider';
import { VitalFieldNames } from 'utils/lib/types/api/chart-data/chart-data.constants';
import { VitalsObservationDTO, VitalsVisionObservationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { OystehrTelemedAPIClient } from '../../../api/oystehrApi';

export const hasNumericVisionValue = (vitals: VitalsObservationDTO[]): boolean => {
  return vitals.some((vital) => {
    if (vital.field !== VitalFieldNames.VitalVision) return false;
    const visionVital = vital as VitalsVisionObservationDTO;
    const hasLeftVision = visionVital.leftEyeVisionText && /\d/.test(visionVital.leftEyeVisionText);
    const hasRightVision = visionVital.rightEyeVisionText && /\d/.test(visionVital.rightEyeVisionText);
    const hasBothEyesVision = visionVital.bothEyesVisionText && /\d/.test(visionVital.bothEyesVisionText);
    return Boolean(hasLeftVision || hasRightVision || hasBothEyesVision);
  });
};

export const autoAddVisionCptCodes = async ({
  vitals,
  encounterId,
  existingCptCodes,
  apiClient,
  oystehr,
  onCptCodesAdded,
}: {
  vitals: VitalsObservationDTO[];
  encounterId: string;
  existingCptCodes: Set<string>;
  apiClient: OystehrTelemedAPIClient | undefined | null;
  oystehr: Oystehr | undefined;
  /** Called after codes were added, so the caller can re-read the billing codes where they are shown. */
  onCptCodesAdded?: () => Promise<void>;
}): Promise<void> => {
  const visionAutoCptCodes = PROVIDER_CONFIG.assessment.visionAutoCptCodes ?? [];
  if (!hasNumericVisionValue(vitals) || visionAutoCptCodes.length === 0) {
    return;
  }
  if (!oystehr || !apiClient || !apiClient.saveChartData) {
    return;
  }

  const codesToAdd = visionAutoCptCodes.filter((code: string) => !existingCptCodes.has(code));

  if (codesToAdd.length === 0) {
    return;
  }

  const cptCodesWithDisplay = await Promise.all(
    codesToAdd.map(async (code: string) => {
      try {
        const result = await oystehr?.terminology.searchCpt({
          searchType: 'code',
          query: code,
          strictMatch: true,
        });
        const codeMatch = result?.codes.find((c: Coding) => c.code === code);
        if (!codeMatch?.display) {
          console.warn(`Configured vision auto CPT code ${code} was not found in CPT terminology`);
          return null;
        }
        return { code, display: codeMatch.display };
      } catch (error) {
        console.error(`Failed to look up vision auto CPT code ${code} in terminology`, error);
        return null;
      }
    })
  );

  const validCptCodes = cptCodesWithDisplay.filter((c) => c !== null);

  if (validCptCodes.length > 0) {
    await apiClient?.saveChartData?.({
      encounterId,
      cptCodes: validCptCodes,
    });

    await onCptCodesAdded?.();
  }
};
