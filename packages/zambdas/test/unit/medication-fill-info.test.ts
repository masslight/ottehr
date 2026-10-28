import { FHIR_EXTENSION } from 'utils/lib/fhir/constants';
import { MedicationDTO } from 'utils/lib/types/api/chart-data/chart-data.types';
import { describe, expect, it } from 'vitest';
import { makeMedicationDTO, makeMedicationResource } from '../../src/shared/chart-data';

const baseMedication: MedicationDTO = {
  name: 'Lisinopril 10 mg tablet',
  id: '12345',
  type: 'scheduled',
  status: 'active',
  intakeInfo: { date: '2025-10-01T14:00:00.000Z' },
};

const toResource = (data: MedicationDTO): ReturnType<typeof makeMedicationResource> =>
  makeMedicationResource('enc-1', 'pat-1', 'prac-1', data, 'current-medication');

describe('medication last filled date and refills', () => {
  it('round-trips last filled date and refills through MedicationStatement extensions', () => {
    const resource = toResource({
      ...baseMedication,
      intakeInfo: { ...baseMedication.intakeInfo, lastFilledDate: '2025-10-12', refills: 3 },
    });

    expect(resource.extension).toEqual([
      { url: FHIR_EXTENSION.MedicationStatement.lastFilledDate.url, valueDateTime: '2025-10-12' },
      { url: FHIR_EXTENSION.MedicationStatement.refills.url, valueInteger: 3 },
    ]);
    expect(resource.effectiveDateTime).toBe('2025-10-01T14:00:00.000Z');

    const dto = makeMedicationDTO(resource);
    expect(dto.intakeInfo.lastFilledDate).toBe('2025-10-12');
    expect(dto.intakeInfo.refills).toBe(3);
    expect(dto.intakeInfo.date).toBe('2025-10-01T14:00:00.000Z');
  });

  it('keeps zero refills', () => {
    const dto = makeMedicationDTO(toResource({ ...baseMedication, intakeInfo: { refills: 0 } }));
    expect(dto.intakeInfo.refills).toBe(0);
  });

  it('omits the extensions when neither value is provided', () => {
    const resource = toResource(baseMedication);
    expect(resource.extension).toBeUndefined();

    const dto = makeMedicationDTO(resource);
    expect(dto.intakeInfo.lastFilledDate).toBeUndefined();
    expect(dto.intakeInfo.refills).toBeUndefined();
  });

  it('keeps the renewal extension alongside the fill info', () => {
    const resource = toResource({ ...baseMedication, isRenewal: true, intakeInfo: { refills: 2 } });
    const dto = makeMedicationDTO(resource);
    expect(dto.isRenewal).toBe(true);
    expect(dto.intakeInfo.refills).toBe(2);
  });
});
