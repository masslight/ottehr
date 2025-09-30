import { describe, expect, it, vi } from 'vitest';
import { generateIcdCodesFromClinicalNotes } from '../src/shared/ai';

// Mock the invokeChatbot function since we don't want to make actual AI calls in tests
vi.mock('../src/shared/ai', async (importOriginal) => {
  const original = await importOriginal();
  return {
    ...original,
    invokeChatbot: vi.fn(),
  };
});

describe('AI ICD generation tests', () => {
  it('should return empty array when no HPI or MDM text is provided', async () => {
    const result = await generateIcdCodesFromClinicalNotes();
    expect(result).toEqual([]);
  });

  it('should return empty array when empty strings are provided', async () => {
    const result = await generateIcdCodesFromClinicalNotes('', '');
    expect(result).toEqual([]);
  });

  it('should return empty array when only whitespace is provided', async () => {
    const result = await generateIcdCodesFromClinicalNotes('   \n\t  ', '  \n  ');
    expect(result).toEqual([]);
  });

  it('should handle AI service errors gracefully', async () => {
    const { invokeChatbot } = await import('../src/shared/ai');
    vi.mocked(invokeChatbot).mockRejectedValue(new Error('AI service unavailable'));

    const result = await generateIcdCodesFromClinicalNotes('Patient has fever', 'Viral infection suspected');
    expect(result).toEqual([]);
  });

  it('should handle malformed AI responses gracefully', async () => {
    const { invokeChatbot } = await import('../src/shared/ai');
    vi.mocked(invokeChatbot).mockResolvedValue({
      content: { toString: () => 'invalid json response' }
    } as any);

    const result = await generateIcdCodesFromClinicalNotes('Patient has fever', 'Viral infection suspected');
    expect(result).toEqual([]);
  });

  it('should parse valid AI responses correctly', async () => {
    const { invokeChatbot } = await import('../src/shared/ai');
    const mockResponse = {
      potentialDiagnoses: [
        { diagnosis: 'Viral upper respiratory infection', icd10: 'J06.9' },
        { diagnosis: 'Fever, unspecified', icd10: 'R50.9' }
      ]
    };
    
    vi.mocked(invokeChatbot).mockResolvedValue({
      content: { toString: () => JSON.stringify(mockResponse) }
    } as any);

    const result = await generateIcdCodesFromClinicalNotes('Patient has fever and sore throat', 'Likely viral infection');
    
    expect(result).toHaveLength(2);
    expect(result[0]).toEqual({ diagnosis: 'Viral upper respiratory infection', icd10: 'J06.9' });
    expect(result[1]).toEqual({ diagnosis: 'Fever, unspecified', icd10: 'R50.9' });
  });

  it('should handle AI responses without potentialDiagnoses field', async () => {
    const { invokeChatbot } = await import('../src/shared/ai');
    vi.mocked(invokeChatbot).mockResolvedValue({
      content: { toString: () => JSON.stringify({}) }
    } as any);

    const result = await generateIcdCodesFromClinicalNotes('Patient has headache', 'Tension headache likely');
    expect(result).toEqual([]);
  });

  it('should work with HPI text only', async () => {
    const { invokeChatbot } = await import('../src/shared/ai');
    const mockResponse = {
      potentialDiagnoses: [
        { diagnosis: 'Tension-type headache', icd10: 'G44.209' }
      ]
    };
    
    vi.mocked(invokeChatbot).mockResolvedValue({
      content: { toString: () => JSON.stringify(mockResponse) }
    } as any);

    const result = await generateIcdCodesFromClinicalNotes('Patient reports headache for 2 days');
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ diagnosis: 'Tension-type headache', icd10: 'G44.209' });
  });

  it('should work with MDM text only', async () => {
    const { invokeChatbot } = await import('../src/shared/ai');
    const mockResponse = {
      potentialDiagnoses: [
        { diagnosis: 'Hypertension, unspecified', icd10: 'I10' }
      ]
    };
    
    vi.mocked(invokeChatbot).mockResolvedValue({
      content: { toString: () => JSON.stringify(mockResponse) }
    } as any);

    const result = await generateIcdCodesFromClinicalNotes(undefined, 'Patient diagnosed with hypertension');
    
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ diagnosis: 'Hypertension, unspecified', icd10: 'I10' });
  });
});