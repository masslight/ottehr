// Auto-repair for a known-bad pattern in generated report code: `element.innerHTML += html`.
//
// `innerHTML +=` re-serializes and re-parses ALL existing children of the element, so an
// already-painted chart <canvas> comes back as a fresh blank canvas — the report silently loses its
// charts (no error is thrown). `element.insertAdjacentHTML('beforeend', html)` is semantically
// identical for an HTML-string RHS but preserves existing children, so canvases survive.
//
// New generations are steered away from the pattern by a prompt rule + a retryable backstop in the
// generate-adhoc-report zambda, but reports SAVED before that fix have the broken code persisted —
// this transform heals them (and any backstop escapee) at render time.
//
// A naive regex can't capture the RHS: appended HTML routinely contains semicolons inside the
// string (`style="color:red;"`, `&nbsp;`), so `[^;]+` truncates. Instead this is a small
// quote-aware scanner:
//   - walks the source tracking string/template/comment state, so `.innerHTML +=` inside a string
//     literal or comment is never rewritten;
//   - captures the LHS by walking left over an identifier/property/index chain;
//   - captures the RHS by scanning right while tracking quotes (' " `), template `${}` nesting and
//     bracket/paren depth, until a `;` or a (non-continuation) newline at depth 0 outside quotes.
// Plain `X.innerHTML = Y` (single `=`) is untouched. The transform is idempotent (its output
// contains no `.innerHTML +=`), and any occurrence it can't parse cleanly is left unchanged —
// fail safe, never corrupt the code.

const INNER_HTML = '.innerHTML';

const isIdentChar = (c: string | undefined): boolean => c !== undefined && /[\w$]/.test(c);

/** Walk LEFT from `dotIdx` (the `.` of `.innerHTML`) over an identifier/property/index/call chain
 *  (`\w`, `$`, `.`, `[...]` / `(...)` with quoted contents — e.g.
 *  `document.getElementById('drill')`). Returns the chain's start index, or -1 if no clean chain is
 *  found. */
const scanLhsStart = (code: string, dotIdx: number): number => {
  let i = dotIdx - 1;
  let expectingSegment = true; // the position to the left must hold another chain segment
  while (i >= 0 && expectingSegment) {
    const c = code[i];
    if (isIdentChar(c)) {
      while (i >= 0 && isIdentChar(code[i])) i--;
      expectingSegment = false;
      if (i >= 0 && code[i] === '.') {
        i--;
        expectingSegment = true; // a.b.innerHTML — keep walking the chain
      }
      continue;
    }
    if (c === ']' || c === ')') {
      // Walk left to the matching opener, skipping quoted segments (e.g. rows['a;b'],
      // getElementById('drill')).
      const open = c === ']' ? '[' : '(';
      let depth = 0;
      while (i >= 0) {
        const b = code[i];
        if (b === "'" || b === '"') {
          i--;
          while (i >= 0 && code[i] !== b) i--;
          if (i < 0) return -1; // unterminated quote scanning left — bail
          i--;
          continue;
        }
        if (b === c) depth++;
        else if (b === open) {
          depth--;
          if (depth === 0) break;
        }
        i--;
      }
      if (i < 0) return -1; // no matching opener — bail
      i--; // move left of the opener; it must be preceded by another segment (arr[0], f(x))
      continue;
    }
    return -1; // chain starts with something we don't model — bail
  }
  if (expectingSegment) return -1; // ran off the start of the source mid-chain
  const start = i + 1;
  return start < dotIdx ? start : -1;
};

interface RhsScan {
  rhs: string;
  /** Index just past the consumed statement (past the terminator, if one was consumed). */
  end: number;
  /** The original terminator to re-emit: ';', '\n', or '' (EOF / closing bracket). */
  terminator: string;
}

/** Chars that, as the last non-whitespace char before a newline, mean the expression continues on
 *  the next line (so the newline is NOT a statement terminator). */
const CONTINUATION_TAIL = new Set([...'+-*/%&|^=<>?:,([{.']);
/** Chars that, starting the next line, continue the expression (`+ '…'`, `.concat(…)`, `? :`). */
const CONTINUATION_HEAD = new Set([...'+.?:*/%&|=<>,']);

const finishRhs = (code: string, start: number, end: number, terminator: string): RhsScan | null => {
  const rhs = code.slice(start, end).trim();
  if (!rhs) return null;
  return { rhs, end: end + terminator.length, terminator };
};

/** Scan RIGHT from `start` (just past `+=`) to the end of the assigned expression. Quote-aware and
 *  depth-aware; returns null if the expression can't be delimited cleanly. */
const scanRhs = (code: string, start: number): RhsScan | null => {
  let depth = 0; // (, [, { and template-${ nesting, shared
  let quote: string | null = null; // ', ", or ` when inside a string/template literal
  const templateEntryDepths: number[] = []; // depth recorded when each `${` opened
  let lastNonWs = '';
  let i = start;
  while (i < code.length) {
    const c = code[i];
    if (quote) {
      if (c === '\\') {
        i += 2;
        continue;
      }
      if (c === quote) {
        quote = null;
      } else if (quote === '`' && c === '$' && code[i + 1] === '{') {
        templateEntryDepths.push(depth);
        quote = null;
        depth++;
        i += 2;
        continue;
      }
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      lastNonWs = c;
      i++;
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      while (i < code.length && code[i] !== '\n') i++;
      continue; // the newline itself is handled by the terminator logic below
    }
    if (c === '/' && code[i + 1] === '*') {
      const close = code.indexOf('*/', i + 2);
      if (close === -1) return null; // unterminated comment — bail
      i = close + 2;
      continue;
    }
    if (c === '(' || c === '[' || c === '{') {
      depth++;
    } else if (c === ')' || c === ']' || c === '}') {
      // Statement ends because an enclosing bracket closes (e.g. `foo(el.innerHTML += x)`).
      if (depth === 0) return finishRhs(code, start, i, '');
      depth--;
      if (
        c === '}' &&
        templateEntryDepths.length > 0 &&
        depth === templateEntryDepths[templateEntryDepths.length - 1]
      ) {
        templateEntryDepths.pop();
        quote = '`'; // this `}` closed a `${…}` — resume the template literal
        i++;
        continue;
      }
    } else if (c === ';' && depth === 0) {
      return finishRhs(code, start, i, ';');
    } else if (c === '\n' && depth === 0) {
      if (CONTINUATION_TAIL.has(lastNonWs)) {
        i++;
        continue;
      }
      // Peek the next non-whitespace char: an operator start continues the expression (ASI-style).
      let j = i + 1;
      while (j < code.length && /\s/.test(code[j])) j++;
      if (j < code.length && CONTINUATION_HEAD.has(code[j])) {
        i = j;
        continue;
      }
      return finishRhs(code, start, i, '\n');
    }
    if (!/\s/.test(c)) lastNonWs = c;
    i++;
  }
  if (quote !== null || templateEntryDepths.length > 0 || depth !== 0) return null; // unterminated — bail
  return finishRhs(code, start, i, '');
};

/**
 * Rewrite every `<expr>.innerHTML += <rhs>` into `<expr>.insertAdjacentHTML('beforeend', <rhs>)`.
 * Pure, idempotent, and fail-safe: occurrences that can't be parsed cleanly (and any occurrence
 * inside a string/template/comment) are left byte-for-byte unchanged; plain `X.innerHTML = Y`
 * assignments are untouched.
 */
export const repairGeneratedReportCode = (code: string): string => {
  let out = '';
  let i = 0;
  let quote: string | null = null;
  let depth = 0; // ALL `{` braces (code blocks, object literals, template-${) — shared counter
  const templateEntryDepths: number[] = []; // depth recorded when each `${` opened
  while (i < code.length) {
    const c = code[i];
    if (quote) {
      if (c === '\\') {
        out += code.slice(i, i + 2);
        i += 2;
        continue;
      }
      if (c === quote) {
        quote = null;
      } else if (quote === '`' && c === '$' && code[i + 1] === '{') {
        templateEntryDepths.push(depth);
        quote = null;
        depth++;
        out += '${';
        i += 2;
        continue;
      }
      out += c;
      i++;
      continue;
    }
    if (c === "'" || c === '"' || c === '`') {
      quote = c;
      out += c;
      i++;
      continue;
    }
    if (c === '/' && code[i + 1] === '/') {
      const nl = code.indexOf('\n', i);
      const end = nl === -1 ? code.length : nl;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (c === '/' && code[i + 1] === '*') {
      const close = code.indexOf('*/', i + 2);
      const end = close === -1 ? code.length : close + 2;
      out += code.slice(i, end);
      i = end;
      continue;
    }
    if (c === '{') {
      depth++;
    } else if (c === '}') {
      if (depth > 0) depth--;
      if (templateEntryDepths.length > 0 && depth === templateEntryDepths[templateEntryDepths.length - 1]) {
        templateEntryDepths.pop();
        quote = '`'; // this `}` closed a `${…}` — resume the template literal
      }
      out += c;
      i++;
      continue;
    }
    if (c === '.' && code.startsWith(INNER_HTML, i) && !isIdentChar(code[i + INNER_HTML.length])) {
      // Candidate. Require `+=` after optional whitespace (a single `=` is a plain assignment).
      let j = i + INNER_HTML.length;
      while (j < code.length && /[ \t]/.test(code[j])) j++;
      if (code[j] === '+' && code[j + 1] === '=') {
        const lhsStart = scanLhsStart(code, i);
        const scanned = lhsStart === -1 ? null : scanRhs(code, j + 2);
        if (lhsStart !== -1 && scanned) {
          const lhs = code.slice(lhsStart, i);
          // The LHS text was already copied to `out` verbatim — replace it with the rewrite.
          out = out.slice(0, out.length - lhs.length);
          out += `${lhs}.insertAdjacentHTML('beforeend', ${scanned.rhs})${scanned.terminator}`;
          i = scanned.end;
          continue;
        }
        // Couldn't parse cleanly — leave this occurrence untouched (fail safe).
      }
    }
    out += c;
    i++;
  }
  return out;
};
