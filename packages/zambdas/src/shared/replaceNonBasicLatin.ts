export function replaceNonBasicLatin(char: string): string {
  const accentedCharacters = {
    A: 'ÀÁÂÃĀĂĄ',
    Aa: 'Å',
    Ae: 'ÆÄ',
    C: 'ÇĆČĈĊ',
    D: 'ĐĎ',
    E: 'ÈÉÊËĚĔĒĘĖ',
    G: 'ĜĞĠĢ',
    H: 'ĤĦ',
    I: 'ÌÍÎÏĪĨĬIĮ',
    Ij: 'Ĳ',
    J: 'Ĵ',
    K: 'Ķ',
    L: 'ĹĻĽĿŁ',
    N: 'ÑŇŃŅŊ',
    O: 'ÒÓÔÕŌŎŐ',
    Oe: 'ÖØŒ',
    R: 'ŘŔŖ',
    S: 'ŠŚŜŞŠ',
    T: 'ŤŢŦ',
    Th: 'Þ',
    U: 'ÙÚÛŮŪŨŬŰŲ',
    Ue: 'Ü',
    W: 'Ŵ',
    Y: 'ŸÝŶ',
    Z: 'ŽŻŹ',
    a: 'àáâãāăą',
    aa: 'å',
    ae: 'æä',
    c: 'çćčĉċ',
    d: 'đď',
    e: 'èéêëěĕēęė',
    g: 'ĝğġģ',
    h: 'ĥħ',
    i: 'ìíîïīĩĭıį',
    ij: 'ĳ',
    j: 'ĵ',
    k: 'ķĸ',
    l: 'ĺļľŀł',
    n: 'ñňńņŋ',
    o: 'òóôõōŏő',
    oe: 'öøœ',
    r: 'řŕŗ',
    s: 'šśŝşšſ',
    ss: 'ß',
    t: 'ťţŧ',
    th: 'þ',
    u: 'ùúûůūũŭűų',
    ue: 'ü',
    w: 'ŵ',
    y: 'ÿýŷ',
    z: 'žżź',
  };

  const letters = Object.entries(accentedCharacters);

  for (let i = 0; i < letters.length; i++) {
    const [base, replace] = letters[i];
    if (replace.includes(char)) {
      return base;
    }
  }

  return '';
}
