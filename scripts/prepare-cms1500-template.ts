import * as fs from 'fs';
import * as path from 'path';
import { PDFArray, PDFDict, PDFDocument, PDFName, PDFObject, PDFRef, PDFStream } from 'pdf-lib';

// Builds the fillable CMS-1500 (02/12) the billing app fills in from Cigna's copy of the form,
// https://www.cigna.com/static/www-cigna-com/docs/form-cms1500.pdf (a 1500CMS.COM template). The
// form and its fields stay as they are; this only removes what isn't part of the claim form: the
// instructions page, the Clear Form button, the On/Off Total check box next to item 28, six stray
// 2-point fields between the dollars and cents of 24F, the invisible link to 1500cms.com and the
// leftover bookmarks.
//
//   npx tsx scripts/prepare-cms1500-template.ts path/to/form-cms1500.pdf

const TARGET = path.resolve(__dirname, '../packages/utils/lib/helpers/rcm/cms1500/cms1500-template.pdf');
const REMOVED_FIELDS = ['Clear Form', '276', '135', '157', '179', '201', '223', '245'];

async function main(): Promise<void> {
  const [source] = process.argv.slice(2);
  if (!source) throw new Error('Usage: npx tsx scripts/prepare-cms1500-template.ts <form-cms1500.pdf>');

  const doc = await PDFDocument.load(fs.readFileSync(source), { updateMetadata: false });
  relinkFields(doc);

  const form = doc.getForm();
  REMOVED_FIELDS.forEach((name) => form.removeField(form.getField(name)));
  doc.removePage(1);
  const page = doc.getPage(0);
  (page.node.Annots()?.asArray() ?? [])
    .filter((ref) => doc.context.lookup(ref, PDFDict).get(PDFName.of('Subtype')) === PDFName.of('Link'))
    .forEach((ref) => page.node.removeAnnot(ref as PDFRef));
  doc.catalog.delete(PDFName.of('Outlines'));
  removeUnreachableObjects(doc);

  fs.writeFileSync(TARGET, await doc.save({ updateFieldAppearances: false }));
  console.log(`Wrote ${TARGET}`);
}

// Saving the form in macOS Preview leaves the widgets on the page detached from the form's field
// list: the list holds copies of every field, so values set through it never show on the page. This
// rebuilds the list from the widgets on the first page.
function relinkFields(doc: PDFDocument): void {
  const fields: PDFRef[] = [];
  const kids = new Map<PDFRef, PDFRef[]>();
  for (const ref of doc.getPage(0).node.Annots()?.asArray() ?? []) {
    const widget = doc.context.lookup(ref, PDFDict);
    if (!(ref instanceof PDFRef) || widget.get(PDFName.of('Subtype')) !== PDFName.of('Widget')) continue;
    const parent = widget.get(PDFName.of('Parent'));
    if (!(parent instanceof PDFRef)) {
      fields.push(ref);
      continue;
    }
    if (doc.context.lookup(parent, PDFDict).has(PDFName.of('Parent'))) {
      throw new Error(`Field ${parent} is nested more than one level deep`);
    }
    if (!kids.has(parent)) fields.push(parent);
    kids.set(parent, [...(kids.get(parent) ?? []), ref]);
  }
  kids.forEach((widgets, parent) =>
    doc.context.lookup(parent, PDFDict).set(PDFName.of('Kids'), doc.context.obj(widgets))
  );
  doc.catalog.getOrCreateAcroForm().dict.set(PDFName.of('Fields'), doc.context.obj(fields));
}

// pdf-lib writes out every object it loaded, so drop the ones nothing refers to any more: the
// instructions page, the removed fields and Preview's copies of the fields.
function removeUnreachableObjects(doc: PDFDocument): void {
  const reachable = new Set<PDFRef>();
  const visit = (object: PDFObject | undefined): void => {
    if (object instanceof PDFRef) {
      if (reachable.has(object)) return;
      reachable.add(object);
      visit(doc.context.lookup(object));
    } else if (object instanceof PDFDict) {
      object.values().forEach(visit);
    } else if (object instanceof PDFArray) {
      object.asArray().forEach(visit);
    } else if (object instanceof PDFStream) {
      visit(object.dict);
    }
  };
  visit(doc.context.trailerInfo.Root);
  visit(doc.context.trailerInfo.Info);
  doc.context
    .enumerateIndirectObjects()
    .filter(([ref]) => !reachable.has(ref))
    .forEach(([ref]) => doc.context.delete(ref));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
