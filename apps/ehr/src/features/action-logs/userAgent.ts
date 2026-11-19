const BROWSERS: [name: string, pattern: RegExp][] = [
  ['Edge', /Edg(?:e|A|iOS)?\/(\d+)/],
  ['Opera', /(?:OPR|Opera)\/(\d+)/],
  ['Samsung Internet', /SamsungBrowser\/(\d+)/],
  ['Firefox', /(?:Firefox|FxiOS)\/(\d+)/],
  ['Chrome', /(?:Chrome|CriOS)\/(\d+)/],
  ['Safari', /Version\/(\d+).*Safari\//],
];

const SYSTEMS: [name: string, pattern: RegExp][] = [
  ['iOS', /iPhone|iPad|iPod/],
  ['Android', /Android/],
  ['ChromeOS', /CrOS/],
  ['Windows', /Windows/],
  ['macOS', /Macintosh|Mac OS X/],
  ['Linux', /Linux/],
];

export function describeBrowser(userAgent: string): string | undefined {
  const browser = BROWSERS.flatMap(([name, pattern]) => {
    const match = pattern.exec(userAgent);
    return match ? [`${name} ${match[1]}`] : [];
  })[0];
  if (!browser) return undefined;
  const system = SYSTEMS.find(([, pattern]) => pattern.test(userAgent))?.[0];
  return system ? `${browser} on ${system}` : browser;
}
