import fs from 'fs';
import { PDFParse } from 'pdf-parse';

export async function extractPdfText(filePath: string): Promise<string> {
  const dataBuffer = fs.readFileSync(filePath);
  const pdfParser = new PDFParse({ data: new Uint8Array(dataBuffer) });
  const result = await pdfParser.getText();
  return result.text;
}
