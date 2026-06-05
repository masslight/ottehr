// Pretty-prints Claude Code stream-json events into something readable to watch
// live. Reads stream-json on stdin (one JSON object per line), writes a compact
// human view to stdout. Non-JSON lines are passed through untouched, and any
// formatting error falls back to printing the raw line — so this never swallows
// output.
import readline from 'node:readline';

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity });
const trunc = (s, n) => (s.length > n ? s.slice(0, n) + '…' : s);

rl.on('line', (line) => {
  if (!line.trim()) return;
  let ev;
  try {
    ev = JSON.parse(line);
  } catch {
    process.stdout.write(line + '\n'); // not JSON (e.g. a stray log line) — show it
    return;
  }
  try {
    if (ev.type === 'system' && ev.subtype === 'init') {
      process.stdout.write(`\n[session start — model ${ev.model ?? '?'}]\n`);
    } else if (ev.type === 'assistant' && ev.message?.content) {
      for (const b of ev.message.content) {
        if (b.type === 'text' && b.text?.trim()) {
          process.stdout.write(b.text + '\n');
        } else if (b.type === 'tool_use') {
          const inp = b.input ?? {};
          const detail =
            inp.command ?? inp.file_path ?? inp.pattern ?? inp.path ?? inp.url ?? JSON.stringify(inp);
          process.stdout.write(`\n  → ${b.name}: ${trunc(String(detail), 200)}\n`);
        }
      }
    } else if (ev.type === 'user' && ev.message?.content) {
      for (const b of ev.message.content) {
        if (b.type === 'tool_result') {
          const raw = Array.isArray(b.content)
            ? b.content.map((x) => x?.text ?? '').join('')
            : String(b.content ?? '');
          const s = raw.trim();
          if (s) process.stdout.write(`    ↳ ${trunc(s.replace(/\n/g, '\n      '), 400)}\n`);
        }
      }
    } else if (ev.type === 'result') {
      const tag = ev.is_error ? 'ERROR' : ev.subtype ?? 'done';
      process.stdout.write(`\n=== session result: ${tag} ===\n`);
    }
  } catch {
    process.stdout.write(line + '\n'); // formatting blew up — fall back to raw
  }
});
