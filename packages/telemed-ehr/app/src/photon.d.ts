declare namespace JSX {
  interface IntrinsicElements {
    'photon-client': {
      id: string;
      org: string;
      'dev-mode': string;
      'auto-login': string;
      'redirect-uri': string;
      children: Element;
    };
    'photon-prescribe-workflow': { 'enable-order': string; 'patient-id'?: string };
  }
}
