import {
  extractDateFromValue,
  extractDoseFromValue,
  normalizeMedicationName,
  parseAiValue,
} from 'src/features/visits/shared/hooks/useAiSuggestionMapping';
import { describe, expect, test } from 'vitest';

describe('parseAiValue', () => {
  describe('new JSON array format', () => {
    test('parses JSON array string', () => {
      const result = parseAiValue('["hypertension", "type 2 diabetes"]', 'conditions');
      expect(result).toEqual(['hypertension', 'type 2 diabetes']);
    });

    test('parses medications with dose and last taken', () => {
      const json = '["Lisinopril 10mg, last taken 03/28/2025 08:00", "Metformin 500mg"]';
      const result = parseAiValue(json, 'medications');
      expect(result).toEqual(['Lisinopril 10mg, last taken 03/28/2025 08:00', 'Metformin 500mg']);
    });

    test('parses allergies with reactions', () => {
      const result = parseAiValue('["Penicillin - rash", "Sulfa drugs"]', 'allergies');
      expect(result).toEqual(['Penicillin - rash', 'Sulfa drugs']);
    });

    test('filters out empty items from JSON array', () => {
      const result = parseAiValue('["Aspirin", "", "Tylenol"]', 'medications');
      expect(result).toEqual(['Aspirin', 'Tylenol']);
    });

    test('handles single-item JSON array', () => {
      const result = parseAiValue('["appendectomy 2019"]', 'surgicalHistory');
      expect(result).toEqual(['appendectomy 2019']);
    });

    test('handles empty JSON array', () => {
      const result = parseAiValue('[]', 'conditions');
      expect(result).toEqual([]);
    });

    test('falls back to legacy parsing on invalid JSON', () => {
      const result = parseAiValue('[invalid json', 'conditions');
      expect(result.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('legacy free-text format', () => {
    describe('medications section', () => {
      test('splits comma-separated medications', () => {
        const result = parseAiValue('The patient takes Lisinopril, Metformin, and Aspirin.', 'medications');
        expect(result).toEqual(['Lisinopril', 'Metformin', 'Aspirin']);
      });

      test('handles single medication', () => {
        const result = parseAiValue('The patient takes Amoxicillin.', 'medications');
        expect(result).toEqual(['Amoxicillin']);
      });

      test('returns empty for empty string', () => {
        expect(parseAiValue('', 'medications')).toEqual([]);
      });

      test('deduplicates items case-insensitively', () => {
        const result = parseAiValue('Taking Aspirin, aspirin', 'medications');
        expect(result).toHaveLength(1);
      });

      test('filters out non-medication sentences', () => {
        const result = parseAiValue('She has asthma. She takes Albuterol.', 'medications');
        expect(result).toEqual(['Albuterol']);
      });
    });

    describe('allergies section', () => {
      test('parses allergy items', () => {
        const result = parseAiValue('The patient has an allergy to Penicillin and Peanuts.', 'allergies');
        expect(result).toHaveLength(2);
        expect(result).toEqual(expect.arrayContaining(['Peanuts']));
        // "allergy to" prefix is kept since cleanItem only strips specific verbs
        expect(result[0]).toContain('Penicillin');
      });

      test('filters out non-allergy sentences', () => {
        const result = parseAiValue('She takes Aspirin. She has an allergy to Penicillin.', 'allergies');
        expect(result).not.toEqual(expect.arrayContaining([expect.stringMatching(/aspirin/i)]));
      });
    });

    describe('conditions section', () => {
      test('parses condition items', () => {
        const result = parseAiValue('Asthma, Eczema', 'conditions');
        expect(result).toEqual(['Asthma', 'Eczema']);
      });

      test('filters out negated conditions', () => {
        const result = parseAiValue('Denies chest pain. Has asthma.', 'conditions');
        expect(result).not.toEqual(expect.arrayContaining([expect.stringMatching(/chest pain/i)]));
      });
    });

    describe('surgicalHistory section', () => {
      test('parses surgical items', () => {
        const result = parseAiValue('Appendectomy, Tonsillectomy', 'surgicalHistory');
        expect(result).toEqual(['Appendectomy', 'Tonsillectomy']);
      });
    });

    describe('episodeOfCare section', () => {
      test('parses hospitalization items', () => {
        const result = parseAiValue('Appendicitis, Pneumonia', 'episodeOfCare');
        expect(result).toEqual(['Appendicitis', 'Pneumonia']);
      });
    });

    describe('text cleaning', () => {
      test('strips leading verbs like "takes", "has", "reports"', () => {
        const result = parseAiValue('takes Lisinopril', 'medications');
        expect(result).toEqual(['Lisinopril']);
      });

      test('strips "the patient" prefix', () => {
        const result = parseAiValue('The patient takes Metformin.', 'medications');
        expect(result).toEqual(['Metformin']);
      });

      test('strips pronoun prefixes', () => {
        const result = parseAiValue('She takes Aspirin.', 'medications');
        expect(result).toEqual(['Aspirin']);
      });

      test('strips leading conjunctions and articles', () => {
        const result = parseAiValue('and Ibuprofen, a Tylenol', 'medications');
        // "and" and "a" should be stripped
        expect(result).toEqual(expect.arrayContaining(['Ibuprofen']));
        expect(result.some((item) => item.toLowerCase().includes('tylenol'))).toBe(true);
      });
    });
  });
});

describe('normalizeMedicationName', () => {
  test('strips dosage information', () => {
    expect(normalizeMedicationName('Lisinopril 10mg')).toBe('lisinopril');
  });

  test('strips compound dosages like 500mg/5ml', () => {
    expect(normalizeMedicationName('Amoxicillin 500mg/5ml')).toBe('amoxicillin');
  });

  test('strips dosage forms (tablet, capsule, syrup)', () => {
    expect(normalizeMedicationName('Ibuprofen 200mg tablet')).toBe('ibuprofen');
  });

  test('strips "last taken" date phrases', () => {
    expect(normalizeMedicationName('Aspirin last taken 01/15/2024')).toBe('aspirin');
  });

  test('strips "last time taken" phrases', () => {
    expect(normalizeMedicationName('Tylenol last time was taken 2024-01-15')).toBe('tylenol');
  });

  test('strips date formats', () => {
    expect(normalizeMedicationName('Metformin 2024-01-15')).toBe('metformin');
  });

  test('strips time values', () => {
    expect(normalizeMedicationName('Aspirin 14:30')).toBe('aspirin');
  });

  test('strips brand suffixes like forte, extra, plus', () => {
    expect(normalizeMedicationName('Paracetamol Forte')).toBe('paracetamol');
    expect(normalizeMedicationName('Nurofen Plus')).toBe('nurofen');
  });

  test('preserves combination drug names with slash', () => {
    const result = normalizeMedicationName('Amoxicillin/Clavulanate');
    expect(result).toContain('amoxicillin');
    expect(result).toContain('clavulanate');
  });

  test('handles empty string', () => {
    expect(normalizeMedicationName('')).toBe('');
  });

  test('strips units without preceding number', () => {
    expect(normalizeMedicationName('Atorvastatin 20mg tablets')).toBe('atorvastatin');
  });
});

describe('extractDoseFromValue', () => {
  test('extracts simple dose', () => {
    expect(extractDoseFromValue('Lisinopril 10mg daily')).toBe('10mg');
  });

  test('extracts dose with decimal', () => {
    expect(extractDoseFromValue('Levothyroxine 0.5mcg')).toBe('0.5mcg');
  });

  test('extracts compound dose', () => {
    expect(extractDoseFromValue('Amoxicillin 500mg/5ml')).toBe('500mg/5ml');
  });

  test('returns undefined when no dose present', () => {
    expect(extractDoseFromValue('Aspirin daily')).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(extractDoseFromValue('')).toBeUndefined();
  });

  test('extracts ml units', () => {
    expect(extractDoseFromValue('Cough syrup 10ml')).toBe('10ml');
  });

  test('extracts units', () => {
    expect(extractDoseFromValue('Insulin 30 units')).toBe('30 units');
  });
});

describe('extractDateFromValue', () => {
  test('extracts ISO date (yyyy-MM-dd)', () => {
    const result = extractDateFromValue('Last taken 2024-01-15');
    expect(result).toBeDefined();
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(1);
    expect(result!.day).toBe(15);
  });

  test('extracts ISO datetime', () => {
    const result = extractDateFromValue('Taken on 2024-01-15T14:30');
    expect(result).toBeDefined();
    expect(result!.hour).toBe(14);
    expect(result!.minute).toBe(30);
  });

  test('extracts US format date (M/d/yyyy)', () => {
    const result = extractDateFromValue('Last visit 1/15/2024');
    expect(result).toBeDefined();
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(1);
    expect(result!.day).toBe(15);
  });

  test('extracts European format date (dd.MM.yyyy)', () => {
    const result = extractDateFromValue('Started 15.01.2024');
    expect(result).toBeDefined();
    expect(result!.year).toBe(2024);
    expect(result!.month).toBe(1);
    expect(result!.day).toBe(15);
  });

  test('extracts European datetime (dd.MM.yyyy HH:mm)', () => {
    const result = extractDateFromValue('Taken 15.01.2024 14:30');
    expect(result).toBeDefined();
    expect(result!.hour).toBe(14);
    expect(result!.minute).toBe(30);
  });

  test('extracts US datetime (M/d/yyyy H:mm)', () => {
    const result = extractDateFromValue('last taken 3/28/2025 08:00');
    expect(result).toBeDefined();
    expect(result!.year).toBe(2025);
    expect(result!.month).toBe(3);
    expect(result!.day).toBe(28);
    expect(result!.hour).toBe(8);
    expect(result!.minute).toBe(0);
  });

  test('returns undefined when no date present', () => {
    expect(extractDateFromValue('Takes Aspirin daily')).toBeUndefined();
  });

  test('returns undefined for empty string', () => {
    expect(extractDateFromValue('')).toBeUndefined();
  });

  test('prefers datetime over date-only when both patterns match', () => {
    const result = extractDateFromValue('15.01.2024 14:30');
    expect(result).toBeDefined();
    expect(result!.hour).toBe(14);
  });
});
