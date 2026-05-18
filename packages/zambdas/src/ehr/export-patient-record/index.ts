import { captureException } from '@sentry/aws-serverless';
import archiver from 'archiver';
import { APIGatewayProxyResult } from 'aws-lambda';
import {
  AllergyIntolerance,
  Appointment,
  Condition,
  Coverage,
  DiagnosticReport,
  DocumentReference,
  Encounter,
  MedicationAdministration,
  MedicationRequest,
  MedicationStatement,
  Observation,
  Patient,
  Practitioner,
  Procedure,
  RelatedPerson,
  ServiceRequest,
} from 'fhir/r4b';
import { BUCKET_NAMES } from 'utils';
import { checkOrCreateM2MClientToken, createOystehrClient, wrapHandler, ZambdaInput } from '../../shared';
import { makeZ3Url } from '../../shared/presigned-file-urls';
import { createPresignedUrl, uploadObjectToZ3 } from '../../shared/z3Utils';
import { validateRequestParameters } from './validateRequestParameters';

let m2mToken: string;

export const index = wrapHandler(
  'export-patient-record',
  async (input: ZambdaInput): Promise<APIGatewayProxyResult> => {
    const { patientId, secrets } = validateRequestParameters(input);

    m2mToken = await checkOrCreateM2MClientToken(m2mToken, secrets);
    const oystehr = createOystehrClient(m2mToken, secrets);

    console.log(`Exporting full record for patient ${patientId}`);

    // 1. Fetch patient
    const patient = await oystehr.fhir.get<Patient>({ resourceType: 'Patient', id: patientId });

    // 2. Fetch all encounters for this patient
    const encounters = (
      await oystehr.fhir.search<Encounter>({
        resourceType: 'Encounter',
        params: [
          { name: 'patient', value: `Patient/${patientId}` },
          { name: '_sort', value: '-date' },
          { name: '_count', value: '100' },
          { name: '_include', value: 'Encounter:appointment' },
          { name: '_include', value: 'Encounter:participant:Practitioner' },
          { name: '_include', value: 'Encounter:location' },
        ],
      })
    ).unbundle();

    const encounterResources = encounters.filter((r) => r.resourceType === 'Encounter') as Encounter[];
    const appointments = encounters.filter((r) => r.resourceType === 'Appointment') as Appointment[];
    const practitioners = encounters.filter((r) => r.resourceType === 'Practitioner') as Practitioner[];

    // 3. Fetch related persons (emergency contacts, guarantors)
    const relatedPersons = (
      await oystehr.fhir.search<RelatedPerson>({
        resourceType: 'RelatedPerson',
        params: [{ name: 'patient', value: `Patient/${patientId}` }],
      })
    ).unbundle();

    // 4. Fetch coverage/insurance
    const coverages = (
      await oystehr.fhir.search<Coverage>({
        resourceType: 'Coverage',
        params: [{ name: 'beneficiary', value: `Patient/${patientId}` }],
      })
    ).unbundle();

    // 5. Fetch all clinical data per encounter
    const encounterData: Record<
      string,
      {
        encounter: Encounter;
        appointment?: Appointment;
        observations: Observation[];
        conditions: Condition[];
        medications: MedicationStatement[];
        allergies: AllergyIntolerance[];
        procedures: Procedure[];
        serviceRequests: ServiceRequest[];
        diagnosticReports: DiagnosticReport[];
        medicationRequests: MedicationRequest[];
        medicationAdmins: MedicationAdministration[];
        documents: DocumentReference[];
      }
    > = {};

    for (const enc of encounterResources) {
      if (!enc.id) continue;
      const encRef = `Encounter/${enc.id}`;
      const apptRef = enc.appointment?.[0]?.reference;
      const appt = apptRef ? appointments.find((a) => `Appointment/${a.id}` === apptRef) : undefined;

      const [obs, conds, meds, allergies, procs, srs, drs, rxs, mas, docs] = await Promise.all([
        oystehr.fhir
          .search<Observation>({
            resourceType: 'Observation',
            params: [
              { name: 'encounter', value: encRef },
              { name: '_count', value: '200' },
            ],
          })
          .then((r) => r.unbundle()),
        oystehr.fhir
          .search<Condition>({ resourceType: 'Condition', params: [{ name: 'encounter', value: encRef }] })
          .then((r) => r.unbundle()),
        oystehr.fhir
          .search<MedicationStatement>({
            resourceType: 'MedicationStatement',
            params: [{ name: 'context', value: encRef }],
          })
          .then((r) => r.unbundle())
          .catch(() => [] as MedicationStatement[]),
        oystehr.fhir
          .search<AllergyIntolerance>({
            resourceType: 'AllergyIntolerance',
            params: [{ name: 'patient', value: `Patient/${patientId}` }],
          })
          .then((r) => r.unbundle()),
        oystehr.fhir
          .search<Procedure>({ resourceType: 'Procedure', params: [{ name: 'encounter', value: encRef }] })
          .then((r) => r.unbundle()),
        oystehr.fhir
          .search<ServiceRequest>({ resourceType: 'ServiceRequest', params: [{ name: 'encounter', value: encRef }] })
          .then((r) => r.unbundle()),
        oystehr.fhir
          .search<DiagnosticReport>({
            resourceType: 'DiagnosticReport',
            params: [{ name: 'encounter', value: encRef }],
          })
          .then((r) => r.unbundle()),
        oystehr.fhir
          .search<MedicationRequest>({
            resourceType: 'MedicationRequest',
            params: [{ name: 'encounter', value: encRef }],
          })
          .then((r) => r.unbundle()),
        oystehr.fhir
          .search<MedicationAdministration>({
            resourceType: 'MedicationAdministration',
            params: [{ name: 'context', value: encRef }],
          })
          .then((r) => r.unbundle())
          .catch(() => [] as MedicationAdministration[]),
        oystehr.fhir
          .search<DocumentReference>({
            resourceType: 'DocumentReference',
            params: [
              { name: 'encounter', value: encRef },
              { name: 'status', value: 'current' },
            ],
          })
          .then((r) => r.unbundle()),
      ]);

      encounterData[enc.id] = {
        encounter: enc,
        appointment: appt,
        observations: obs,
        conditions: conds,
        medications: meds,
        allergies,
        procedures: procs,
        serviceRequests: srs,
        diagnosticReports: drs,
        medicationRequests: rxs,
        medicationAdmins: mas,
        documents: docs,
      };
    }

    // 6. Build master summary text file (plain text for now — PDF generation can be added later)
    const lines: string[] = [];

    // Patient header
    const name = patient.name?.[0];
    const patientName = name ? `${name.given?.join(' ') || ''} ${name.family || ''}`.trim() : 'Unknown';
    const phone = patient.telecom?.find((t) => t.system === 'phone')?.value || '';
    const email = patient.telecom?.find((t) => t.system === 'email')?.value || '';
    const addr = patient.address?.[0];
    const address = addr
      ? `${addr.line?.join(', ') || ''}, ${addr.city || ''}, ${addr.state || ''} ${addr.postalCode || ''}`
      : '';
    const language = patient.communication?.[0]?.language?.coding?.[0]?.display || 'English';

    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                    COMPLETE MEDICAL RECORD                    ');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('');
    lines.push(`Patient Name:      ${patientName}`);
    lines.push(`Date of Birth:     ${patient.birthDate || 'Unknown'}`);
    lines.push(`Patient ID:        ${patient.id}`);
    lines.push(`Gender:            ${patient.gender || 'Unknown'}`);
    lines.push(`Phone:             ${phone}`);
    lines.push(`Email:             ${email}`);
    lines.push(`Address:           ${address}`);
    lines.push(`Preferred Language: ${language}`);
    lines.push('');

    // Emergency contacts
    if (relatedPersons.length > 0) {
      lines.push('── Emergency Contacts ──');
      for (const rp of relatedPersons) {
        const rpName = rp.name?.[0];
        const rpPhone = rp.telecom?.find((t) => t.system === 'phone')?.value || '';
        const relationship = rp.relationship?.[0]?.coding?.[0]?.display || rp.relationship?.[0]?.text || '';
        lines.push(`  ${rpName?.given?.join(' ') || ''} ${rpName?.family || ''} (${relationship}) — ${rpPhone}`);
      }
      lines.push('');
    }

    // Insurance
    if (coverages.length > 0) {
      lines.push('── Insurance / Payer Information ──');
      for (const cov of coverages) {
        const memberNo = (cov as any).identifier?.find((i: any) => i.type?.coding?.[0]?.code === 'MB')?.value || '';
        lines.push(`  Plan: ${cov.type?.text || cov.type?.coding?.[0]?.display || 'Unknown'}`);
        lines.push(`  Member ID: ${memberNo || 'N/A'}`);
        lines.push(`  Status: ${cov.status}`);
        lines.push('');
      }
    }

    // Per-encounter data
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push('                         ENCOUNTERS                           ');
    lines.push('═══════════════════════════════════════════════════════════════');

    const sortedEncounters = Object.values(encounterData).sort((a, b) => {
      const dateA = a.encounter.period?.start || '';
      const dateB = b.encounter.period?.start || '';
      return dateB.localeCompare(dateA);
    });

    for (const data of sortedEncounters) {
      const enc = data.encounter;
      const appt = data.appointment;
      const encDate = enc.period?.start?.slice(0, 10) || 'Unknown date';
      const encTime = enc.period?.start?.slice(11, 16) || '';
      const status = enc.status;
      const reasonCode = appt?.reasonCode?.[0]?.text || appt?.reasonCode?.[0]?.coding?.[0]?.display || '';
      const provider = enc.participant?.find((p) => p.type?.some((t) => t.coding?.some((c) => c.code === 'PPRF')));
      const providerRef = provider?.individual?.reference;
      const providerResource = providerRef
        ? practitioners.find((p) => `Practitioner/${p.id}` === providerRef)
        : undefined;
      const providerName = providerResource?.name?.[0]
        ? `${providerResource.name[0].given?.join(' ') || ''} ${providerResource.name[0].family || ''}`.trim()
        : '';

      lines.push('');
      lines.push(`───────────────────────────────────────────────────────────────`);
      lines.push(`  Visit: ${encDate} ${encTime}  |  Status: ${status}  |  ID: ${enc.id}`);
      if (reasonCode) lines.push(`  Reason for Visit: ${reasonCode}`);
      if (providerName) lines.push(`  Treating Provider: ${providerName}`);
      lines.push(`───────────────────────────────────────────────────────────────`);

      // Vitals
      const vitals = data.observations.filter(
        (o: any) => o.meta?.tag?.some((t: any) => t.system?.includes('patient-vitals-field'))
      );
      if (vitals.length > 0) {
        lines.push('');
        lines.push('  VITAL SIGNS');
        for (const v of vitals) {
          const tag = (v as any).meta?.tag?.find((t: any) => t.system?.includes('patient-vitals-field'));
          const value = v.valueQuantity
            ? `${v.valueQuantity.value} ${v.valueQuantity.unit || ''}`
            : v.valueString || (v as any).valueBoolean?.toString() || '';
          lines.push(`    ${tag?.code || v.code?.text || 'Unknown'}: ${value}`);
        }
      }

      // HPI / Chief Complaint
      const hpiConditions = data.conditions.filter(
        (c: any) => c.meta?.tag?.some((t: any) => t.code === 'chief-complaint')
      );
      if (hpiConditions.length > 0) {
        lines.push('');
        lines.push('  HISTORY OF PRESENT ILLNESS');
        for (const c of hpiConditions) {
          if (c.note?.[0]?.text) lines.push(`    ${c.note[0].text}`);
        }
      }

      // Medical Conditions (PMH)
      const pmhConditions = data.conditions.filter(
        (c: any) => c.meta?.tag?.some((t: any) => t.code === 'medical-condition')
      );
      if (pmhConditions.length > 0) {
        lines.push('');
        lines.push('  MEDICAL CONDITIONS');
        for (const c of pmhConditions) {
          lines.push(`    - ${c.code?.coding?.[0]?.display || c.code?.text || 'Unknown'}`);
        }
      }

      // Allergies
      if (data.allergies.length > 0) {
        lines.push('');
        lines.push('  ALLERGIES');
        for (const a of data.allergies) {
          const name = a.code?.coding?.[0]?.display || a.code?.text || 'Unknown';
          lines.push(`    - ${name} (${a.clinicalStatus?.coding?.[0]?.code || 'unknown status'})`);
        }
      }

      // Current Medications
      if (data.medications.length > 0) {
        lines.push('');
        lines.push('  CURRENT MEDICATIONS');
        for (const m of data.medications) {
          const name =
            m.medicationCodeableConcept?.text || m.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown';
          lines.push(`    - ${name}`);
        }
      }

      // Exam findings
      const examObs = data.observations.filter(
        (o: any) => o.meta?.tag?.some((t: any) => t.system?.includes('exam-observation-field'))
      );
      if (examObs.length > 0) {
        lines.push('');
        lines.push('  PHYSICAL EXAM');
        for (const o of examObs) {
          const tag = (o as any).meta?.tag?.find((t: any) => t.system?.includes('exam-observation-field'));
          const value =
            (o as any).valueBoolean === true
              ? 'Yes'
              : (o as any).valueBoolean === false
              ? 'No'
              : (o as any).valueString || '';
          if (tag?.code && value) lines.push(`    ${tag.code}: ${value}`);
        }
      }

      // Assessment / Diagnoses
      const diagnoses = data.conditions.filter((c) => c.code?.coding?.some((co) => co.system?.includes('icd')));
      if (diagnoses.length > 0) {
        lines.push('');
        lines.push('  ASSESSMENT — DIAGNOSES');
        for (const d of diagnoses) {
          const code = d.code?.coding?.find((c) => c.system?.includes('icd'));
          lines.push(`    - ${code?.code || ''} ${code?.display || d.code?.text || 'Unknown'}`);
        }
      }

      // Procedures / CPT codes
      if (data.procedures.length > 0) {
        lines.push('');
        lines.push('  PROCEDURES / CPT CODES');
        for (const p of data.procedures) {
          const code = p.code?.coding?.[0];
          lines.push(`    - ${code?.code || ''} ${code?.display || p.code?.text || 'Unknown'}`);
        }
      }

      // Prescriptions (eRx)
      if (data.medicationRequests.length > 0) {
        lines.push('');
        lines.push('  PRESCRIPTIONS');
        for (const rx of data.medicationRequests) {
          const name =
            rx.medicationCodeableConcept?.text || rx.medicationCodeableConcept?.coding?.[0]?.display || 'Unknown';
          lines.push(`    - ${name} (${rx.status})`);
        }
      }

      // In-house Medication Administration
      if (data.medicationAdmins.length > 0) {
        lines.push('');
        lines.push('  IN-HOUSE MEDICATIONS');
        for (const ma of data.medicationAdmins) {
          const name =
            (ma as any).medicationCodeableConcept?.text ||
            (ma as any).medicationCodeableConcept?.coding?.[0]?.display ||
            'Unknown';
          lines.push(`    - ${name} (${ma.status})`);
        }
      }

      // Lab orders and results
      const labSRs = data.serviceRequests.filter(
        (sr: any) => !sr.meta?.tag?.some((t: any) => t.code === 'disposition-follow-up')
      );
      if (labSRs.length > 0 || data.diagnosticReports.length > 0) {
        lines.push('');
        lines.push('  LABORATORY');
        for (const sr of labSRs) {
          const name = sr.code?.coding?.[0]?.display || sr.code?.text || 'Unknown';
          lines.push(`    Order: ${name} (${sr.status})`);
        }
        for (const dr of data.diagnosticReports) {
          const name = dr.code?.coding?.[0]?.display || dr.code?.text || 'Unknown';
          lines.push(`    Result: ${name} (${dr.status})`);
        }
      }

      // Documents
      if (data.documents.length > 0) {
        lines.push('');
        lines.push('  DOCUMENTS');
        for (const doc of data.documents) {
          const title = doc.content?.[0]?.attachment?.title || doc.type?.coding?.[0]?.display || 'Document';
          const typeCode = doc.type?.coding?.[0]?.code || '';
          lines.push(`    - ${title} [${typeCode}]`);
        }
      }
    }

    lines.push('');
    lines.push('═══════════════════════════════════════════════════════════════');
    lines.push(`  Generated: ${new Date().toISOString()}`);
    lines.push('═══════════════════════════════════════════════════════════════');

    // 7. Collect document attachments
    const allDocs: DocumentReference[] = [];
    for (const data of Object.values(encounterData)) {
      allDocs.push(...data.documents);
    }

    // 8. Download all document PDFs before building the archive
    const docAttachments: { name: string; bytes: Buffer }[] = [];
    let docIndex = 0;
    for (const doc of allDocs) {
      const z3Url = doc.content?.[0]?.attachment?.url;
      if (!z3Url) continue;
      try {
        const presignedUrl = await createPresignedUrl(m2mToken, z3Url, 'download');
        const response = await fetch(presignedUrl);
        if (response.ok) {
          const bytes = Buffer.from(await response.arrayBuffer());
          const title = doc.content?.[0]?.attachment?.title || `document_${docIndex}`;
          const ext = doc.content?.[0]?.attachment?.contentType?.includes('pdf') ? 'pdf' : 'bin';
          const encId = doc.context?.encounter?.[0]?.reference?.replace('Encounter/', '') || 'unknown';
          const safeTitle = title.replace(/[^a-zA-Z0-9._-]/g, '_').slice(0, 60);
          // Avoid double extensions like DischargeSummary.pdf.pdf
          const fileName = safeTitle.toLowerCase().endsWith(`.${ext}`) ? safeTitle : `${safeTitle}.${ext}`;
          docAttachments.push({ name: `documents/${encId}/${fileName}`, bytes });
          docIndex++;
        }
      } catch (err) {
        // Non-fatal: skip an unreachable attachment rather than failing the
        // whole export. Report so a silently-incomplete record is traceable.
        console.error(`Failed to download document ${doc.id}:`, err);
        captureException(err);
      }
    }

    // 9. Build ZIP archive
    const finalZipBuffer = await new Promise<Buffer>((resolve, reject) => {
      const archive = archiver('zip', { zlib: { level: 9 } });
      const chunks: Buffer[] = [];
      archive.on('data', (chunk) => chunks.push(chunk));
      archive.on('end', () => resolve(Buffer.concat(chunks)));
      archive.on('error', reject);

      // Add master summary
      archive.append(lines.join('\n'), { name: `${patientName.replace(/\s+/g, '_')}_Medical_Record.txt` });

      // Add document attachments
      for (const attachment of docAttachments) {
        archive.append(attachment.bytes, { name: attachment.name });
      }

      void archive.finalize();
    });

    // 9. Upload ZIP to Z3
    const z3Url = makeZ3Url({
      secrets,
      bucketName: BUCKET_NAMES.DISCHARGE_SUMMARIES,
      patientID: patientId,
      fileName: 'MedicalRecordExport.zip',
    });
    const presignedUploadUrl = await createPresignedUrl(m2mToken, z3Url, 'upload');
    await uploadObjectToZ3(finalZipBuffer, presignedUploadUrl);

    // 10. Get download URL
    const downloadUrl = await createPresignedUrl(m2mToken, z3Url, 'download');

    console.log(`Export complete: ${finalZipBuffer.length} bytes, ${allDocs.length} documents`);

    return {
      statusCode: 200,
      body: JSON.stringify({
        downloadUrl,
        documentCount: allDocs.length,
        encounterCount: encounterResources.length,
      }),
    };
  }
);
