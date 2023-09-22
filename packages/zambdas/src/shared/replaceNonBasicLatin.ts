export function replaceNonBasicLatin(char: string): string {
  const accentedCharacters = {
    a: 'àáâãāăą',
    A: 'ÀÁÂÃĀĂĄ',
    aa: 'å',
    Aa: 'Å',
    ae: 'æä',
    Ae: 'ÆÄ',
    c: 'çćčĉċ',
    C: 'ÇĆČĈĊ',
    d: 'đď',
    D: 'ĐĎ',
    e: 'èéêëěĕēęė',
    E: 'ÈÉÊËĚĔĒĘĖ',
    g: 'ĝğġģ',
    G: 'ĜĞĠĢ',
    h: 'ĥħ',
    H: 'ĤĦ',
    i: 'ìíîïīĩĭıį',
    I: 'ÌÍÎÏĪĨĬIĮ',
    ij: 'ĳ',
    Ij: 'Ĳ',
    j: 'ĵ',
    J: 'Ĵ',
    k: 'ķĸ',
    K: 'Ķ',
    l: 'ĺļľŀł',
    L: 'ĹĻĽĿŁ',
    n: 'ñňńņŋ',
    N: 'ÑŇŃŅŊ',
    o: 'òóôõōŏő',
    O: 'ÒÓÔÕŌŎŐ',
    oe: 'öøœ',
    Oe: 'ÖØŒ',
    r: 'řŕŗ',
    R: 'ŘŔŖ',
    s: 'šśŝşšſ',
    S: 'ŠŚŜŞŠ',
    ss: 'ß',
    t: 'ťţŧ',
    T: 'ŤŢŦ',
    th: 'þ',
    Th: 'Þ',
    u: 'ùúûůūũŭűų',
    U: 'ÙÚÛŮŪŨŬŰŲ',
    ue: 'ü',
    Ue: 'Ü',
    w: 'ŵ',
    W: 'Ŵ',
    y: 'ÿýŷ',
    Y: 'ŸÝŶ',
    z: 'žżź',
    Z: 'ŽŻŹ',
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
