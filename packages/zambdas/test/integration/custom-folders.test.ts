import Oystehr from '@oystehr/sdk';
import { randomUUID } from 'crypto';
import { List, Patient } from 'fhir/r4b';
import {
  APIErrorCode,
  CreateCustomFolderOutput,
  createCustomPatientDocumentList,
  CUSTOM_FOLDERS_CATALOG_IDENTIFIER,
  deriveInternalFolderName,
  FOLDERS_CONFIG,
  M2MClientMockType,
  makeSyntheticFolderId,
  parseCustomFoldersCatalog,
  parseCustomFoldersCatalogIncludingDeleted,
  RoleType,
  SYNTHETIC_FOLDER_ID_PREFIX,
} from 'utils';
import { addProcessIdMetaTagToResource, setupIntegrationTest } from '../helpers/integration-test-seed-data-setup';

// These tests cover the three folder catalog zambdas plus the lazy-create path of
// create-upload-document-url.
//
// Notes:
// - Catalog is a single global FHIR List. We don't tag it with the test process id
//   (it's a singleton resource shared across tests) and we don't try to delete it
//   in the cleanup step. Each test prefixes folder names with `processId` so we can
//   isolate state between concurrent runs.
// - Per-patient Lists ARE tagged with the process id so cleanupTestScheduleResources
//   removes them. Patients are created with the process-id meta tag too.

const SHORT_PROCESS_SUFFIX = (): string => randomUUID().slice(0, 8);

describe('custom folders zambdas integration tests', () => {
  let oystehrAdmin: Oystehr;
  let oystehrTestUserM2M: Oystehr;
  let processId: string;
  let cleanup: () => Promise<void>;

  // Track folders we create so we can remove them from the catalog at teardown
  // (the catalog itself is a singleton — we leave the List, but strip our entries).
  const createdInternalNames: Set<string> = new Set();

  beforeAll(async () => {
    const setup = await setupIntegrationTest('custom-folders.test.ts', M2MClientMockType.provider);
    oystehrAdmin = setup.oystehr;
    oystehrTestUserM2M = setup.oystehrTestUserM2M;
    processId = setup.processId;
    cleanup = setup.cleanup;

    // The folder zambdas require Administrator role. Grant it to the M2M client.
    const projectRoles = await oystehrAdmin.role.list();
    const adminRoleId = projectRoles.find((r) => r.name === RoleType.Administrator)?.id;
    if (adminRoleId) {
      const testM2M = (await oystehrAdmin.m2m.listV2({ name: 'custom-folders.test.ts' })).data[0];
      if (testM2M) {
        const m2mDetails = await oystehrAdmin.m2m.get({ id: testM2M.id });
        const existingRoleIds = (m2mDetails.roles ?? []).map((r: { id: string }) => r.id);
        if (!existingRoleIds.includes(adminRoleId)) {
          await oystehrAdmin.m2m.update({
            id: testM2M.id,
            roles: [...existingRoleIds, adminRoleId],
          });
        }
      }
    }
  }, 60_000);

  // Hard-remove our tracked catalog entries. Soft-deleted entries still occupy a slot
  // (entry.flag tombstone), so we strip them regardless of state. Runs after every test
  // so the catalog doesn't grow unbounded during the suite — once it gets large enough
  // the trailing fhir.update silently fails and the entries leak to the env.
  const pruneTrackedCatalogEntries = async (): Promise<void> => {
    if (!createdInternalNames.size) return;
    try {
      const results = await oystehrAdmin.fhir.search<List>({
        resourceType: 'List',
        params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
      });
      const catalog = results.unbundle()[0];
      if (catalog) {
        const remainingEntries = (catalog.entry ?? []).filter(
          (entry) => !createdInternalNames.has(entry.item?.identifier?.value ?? '')
        );
        await oystehrAdmin.fhir.update<List>({ ...catalog, entry: remainingEntries });
      }
      createdInternalNames.clear();
    } catch (err) {
      console.warn('failed to clean catalog entries created by test', err);
    }
  };

  afterEach(async () => {
    await pruneTrackedCatalogEntries();
  });

  afterAll(async () => {
    // Safety net for entries that escaped afterEach (e.g. the prune itself errored).
    await pruneTrackedCatalogEntries();
    await cleanup();
  });

  // ────────────────────────────────────────────────────────────────────────
  // Helpers
  // ────────────────────────────────────────────────────────────────────────

  const uniqueFolderName = (label: string): string =>
    `Test ${label} ${processId.slice(0, 4)}-${SHORT_PROCESS_SUFFIX()}`;

  const executeCreate = async (
    folderName: string,
    client: Oystehr = oystehrTestUserM2M
  ): Promise<{ output?: CreateCustomFolderOutput; error?: any; code?: number }> => {
    try {
      const res = await client.zambda.execute({ id: 'create-custom-folder', folderName });
      return { output: res.output as CreateCustomFolderOutput };
    } catch (err: any) {
      return { error: err, code: err?.code };
    }
  };

  const executeRename = async (
    internalName: string,
    newName: string,
    client: Oystehr = oystehrTestUserM2M
  ): Promise<{ output?: any; error?: any; code?: number }> => {
    try {
      const res = await client.zambda.execute({ id: 'rename-custom-folder', internalName, newName });
      return { output: res.output };
    } catch (err: any) {
      return { error: err, code: err?.code };
    }
  };

  const executeDelete = async (
    internalName: string,
    client: Oystehr = oystehrTestUserM2M
  ): Promise<{ output?: any; error?: any; code?: number }> => {
    try {
      const res = await client.zambda.execute({ id: 'delete-custom-folder', internalName });
      return { output: res.output };
    } catch (err: any) {
      return { error: err, code: err?.code };
    }
  };

  const executeUpload = async (
    body: { patientId: string; fileFolderId: string; fileName: string; internalName?: string },
    client: Oystehr = oystehrTestUserM2M
  ): Promise<{ output?: any; error?: any; code?: number }> => {
    try {
      const res = await client.zambda.execute({ id: 'create-upload-document-url', ...body });
      return { output: res.output };
    } catch (err: any) {
      return { error: err, code: err?.code };
    }
  };

  const createFolderAndTrack = async (label: string): Promise<CreateCustomFolderOutput> => {
    const name = uniqueFolderName(label);
    const { output, error } = await executeCreate(name);
    expect(error).toBeUndefined();
    expect(output?.internalName).toBeDefined();
    if (output) {
      createdInternalNames.add(output.internalName);
    }
    return output as CreateCustomFolderOutput;
  };

  const fetchCatalog = async (): Promise<List | undefined> => {
    const res = await oystehrAdmin.fhir.search<List>({
      resourceType: 'List',
      params: [{ name: 'identifier', value: CUSTOM_FOLDERS_CATALOG_IDENTIFIER }],
    });
    return res.unbundle()[0];
  };

  const createTestPatient = async (): Promise<Patient> => {
    const patient = (await oystehrAdmin.fhir.create(
      addProcessIdMetaTagToResource(
        {
          resourceType: 'Patient',
          name: [{ given: ['Custom'], family: 'Folders' }],
          birthDate: '2000-01-01',
          gender: 'male',
        },
        processId
      ) as Patient
    )) as Patient;
    expect(patient.id).toBeDefined();
    return patient;
  };

  const findPerPatientList = async (patientId: string, internalName: string): Promise<List | undefined> => {
    const res = await oystehrAdmin.fhir.search<List>({
      resourceType: 'List',
      params: [
        { name: 'subject', value: `Patient/${patientId}` },
        { name: 'title', value: internalName },
      ],
    });
    return res.unbundle()[0];
  };

  // ────────────────────────────────────────────────────────────────────────
  // create-custom-folder
  // ────────────────────────────────────────────────────────────────────────

  describe('create-custom-folder', () => {
    it('creates a new entry; appends when catalog already exists', async () => {
      // First create — catalog may or may not already exist on this Oystehr project,
      // either way we should end up with our entry present.
      const first = await createFolderAndTrack('First');
      expect(first.displayName).toContain('First');
      expect(first.internalName).toBe(deriveInternalFolderName(first.displayName));

      const catalogAfterFirst = await fetchCatalog();
      expect(catalogAfterFirst).toBeDefined();
      const defsAfterFirst = parseCustomFoldersCatalog(catalogAfterFirst);
      expect(defsAfterFirst.some((d) => d.internalName === first.internalName)).toBe(true);

      // Second create — should append rather than recreate.
      const second = await createFolderAndTrack('Second');
      expect(second.internalName).not.toBe(first.internalName);

      const catalogAfterSecond = await fetchCatalog();
      const defsAfterSecond = parseCustomFoldersCatalog(catalogAfterSecond);
      expect(defsAfterSecond.some((d) => d.internalName === first.internalName)).toBe(true);
      expect(defsAfterSecond.some((d) => d.internalName === second.internalName)).toBe(true);
      // No regression: id is stable across the append.
      expect(catalogAfterFirst!.id).toBe(catalogAfterSecond!.id);
    });

    it('rejects a duplicate display name with INVALID_INPUT', async () => {
      const created = await createFolderAndTrack('DupName');
      const { error, code } = await executeCreate(created.displayName);
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.INVALID_INPUT);
    });

    it('rejects a duplicate display name case-insensitively with INVALID_INPUT', async () => {
      const created = await createFolderAndTrack('CaseSensitive');
      const { error, code } = await executeCreate(created.displayName.toUpperCase());
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.INVALID_INPUT);
    });

    it('rejects a name that collides with a protected folder display', async () => {
      const protectedName = FOLDERS_CONFIG[0].display;
      const { error, code } = await executeCreate(protectedName);
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.INVALID_INPUT);
    });

    it('rejects an empty/whitespace name with 400', async () => {
      const { error, code } = await executeCreate('   ');
      expect(error).toBeDefined();
      expect(code).toBe(400);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // rename-custom-folder
  // ────────────────────────────────────────────────────────────────────────

  describe('rename-custom-folder', () => {
    it('updates the catalog entry display and leaves per-patient Lists untouched', async () => {
      const created = await createFolderAndTrack('Rename');

      // Manually create a per-patient List for this folder so we can verify it's not touched.
      const patient = await createTestPatient();
      const patientListSpec = addProcessIdMetaTagToResource(
        createCustomPatientDocumentList(`Patient/${patient.id}`, created.internalName),
        processId
      ) as List;
      const patientList = await oystehrAdmin.fhir.create<List>(patientListSpec);
      const originalVersionId = patientList.meta?.versionId;

      const newName = `${created.displayName} Renamed`;
      const { output, error } = await executeRename(created.internalName, newName);
      expect(error).toBeUndefined();
      expect(output?.displayName).toBe(newName);

      // Catalog reflects the new display.
      const catalog = await fetchCatalog();
      const defs = parseCustomFoldersCatalog(catalog);
      const updated = defs.find((d) => d.internalName === created.internalName);
      expect(updated?.displayName).toBe(newName);

      // Per-patient List is untouched (same versionId — no write occurred).
      const refetched = (await oystehrAdmin.fhir.get({ resourceType: 'List', id: patientList.id! })) as List;
      expect(refetched.meta?.versionId).toBe(originalVersionId);
    });

    it('returns FHIR_RESOURCE_NOT_FOUND for an unknown internal name', async () => {
      const { error, code } = await executeRename('custom-folder-does-not-exist-xyz', 'Some New Name');
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    });

    it('returns INVALID_INPUT when renaming to a name that collides with another custom folder', async () => {
      const a = await createFolderAndTrack('CollideA');
      const b = await createFolderAndTrack('CollideB');
      const { error, code } = await executeRename(a.internalName, b.displayName);
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.INVALID_INPUT);
    });

    it('returns INVALID_INPUT when renaming to a protected folder display name', async () => {
      const created = await createFolderAndTrack('CollideSystem');
      const { error, code } = await executeRename(created.internalName, FOLDERS_CONFIG[0].display);
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.INVALID_INPUT);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // delete-custom-folder
  // ────────────────────────────────────────────────────────────────────────

  describe('delete-custom-folder', () => {
    it('soft-deletes the catalog entry (entry.flag tombstone) and leaves per-patient Lists intact', async () => {
      const created = await createFolderAndTrack('Delete');

      // Seed a per-patient List for this folder.
      const patient = await createTestPatient();
      const patientListSpec = addProcessIdMetaTagToResource(
        createCustomPatientDocumentList(`Patient/${patient.id}`, created.internalName),
        processId
      ) as List;
      const patientList = await oystehrAdmin.fhir.create<List>(patientListSpec);

      const { error } = await executeDelete(created.internalName);
      expect(error).toBeUndefined();

      // Catalog drops the entry from the active list but keeps it as a tombstone so the
      // latest displayName remains resolvable to the patient docs read path.
      const catalog = await fetchCatalog();
      const activeDefs = parseCustomFoldersCatalog(catalog);
      expect(activeDefs.some((d) => d.internalName === created.internalName)).toBe(false);
      const allDefs = parseCustomFoldersCatalogIncludingDeleted(catalog);
      const tombstone = allDefs.find((d) => d.internalName === created.internalName);
      expect(tombstone).toBeDefined();
      expect(tombstone?.deleted).toBe(true);
      expect(tombstone?.displayName).toBe(created.displayName);

      // Per-patient List is intact.
      const refetched = (await oystehrAdmin.fhir.get({ resourceType: 'List', id: patientList.id! })) as List;
      expect(refetched.id).toBe(patientList.id);
      expect(refetched.title).toBe(created.internalName);
    });

    it('is idempotent when called twice on the same internalName', async () => {
      const created = await createFolderAndTrack('DeleteIdempotent');

      const first = await executeDelete(created.internalName);
      expect(first.error).toBeUndefined();
      const second = await executeDelete(created.internalName);
      expect(second.error).toBeUndefined();
    });

    it('returns FHIR_RESOURCE_NOT_FOUND for an unknown internal name', async () => {
      const { error, code } = await executeDelete('custom-folder-does-not-exist-xyz');
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    });

    it('returns FHIR_RESOURCE_NOT_FOUND when called with a protected folder title (it is not in the catalog)', async () => {
      const protectedTitle = FOLDERS_CONFIG[0].title;
      const { error, code } = await executeDelete(protectedTitle);
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    });

    it('preserves the latest displayName as a tombstone after rename → delete', async () => {
      const created = await createFolderAndTrack('PreName');
      const renamed = `${created.displayName} V2`;
      const { error: renameErr } = await executeRename(created.internalName, renamed);
      expect(renameErr).toBeUndefined();

      const { error: deleteErr } = await executeDelete(created.internalName);
      expect(deleteErr).toBeUndefined();

      const allDefs = parseCustomFoldersCatalogIncludingDeleted(await fetchCatalog());
      const tombstone = allDefs.find((d) => d.internalName === created.internalName);
      expect(tombstone?.deleted).toBe(true);
      // This is the bug the soft-delete design fixes: the tombstone reflects the
      // latest displayName at delete time, not the original create-time name.
      expect(tombstone?.displayName).toBe(renamed);
    });

    it('rejects rename of a soft-deleted folder', async () => {
      const created = await createFolderAndTrack('RenameDeleted');
      const { error: deleteErr } = await executeDelete(created.internalName);
      expect(deleteErr).toBeUndefined();

      const { error, code } = await executeRename(created.internalName, `${created.displayName} Renamed`);
      expect(error).toBeDefined();
      expect(code).toBe(APIErrorCode.FHIR_RESOURCE_NOT_FOUND);
    });

    it('re-create with the same displayName clears the existing tombstone', async () => {
      const created = await createFolderAndTrack('Recreate');
      const { error: deleteErr } = await executeDelete(created.internalName);
      expect(deleteErr).toBeUndefined();

      // Recreating with the same displayName should clear the tombstone rather than
      // fail with a duplicate-name error.
      const { output, error } = await executeCreate(created.displayName);
      expect(error).toBeUndefined();
      expect(output?.internalName).toBe(created.internalName);

      const allDefs = parseCustomFoldersCatalogIncludingDeleted(await fetchCatalog());
      const entry = allDefs.find((d) => d.internalName === created.internalName);
      expect(entry).toBeDefined();
      expect(entry?.deleted).toBe(false);
      expect(entry?.displayName).toBe(created.displayName);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // create-upload-document-url — lazy List creation path
  // ────────────────────────────────────────────────────────────────────────

  describe('create-upload-document-url (lazy custom folder path)', () => {
    it('lazily creates a per-patient List titled with the internalName when none exists', async () => {
      const folder = await createFolderAndTrack('Lazy');
      const patient = await createTestPatient();

      expect(await findPerPatientList(patient.id!, folder.internalName)).toBeUndefined();

      const { output, error } = await executeUpload({
        patientId: patient.id!,
        fileFolderId: makeSyntheticFolderId(folder.internalName),
        fileName: 'first.pdf',
        internalName: folder.internalName,
      });
      expect(error).toBeUndefined();
      expect(output?.folderId).toBeDefined();
      // The returned id is a real FHIR id, not the synthetic sentinel.
      expect(output.folderId.startsWith(SYNTHETIC_FOLDER_ID_PREFIX)).toBe(false);

      const list = await findPerPatientList(patient.id!, folder.internalName);
      expect(list).toBeDefined();
      expect(list?.id).toBe(output.folderId);
      expect(list?.title).toBe(folder.internalName);
      // displayName is intentionally not stored on the per-patient List — it's resolved
      // from the catalog at read time.
      const coding = list!.code?.coding?.find((c) => c.code === 'patient-docs-folder');
      expect(coding?.display).toBeUndefined();
    });

    it('reuses an existing per-patient List on subsequent uploads (no duplicates)', async () => {
      const folder = await createFolderAndTrack('Reuse');
      const patient = await createTestPatient();

      const first = await executeUpload({
        patientId: patient.id!,
        fileFolderId: makeSyntheticFolderId(folder.internalName),
        fileName: 'file1.pdf',
        internalName: folder.internalName,
      });
      expect(first.error).toBeUndefined();

      const second = await executeUpload({
        patientId: patient.id!,
        fileFolderId: makeSyntheticFolderId(folder.internalName),
        fileName: 'file2.pdf',
        internalName: folder.internalName,
      });
      expect(second.error).toBeUndefined();

      // Both uploads point at the same List id.
      expect(second.output.folderId).toBe(first.output.folderId);

      const search = await oystehrAdmin.fhir.search<List>({
        resourceType: 'List',
        params: [
          { name: 'subject', value: `Patient/${patient.id}` },
          { name: 'title', value: folder.internalName },
        ],
      });
      expect(search.unbundle().length).toBe(1);
    });

    it('returns 404/5xx when internalName is not in the catalog', async () => {
      const patient = await createTestPatient();
      const { error } = await executeUpload({
        patientId: patient.id!,
        fileFolderId: makeSyntheticFolderId('custom-folder-missing-from-catalog'),
        fileName: 'file.pdf',
        internalName: 'custom-folder-missing-from-catalog',
      });
      // The zambda returns 500 when it can't find/create the List, surfaced as a thrown error
      // by the SDK execute call.
      expect(error).toBeDefined();
    });

    it(`derives internalName from the ${SYNTHETIC_FOLDER_ID_PREFIX} suffix when the field is omitted`, async () => {
      const folder = await createFolderAndTrack('Suffix');
      const patient = await createTestPatient();

      const { output, error } = await executeUpload({
        patientId: patient.id!,
        fileFolderId: makeSyntheticFolderId(folder.internalName),
        fileName: 'file.pdf',
        // intentionally no internalName field
      });
      expect(error).toBeUndefined();
      const list = await findPerPatientList(patient.id!, folder.internalName);
      expect(list).toBeDefined();
      expect(output.folderId).toBe(list?.id);
    });
  });

  // ────────────────────────────────────────────────────────────────────────
  // Patient registration sanity check
  // ────────────────────────────────────────────────────────────────────────

  describe('createPatientDocumentLists (utils)', () => {
    it('seeds only protected folders, no custom-marked Lists', async () => {
      // Pure unit — exercises the same util `createPatientDocumentLists` that the patient
      // registration path uses. We don't run that path here because it would require
      // the full registration flow. The util is the source of truth.
      const utils = await import('utils');
      const lists = utils.createPatientDocumentLists('Patient/abc');
      expect(lists.length).toBe(FOLDERS_CONFIG.length);
      for (const list of lists) {
        const isCustom = (list.code?.coding ?? []).some((c) => c.code === 'custom');
        expect(isCustom).toBe(false);
      }
    });
  });
});
