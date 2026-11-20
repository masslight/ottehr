/**
 * Minimal XML reader for the CDSi supporting data and xlsx sheet XML: elements, attributes, text.
 * No namespaces, CDATA, processing-instruction or DTD handling beyond skipping them.
 */

export interface XmlElement {
  name: string;
  attrs: Record<string, string>;
  children: XmlElement[];
  text: string;
}

const ENTITIES: Record<string, string> = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };

export function decodeEntities(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|[a-zA-Z]+);/g, (m, e: string) => {
    if (e.startsWith('#x')) return String.fromCodePoint(parseInt(e.slice(2), 16));
    if (e.startsWith('#')) return String.fromCodePoint(parseInt(e.slice(1), 10));
    return ENTITIES[e] ?? m;
  });
}

function parseAttrs(s: string): Record<string, string> {
  const attrs: Record<string, string> = {};
  const re = /([^\s=]+)\s*=\s*("([^"]*)"|'([^']*)')/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(s)) !== null) {
    attrs[m[1]] = decodeEntities(m[3] ?? m[4] ?? '');
  }
  return attrs;
}

export function parseXml(xml: string): XmlElement {
  const root: XmlElement = { name: '#document', attrs: {}, children: [], text: '' };
  const stack: XmlElement[] = [root];
  let i = 0;
  const n = xml.length;
  while (i < n) {
    const lt = xml.indexOf('<', i);
    if (lt < 0) break;
    if (lt > i) {
      const text = xml.slice(i, lt);
      if (text.trim()) stack[stack.length - 1].text += decodeEntities(text);
    }
    if (xml.startsWith('<?', lt) || xml.startsWith('<!', lt)) {
      const end = xml.startsWith('<!--', lt) ? xml.indexOf('-->', lt) + 3 : xml.indexOf('>', lt) + 1;
      if (end <= 0) throw new Error('Unterminated declaration');
      i = end;
      continue;
    }
    const gt = xml.indexOf('>', lt);
    if (gt < 0) throw new Error('Unterminated tag');
    const body = xml.slice(lt + 1, gt);
    i = gt + 1;
    if (body.startsWith('/')) {
      const name = body.slice(1).trim();
      const el = stack.pop();
      if (!el || el.name !== name) throw new Error(`Mismatched closing tag </${name}> (open: ${el?.name})`);
      continue;
    }
    const selfClosing = body.endsWith('/');
    const inner = selfClosing ? body.slice(0, -1) : body;
    const space = inner.search(/\s/);
    const name = space < 0 ? inner : inner.slice(0, space);
    const el: XmlElement = {
      name,
      attrs: space < 0 ? {} : parseAttrs(inner.slice(space)),
      children: [],
      text: '',
    };
    stack[stack.length - 1].children.push(el);
    if (!selfClosing) stack.push(el);
  }
  if (stack.length !== 1) throw new Error(`Unclosed element <${stack[stack.length - 1].name}>`);
  return root;
}

export function child(el: XmlElement, name: string): XmlElement | undefined {
  return el.children.find((c) => c.name === name);
}

export function children(el: XmlElement, name: string): XmlElement[] {
  return el.children.filter((c) => c.name === name);
}

/** Trimmed text of a child element, or undefined when the element is missing or empty. */
export function text(el: XmlElement, name: string): string | undefined {
  const t = child(el, name)?.text.trim();
  return t ? t : undefined;
}
