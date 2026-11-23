/** A vaccine the retired config/oystehr/vaccines.json created (name only, no CVX) and the list vaccine that replaces it. */
export interface ConfigVaccineMapping {
  configName: string;
  cvx: string;
  /** Why this CVX, where the config name covered more than one product. */
  note?: string;
}

/**
 * The 26 config vaccines → the vaccine list (CVX_VACCINES). Several config names were billing or age splits
 * of one product (MMR, Varicella, IPV, MenACWY) and map to the same vaccine. The catalog upgrade
 * (migrate-vaccine-catalog) reads it to add a catalog vaccine for each one. An instance with its own vaccines in
 * vaccines.json adds its rows here before running that upgrade.
 */
export const CONFIG_VACCINE_MAPPINGS: readonly ConfigVaccineMapping[] = [
  {
    configName: 'COVID-19 (Adult/Adol)',
    cvx: '309',
    note: 'Pfizer 12+ (30 mcg/0.3 mL); Moderna 12+ is 312, Novavax is 313',
  },
  {
    configName: 'COVID-19 (Pediatric)',
    cvx: '310',
    note: 'Pfizer 5-11 y (10 mcg/0.3 mL); Moderna 6 mo-11 y is 311',
  },
  { configName: 'DTaP (Infanrix/Daptacel)', cvx: '20', note: 'Infanrix; Daptacel (5 pertussis antigens) is 106' },
  {
    configName: 'Flu (Adult)',
    cvx: '140',
    note: 'standard-dose trivalent PF (US flu vaccines are trivalent since 2024-25); quadrivalent stock is 150',
  },
  {
    configName: 'Flu (Pediatric)',
    cvx: '140',
    note: 'children from 6 months get the same 0.5 mL trivalent dose as adults; the 0.25 mL pediatric code is 161',
  },
  { configName: 'Flu (Senior)', cvx: '135', note: 'Fluzone High-Dose trivalent; Fluad (adjuvanted trivalent) is 168' },
  { configName: 'Hep A (Adult)', cvx: '52' },
  { configName: 'Hep A (Pediatric)', cvx: '83' },
  {
    configName: 'Hep B (Engerix-B/Recombivax - Adult - MVX: SKB/MSD)',
    cvx: '43',
    note: 'one CVX covers both products at the adult dose',
  },
  {
    configName: 'Hep B (Engerix-B/Recombivax - Ped/Adol - MVX: SKB/MSD)',
    cvx: '08',
    note: 'one CVX covers both products at the pediatric dose',
  },
  { configName: 'Hep B (Heplisav-B - MVX: DVA)', cvx: '189' },
  {
    configName: 'Meningococcal ACWY (Adolescent)',
    cvx: '203',
    note: 'MenQuadfi (MenACWY-TT); Menveo is 136',
  },
  {
    configName: 'Meningococcal ACWY (Adult/Traveler)',
    cvx: '203',
    note: 'same product as the adolescent dose',
  },
  { configName: 'MMR - Ped with Counseling', cvx: '03', note: 'a billing split of one product' },
  { configName: 'MMR - Standard Admin', cvx: '03' },
  { configName: 'Pneumococcal (PCV15 - Pediatric)', cvx: '215' },
  { configName: 'Pneumococcal (PCV20 - Adult)', cvx: '216' },
  { configName: 'Polio (IPV - Adult)', cvx: '10', note: 'one product for all ages' },
  { configName: 'Polio (IPV - Pediatric)', cvx: '10' },
  {
    configName: 'Rabies (Post-Exposure)',
    cvx: '175',
    note: 'Imovax (human diploid cell); RabAvert (chick fibroblast) is 176',
  },
  {
    configName: 'RSV (Adult)',
    cvx: '303',
    note: 'Arexvy (adjuvanted RSVpreF3); Abrysvo is 305, mResvia is 326',
  },
  {
    configName: 'Td (Tetanus/Diphtheria)',
    cvx: '113',
    note: 'Tenivac and TdVax (5 Lf); the 2 Lf formulation is 09, Lf unknown is 196',
  },
  { configName: 'Tdap (Adacel/Boostrix)', cvx: '115', note: 'one CVX covers both products' },
  { configName: 'Typhoid (Injectable)', cvx: '101', note: 'Typhim Vi; the oral vaccine is 25' },
  { configName: 'Varicella - Ped', cvx: '21', note: 'a billing split of one product' },
  { configName: 'Varicella - Standard Admin', cvx: '21' },
];
