// A pre-transpile look at the report code for the one slip that costs a round every time: a bare
// `<word>` inside JSX text (e.g. "the patient's <email>") reads as an unclosed element and sucrase
// only says "Unexpected token". The hint names the line; it is attached to a transpile error, never
// raised on its own, so a false match (a regex literal, a string) costs nothing.

/** Lines with a lowercase `<word>` that is never closed — unclosed elements are always a JSX error. */
export function bareTagHints(code: string): string[] {
  const hints: string[] = [];
  code.split('\n').forEach((line, i) => {
    for (const match of line.matchAll(/<([a-z][a-z0-9]*)>/g)) {
      if (!code.includes(`</${match[1]}>`)) {
        hints.push(
          `line ${i + 1}: "<${match[1]}>" looks like a bare <word> in JSX text — write {'<'}${
            match[1]
          }{'>'} or use words`
        );
      }
    }
  });
  return hints;
}
