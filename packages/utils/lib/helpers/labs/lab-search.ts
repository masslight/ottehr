export interface LabSearchCandidate {
  labGuid: string;
  labName: string;
}

export interface ParsedLabSearch<T extends LabSearchCandidate> {
  /** The search with any lab-name terms removed; this is what gets sent as the test name search. Empty when the search is only a lab name. */
  testSearch: string;
  /** Labs named in the search. Empty when the search names no lab. */
  matchedLabs: T[];
}

const normalize = (value: string): string => value.toLowerCase().replace(/[^a-z0-9]/g, '');

// A project has a small, fixed set of labs, so every word is checked against them, however short:
// "a" means every lab starting with A. Words that start no lab name are test words.
const tokenMatchesLabName = (token: string, labName: string): boolean => {
  const normalizedToken = normalize(token);
  // punctuation-only words like "/" or "-" normalize to "" and would otherwise match every lab
  if (!normalizedToken) return false;
  // "labcorp" matches "Lab Corp", "path" matches "PathGroup"
  if (normalize(labName).startsWith(normalizedToken)) return true;
  return labName.split(/\s+/).some((word) => normalize(word).startsWith(normalizedToken));
};

/**
 * Splits a lab test search such as "TSH quest" or "TSH path" into the test name part ("TSH")
 * and the labs named in it (Quest, PathGroup), matching each word against the start of a lab name
 * or of any word in it.
 *
 * A search made only of lab-name words ("auto" for Autolab) comes back with an empty testSearch,
 * meaning "everything at that lab". When the lab words point at different labs, labs matching
 * every lab word win ("quest diagnostics" is Quest, not every "... Diagnostics" lab); if none
 * match them all, every lab matching any of them is kept ("tsh quest labcorp").
 */
export const parseLabSearch = <T extends LabSearchCandidate>(search: string, labs: T[]): ParsedLabSearch<T> => {
  const tokens = search.trim().split(/\s+/).filter(Boolean);
  const testTokens: string[] = [];
  const labTokens: string[] = [];

  const namesALab = (token: string): boolean => labs.some((lab) => tokenMatchesLabName(token, lab.labName));

  for (let i = 0; i < tokens.length; i++) {
    let token = tokens[i];
    if (!namesALab(token)) {
      testTokens.push(token);
      continue;
    }
    // a lab name typed with spaces ("lab corp" for LabCorp): keep joining the next word while the
    // joined text still starts a lab name, so "corp" isn't left behind as a test word
    while (i + 1 < tokens.length && namesALab(token + tokens[i + 1])) token += tokens[++i];
    labTokens.push(token);
  }

  if (labTokens.length === 0) {
    return { testSearch: search.trim(), matchedLabs: [] };
  }

  const matchesAll = labs.filter((lab) => labTokens.every((token) => tokenMatchesLabName(token, lab.labName)));
  const matchedLabs = matchesAll.length
    ? matchesAll
    : labs.filter((lab) => labTokens.some((token) => tokenMatchesLabName(token, lab.labName)));

  return { testSearch: testTokens.join(' '), matchedLabs };
};
