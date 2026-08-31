import { describe, expect, it } from 'vitest';
import { parseCommaSeparatedTags } from './parseCommaSeparatedTags';

describe('parseCommaSeparatedTags', () => {
  it('undefined string, empty object', () => {
    const tags = parseCommaSeparatedTags();
    expect(Object.keys(tags)).toHaveLength(0);
  });
  it('empty string, empty object', () => {
    const tags = parseCommaSeparatedTags('');
    expect(Object.keys(tags)).toHaveLength(0);
  });
  it('string with just a value, empty object', () => {
    const tags = parseCommaSeparatedTags('ottehr');
    expect(Object.keys(tags)).toHaveLength(0);
  });
  it('string with just one pair, empty object', () => {
    const tags = parseCommaSeparatedTags('project=ottehr');
    expect(tags).toEqual({ project: 'ottehr' });
  });
  it('string with just many pairs, empty object', () => {
    const tags = parseCommaSeparatedTags('project=ottehr,env=local, something=with-a-dash');
    expect(Object.keys(tags)).toHaveLength(3);
    expect(Object.keys(tags)).toEqual(['project', 'env', 'something']);
  });
});
