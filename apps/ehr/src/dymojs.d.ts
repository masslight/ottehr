declare module 'dymojs' {
  interface DymoOptions {
    hostname?: string;
    port?: number;
    printerName?: string;
  }

  class Dymo {
    constructor(options?: DymoOptions);
    readonly apiUrl: string;
    print(printerName: string, labelXml: string, labelSetXml?: string): Promise<string>;
    renderLabel(labelXml: string): Promise<string>;
    getStatus(): Promise<string>;
    getPrinters(): Promise<string>;
  }

  export = Dymo;
}
