// What each lab row measures, in LOINC terms. A result belongs on a row when its LOINC code has one of the row's
// components in one of its specimens, in any unit, property or (unless narrowed) method. The code lists themselves
// are generated from these rules into lab-loinc-codes.generated.ts by src/scripts/generate-flowsheet-loinc-codes.ts.

export interface LabRowRule {
  /** LOINC COMPONENT values, spelled as LOINC spells them (e.g. 'Thyroxine.free'). */
  components: string[];
  /** LOINC SYSTEM (specimen) names as the long common name spells them (e.g. 'Serum or Plasma'). */
  systems: string[];
  /** Keep only codes with one of these LOINC METHOD_TYP values ('' = no method); any method when absent. */
  methods?: string[];
  excludeMethods?: string[];
}

const SERUM_OR_PLASMA = ['Serum or Plasma', 'Serum', 'Plasma'];
// A newborn's bilirubin is often run on a heel-stick (whole, capillary or venous blood) sample; a cord blood level
// is taken at delivery and stays off.
const SERUM_PLASMA_OR_BLOOD = [...SERUM_OR_PLASMA, 'Blood', 'Capillary blood', 'Venous blood'];

export const LAB_ROW_RULES: Record<string, LabRowRule> = {
  // Thyroid
  tsh: { components: ['Thyrotropin'], systems: SERUM_OR_PLASMA },
  freeT4: { components: ['Thyroxine.free'], systems: SERUM_OR_PLASMA },
  totalT4: { components: ['Thyroxine'], systems: SERUM_OR_PLASMA },
  freeT3: { components: ['Triiodothyronine.free'], systems: SERUM_OR_PLASMA },
  totalT3: { components: ['Triiodothyronine'], systems: SERUM_OR_PLASMA },
  tpoAntibodies: { components: ['Thyroperoxidase Ab'], systems: SERUM_OR_PLASMA },
  // Newborn bilirubin. LOINC's total bilirubin component is plain 'Bilirubin'; "direct" is the glucuronidated plus
  // albumin-bound fraction and "conjugated" the glucuronidated one.
  newbornTotalBilirubin: { components: ['Bilirubin'], systems: SERUM_PLASMA_OR_BLOOD },
  newbornDirectBilirubin: {
    components: ['Bilirubin.glucuronidated+Bilirubin.albumin bound', 'Bilirubin.glucuronidated'],
    systems: SERUM_PLASMA_OR_BLOOD,
  },
  transcutaneousBilirubin: { components: ['Bilirubin'], systems: ['Skin'] },
};
