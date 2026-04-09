import { describe, expect, it } from 'vitest';
import { makeAbbreviation } from './helpers';

describe('makeAbbreviation', () => {
  it('should create abbreviation from space-separated words', () => {
    expect(makeAbbreviation('Urgent Care')).toBe('UC');
    expect(makeAbbreviation('Occupational Medicine')).toBe('OM');
    expect(makeAbbreviation('Workers Comp')).toBe('WC');
  });

  it('should create abbreviation from hyphen-separated words', () => {
    expect(makeAbbreviation('Pre-Op')).toBe('PO');
    expect(makeAbbreviation('Post-Op')).toBe('PO');
    expect(makeAbbreviation('Follow-Up')).toBe('FU');
  });

  it('should create abbreviation from mixed space and hyphen separators', () => {
    expect(makeAbbreviation('Pre-Op Care')).toBe('POC');
    expect(makeAbbreviation('Post-Op Follow Up')).toBe('POFU');
    expect(makeAbbreviation('Emergency Walk-In Service')).toBe('EWIS');
  });

  it('should handle single word', () => {
    expect(makeAbbreviation('Emergency')).toBe('E');
    expect(makeAbbreviation('Consultation')).toBe('C');
  });

  it('should handle multiple spaces', () => {
    expect(makeAbbreviation('Urgent  Care')).toBe('UC');
    expect(makeAbbreviation('Pre   Op')).toBe('PO');
  });

  it('should handle multiple hyphens', () => {
    expect(makeAbbreviation('Pre--Op')).toBe('PO');
    expect(makeAbbreviation('Post---Op')).toBe('PO');
  });

  it('should handle mixed multiple separators', () => {
    expect(makeAbbreviation('Pre- -Op')).toBe('PO');
    expect(makeAbbreviation('Urgent - Care')).toBe('UC');
  });

  it('should handle leading and trailing separators', () => {
    expect(makeAbbreviation(' Urgent Care ')).toBe('UC');
    expect(makeAbbreviation('-Pre-Op-')).toBe('PO');
    expect(makeAbbreviation(' - Pre Op - ')).toBe('PO');
  });

  it('should uppercase first character of each word', () => {
    expect(makeAbbreviation('urgent care')).toBe('UC');
    expect(makeAbbreviation('pre-op')).toBe('PO');
    expect(makeAbbreviation('URGENT CARE')).toBe('UC');
  });

  it('should handle empty string', () => {
    expect(makeAbbreviation('')).toBe('');
  });

  it('should handle string with only separators', () => {
    expect(makeAbbreviation('   ')).toBe('');
    expect(makeAbbreviation('---')).toBe('');
    expect(makeAbbreviation(' - - ')).toBe('');
  });
});
