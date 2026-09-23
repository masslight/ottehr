import { PDFArray, PDFDocument, PDFName, PDFRef, PDFString } from 'pdf-lib';
import { describe, expect, it } from 'vitest';
import { analyzeFormTemplatePdf } from '../../src/ehr/shared/form-template-pdf';

/**
 * A form the way pdfTeX/hyperref writes one: complete widget annotations on the page, and no `/AcroForm`
 * in the catalog at all. Viewers render it as fillable; libraries see no fields.
 */
const buildOrphanWidgetForm = async (): Promise<Uint8Array> => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([600, 800]);
  const { context } = doc;

  const widget = (name: string, fieldType: 'Tx' | 'Btn', y: number, extra: Record<string, unknown> = {}): PDFRef =>
    context.register(
      context.obj({
        Type: 'Annot',
        Subtype: 'Widget',
        FT: fieldType,
        T: PDFString.of(name),
        Rect: [10, y, 210, y + 20],
        F: 4,
        ...extra,
      })
    );

  const annots = context.obj([
    widget('email', 'Tx', 700),
    widget('cellnumber', 'Tx', 660),
    widget('agree', 'Btn', 620, {
      AS: 'Off',
      AP: context.obj({ N: context.obj({ Yes: context.obj({}), Off: context.obj({}) }) }),
    }),
  ]);
  page.node.set(PDFName.of('Annots'), annots);

  return doc.save();
};

describe('analyzeFormTemplatePdf', () => {
  it('adopts widgets the document never registered as fields, so the form is fillable', async () => {
    const result = await analyzeFormTemplatePdf(await buildOrphanWidgetForm());

    expect(result.status).toBe('fillable');
    expect(result.fields.map((field) => `${field.type}:${field.name}`)).toEqual([
      'text:email',
      'text:cellnumber',
      'checkbox:agree',
    ]);
    // The stored file has to be replaced: the repaired structure is what filling later reads.
    expect(result.normalized?.changed).toBe(true);

    // And the repaired file is a real form: reopening it finds the fields where every library looks.
    const repaired = await PDFDocument.load(result.normalized!.bytes);
    expect(
      repaired
        .getForm()
        .getFields()
        .map((field) => field.getName())
    ).toEqual(['email', 'cellnumber', 'agree']);
    const fields = repaired.catalog.AcroForm()?.lookupMaybe(PDFName.of('Fields'), PDFArray);
    expect(fields?.size()).toBe(3);
  });

  it('gives colliding orphan names a suffix, so each box is its own field', async () => {
    // hyperref never had a field tree to keep names unique in; the file that prompted this used one name
    // for both the name and the registration-number box. Shared names select and fill together.
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const widget = (y: number): PDFRef =>
      doc.context.register(
        doc.context.obj({
          Type: 'Annot',
          Subtype: 'Widget',
          FT: 'Tx',
          T: PDFString.of('namesurnameentityname'),
          Rect: [10, y, 210, y + 20],
          F: 4,
        })
      );
    page.node.set(PDFName.of('Annots'), doc.context.obj([widget(700), widget(660), widget(620)]));

    const result = await analyzeFormTemplatePdf(await doc.save());

    expect(result.fields.map((field) => field.name)).toEqual([
      'namesurnameentityname',
      'namesurnameentityname_2',
      'namesurnameentityname_3',
    ]);
    // Top to bottom: the first box keeps the original name.
    expect(result.fields.map((field) => field.position?.y)).toEqual([700, 660, 620]);
  });

  it('is idempotent: a repaired form is not rewritten again', async () => {
    const first = await analyzeFormTemplatePdf(await buildOrphanWidgetForm());
    const second = await analyzeFormTemplatePdf(first.normalized!.bytes);

    expect(second.status).toBe('fillable');
    expect(second.fields).toHaveLength(3);
    expect(second.normalized).toBeUndefined();
  });

  it('leaves a properly registered form alone, including widgets that belong to a parent field', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([600, 800]);
    const form = doc.getForm();
    form.createTextField('name').addToPage(page, { x: 10, y: 700, width: 200, height: 20 });
    // A radio group's widgets carry `/Parent` and no `/FT` of their own — they are kids, not orphans.
    const sex = form.createRadioGroup('sex');
    sex.addOptionToPage('Male', page, { x: 10, y: 660, width: 20, height: 20 });
    sex.addOptionToPage('Female', page, { x: 40, y: 660, width: 20, height: 20 });

    const result = await analyzeFormTemplatePdf(await doc.save());

    expect(result.status).toBe('fillable');
    expect(result.fields.map((field) => field.name)).toEqual(['name', 'sex']);
    expect(result.normalized).toBeUndefined();
  });

  it('still classifies a document with no widgets at all as printable', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);

    const result = await analyzeFormTemplatePdf(await doc.save());

    expect(result.status).toBe('printable');
    expect(result.normalized).toBeUndefined();
  });
});
