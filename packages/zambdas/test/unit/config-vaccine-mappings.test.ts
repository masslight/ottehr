// The table that says which vaccine in the vaccine list replaces each vaccine the retired
// config/oystehr/vaccines.json created. The catalog upgrade (migrate-vaccine-catalog) reads it.
import { getCvxVaccine } from 'utils/lib/types/data/immunization/vaccine-lookup';
import { describe, expect, it } from 'vitest';
import { CONFIG_VACCINE_MAPPINGS } from '../../src/scripts/config-vaccine-mappings';

// The names config/oystehr/vaccines.json shipped before it was retired.
const SHIPPED_CONFIG_VACCINES = [
  'COVID-19 (Adult/Adol)',
  'COVID-19 (Pediatric)',
  'DTaP (Infanrix/Daptacel)',
  'Flu (Adult)',
  'Flu (Pediatric)',
  'Flu (Senior)',
  'Hep A (Adult)',
  'Hep A (Pediatric)',
  'Hep B (Engerix-B/Recombivax - Adult - MVX: SKB/MSD)',
  'Hep B (Engerix-B/Recombivax - Ped/Adol - MVX: SKB/MSD)',
  'Hep B (Heplisav-B - MVX: DVA)',
  'Meningococcal ACWY (Adolescent)',
  'Meningococcal ACWY (Adult/Traveler)',
  'MMR - Ped with Counseling',
  'MMR - Standard Admin',
  'Pneumococcal (PCV15 - Pediatric)',
  'Pneumococcal (PCV20 - Adult)',
  'Polio (IPV - Adult)',
  'Polio (IPV - Pediatric)',
  'Rabies (Post-Exposure)',
  'RSV (Adult)',
  'Td (Tetanus/Diphtheria)',
  'Tdap (Adacel/Boostrix)',
  'Typhoid (Injectable)',
  'Varicella - Ped',
  'Varicella - Standard Admin',
];

describe('CONFIG_VACCINE_MAPPINGS', () => {
  it('maps every shipped config vaccine, once, to a vaccine in the list', () => {
    expect(CONFIG_VACCINE_MAPPINGS.map((mapping) => mapping.configName).sort()).toEqual(
      [...SHIPPED_CONFIG_VACCINES].sort()
    );
    for (const mapping of CONFIG_VACCINE_MAPPINGS) {
      expect(getCvxVaccine(mapping.cvx), `${mapping.configName} → CVX ${mapping.cvx}`).toBeDefined();
    }
  });
});
