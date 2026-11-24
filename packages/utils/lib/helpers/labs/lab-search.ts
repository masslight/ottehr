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

// shorter words like "d" in "Vitamin D" or "b" in "B12" are too likely to be part of a test name
const MIN_LAB_TOKEN_LENGTH = 3;

// Every word is checked against the project's labs. Words that start no lab name are test words.
const tokenMatchesLabName = (token: string, labName: string): boolean => {
  const normalizedToken = normalize(token);
  // also rules out punctuation-only words like "/" or "-", which normalize to "" and would match every lab
  if (normalizedToken.length < MIN_LAB_TOKEN_LENGTH) return false;
  // only the start of the full name counts: "labcorp" matches "Lab Corp" and "path" matches "PathGroup",
  // but "d" does not match "Quest Diagnostics", so "Vitamin D quest" keeps its "D"
  return normalize(labName).startsWith(normalizedToken);
};

/**
 * Splits a lab test search such as "TSH quest" or "TSH path" into the test name part ("TSH")
 * and the labs named in it (Quest, PathGroup), matching each word against the start of a lab's
 * full name. Consecutive words are joined while they still start a lab name, so a name typed
 * with spaces ("quest diagnostics", "lab corp") is one lab. Several labs can be named at once
 * ("TSH quest labcorp").
 *
 * A search made only of lab-name words ("auto" for Autolab) comes back with an empty testSearch,
 * meaning "everything at that lab".
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

  const matchedLabs = labs.filter((lab) => labTokens.some((token) => tokenMatchesLabName(token, lab.labName)));

  return { testSearch: testTokens.join(' '), matchedLabs };
};
