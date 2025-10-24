import { describe, expect, it } from 'vitest';
import { fixAndParseJsonObjectFromString } from './json-fix';

describe('fixAndParseJsonObjectFromString', () => {
  it('should remove markdown code blocks from JSON and return parsed object', () => {
    const input = '```json\n{"field": "value"}\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({ field: 'value' });
  });

  it('should handle JSON with triple backticks and json keyword', () => {
    const input = '```json\n{\n  "field": "value",\n  "another": "data"\n}\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({ field: 'value', another: 'data' });
  });

  it('should handle JSON with only backticks', () => {
    const input = '```\n{"field": "value"}\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({ field: 'value' });
  });

  it('should handle array JSON', () => {
    const input = '```json\n[{"field": "value"}]\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual([{ field: 'value' }]);
  });

  it('should handle JSON with leading and trailing whitespace', () => {
    const input = '   \n\n  {"field": "value"}  \n\n  ';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({ field: 'value' });
  });

  it('should handle JSON with extra text before and after', () => {
    const input = 'Here is the response: {"field": "value"} - end of response';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({ field: 'value' });
  });

  it('should handle already clean JSON objects', () => {
    const input = '{"field": "value"}';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({ field: 'value' });
  });

  it('should handle already clean JSON arrays', () => {
    const input = '[1, 2, 3]';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual([1, 2, 3]);
  });

  it('should handle nested structures', () => {
    const input = '```\n{"outer": {"inner": "value"}}\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({ outer: { inner: 'value' } });
  });

  it('should handle arrays of objects', () => {
    const input = '```json\n[{"id": 1}, {"id": 2}, {"id": 3}]\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('should handle empty object', () => {
    const input = '```json\n{}\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual({});
  });

  it('should handle empty array', () => {
    const input = '```json\n[]\n```';
    const result = fixAndParseJsonObjectFromString(input);
    expect(result).toEqual([]);
  });

  it('should handle complex markdown response', () => {
    const input =
      '```json\n{\n    "potentialDiagnoses": [\n        {\n            "diagnosis": "Test",\n            "icd10": "A00.0"\n        }\n    ]\n}\n```';
    const result = fixAndParseJsonObjectFromString(input) as {
      potentialDiagnoses: Array<{ diagnosis: string; icd10: string }>;
    };
    expect(result.potentialDiagnoses).toHaveLength(1);
    expect(result.potentialDiagnoses[0].diagnosis).toEqual('Test');
  });

  it('should handle empty string', () => {
    const input = '';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string');
  });

  it('should handle string with no JSON brackets', () => {
    const input = 'no json here';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string');
  });

  it('should throw error for invalid JSON after cleanup', () => {
    const input = '```json\n{invalid json content}\n```';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string: result is not valid JSON');
  });

  it('should throw error for JSON with trailing commas', () => {
    const input = '```json\n{\n    "field": "value",\n}\n```';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string: result is not valid JSON');
  });

  it('should throw error for primitive string values', () => {
    const input = '```json\n"hello world"\n```';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string: no JSON object or array found');
  });

  it('should throw error for primitive number values', () => {
    const input = '```json\n42\n```';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string: no JSON object or array found');
  });

  it('should throw error for boolean values', () => {
    const input = '```\ntrue\n```';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string: no JSON object or array found');
  });

  it('should throw error for null values', () => {
    const input = '```json\nnull\n```';
    expect(() => fixAndParseJsonObjectFromString(input)).toThrow('Invalid JSON string: no JSON object or array found');
  });
});
