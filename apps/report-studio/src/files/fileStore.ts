// Reports as plain JSON files in a folder (File System Access API in Chrome/Edge: open folder, save in
// place, handle remembered in IndexedDB, files polled for outside edits so Claude Code can work on the
// same folder). Other browsers fall back to open-file / download.
import { STUDIO_REPORT_FORMAT, StudioReport } from '../report/types';

const DB_NAME = 'report-studio';
const STORE = 'handles';
const FOLDER_KEY = 'folder';
export const REPORT_FILE_SUFFIX = '.report.json';

type DirectoryHandle = FileSystemDirectoryHandle & {
  values(): AsyncIterableIterator<FileSystemHandle>;
  queryPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
  requestPermission?: (opts: { mode: 'read' | 'readwrite' }) => Promise<PermissionState>;
};

declare global {
  interface Window {
    showDirectoryPicker?: (opts?: { id?: string; mode?: 'read' | 'readwrite' }) => Promise<FileSystemDirectoryHandle>;
    showOpenFilePicker?: (opts?: unknown) => Promise<FileSystemFileHandle[]>;
  }
}

export const supportsFolders = (): boolean =>
  typeof window !== 'undefined' && typeof window.showDirectoryPicker === 'function';

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function idbGet<T>(key: string): Promise<T | undefined> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
    request.onsuccess = () => resolve(request.result as T | undefined);
    request.onerror = () => reject(request.error);
  });
}

async function idbSet(key: string, value: unknown): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export interface ReportFileInfo {
  name: string;
  reportName: string;
  lastModified: number;
}

export class FileStore {
  private folder: DirectoryHandle | null = null;
  private fileHandle: FileSystemFileHandle | null = null;
  private knownModified = new Map<string, number>();

  get folderName(): string | undefined {
    return this.folder?.name;
  }

  /** Re-open the folder the user picked last time (permission may need a click to re-grant). */
  async restoreFolder(): Promise<boolean> {
    if (!supportsFolders()) return false;
    const handle = await idbGet<DirectoryHandle>(FOLDER_KEY);
    if (!handle) return false;
    const permission = (await handle.queryPermission?.({ mode: 'readwrite' })) ?? 'granted';
    if (permission !== 'granted') {
      // requestPermission needs a user gesture; the Open dialog offers it.
      this.folder = handle;
      return false;
    }
    this.folder = handle;
    return true;
  }

  async regrant(): Promise<boolean> {
    if (!this.folder?.requestPermission) return false;
    return (await this.folder.requestPermission({ mode: 'readwrite' })) === 'granted';
  }

  async pickFolder(): Promise<void> {
    if (!window.showDirectoryPicker) throw new Error('This browser cannot open folders; use Open file instead.');
    this.folder = (await window.showDirectoryPicker({ id: 'report-studio', mode: 'readwrite' })) as DirectoryHandle;
    this.fileHandle = null;
    await idbSet(FOLDER_KEY, this.folder);
  }

  async listReports(): Promise<ReportFileInfo[]> {
    if (!this.folder) return [];
    const out: ReportFileInfo[] = [];
    for await (const entry of this.folder.values()) {
      if (entry.kind !== 'file' || !entry.name.endsWith('.json')) continue;
      const file = await (entry as FileSystemFileHandle).getFile();
      try {
        const parsed = JSON.parse(await file.text()) as Partial<StudioReport>;
        if (parsed.format !== STUDIO_REPORT_FORMAT) continue;
        out.push({ name: entry.name, reportName: parsed.name ?? entry.name, lastModified: file.lastModified });
      } catch {
        // Not a studio report (or not JSON) — skip it, the folder may hold anything.
      }
    }
    return out.sort((a, b) => a.name.localeCompare(b.name));
  }

  async readReport(fileName: string): Promise<StudioReport> {
    if (!this.folder) throw new Error('No folder is open');
    const handle = await this.folder.getFileHandle(fileName);
    const file = await handle.getFile();
    this.knownModified.set(fileName, file.lastModified);
    return parseReport(await file.text(), fileName);
  }

  async writeReport(fileName: string, report: StudioReport): Promise<void> {
    if (!this.folder) throw new Error('No folder is open');
    const handle = await this.folder.getFileHandle(fileName, { create: true });
    const writable = await handle.createWritable();
    await writable.write(JSON.stringify(report, null, 2) + '\n');
    await writable.close();
    this.knownModified.set(fileName, (await handle.getFile()).lastModified);
  }

  /** True when the file changed on disk since we last read or wrote it. */
  async changedOnDisk(fileName: string): Promise<boolean> {
    if (!this.folder) return false;
    try {
      const file = await (await this.folder.getFileHandle(fileName)).getFile();
      const known = this.knownModified.get(fileName);
      return known !== undefined && file.lastModified > known;
    } catch {
      return false;
    }
  }

  // ---- fallbacks (any browser) ----

  async pickFile(): Promise<{ fileName: string; report: StudioReport }> {
    if (window.showOpenFilePicker) {
      const [handle] = await window.showOpenFilePicker({
        types: [{ description: 'Report Studio report', accept: { 'application/json': ['.json'] } }],
      });
      this.fileHandle = handle;
      const file = await handle.getFile();
      return { fileName: file.name, report: parseReport(await file.text(), file.name) };
    }
    return new Promise((resolve, reject) => {
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = '.json,application/json';
      input.onchange = async () => {
        const file = input.files?.[0];
        if (!file) return reject(new Error('No file chosen'));
        try {
          resolve({ fileName: file.name, report: parseReport(await file.text(), file.name) });
        } catch (error) {
          reject(error);
        }
      };
      input.click();
    });
  }

  async saveToPickedFile(report: StudioReport): Promise<boolean> {
    if (!this.fileHandle) return false;
    const writable = await this.fileHandle.createWritable();
    await writable.write(JSON.stringify(report, null, 2) + '\n');
    await writable.close();
    return true;
  }

  download(fileName: string, report: StudioReport): void {
    const url = URL.createObjectURL(new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export function parseReport(text: string, fileName: string): StudioReport {
  const parsed = JSON.parse(text) as Partial<StudioReport>;
  if (parsed.format !== STUDIO_REPORT_FORMAT)
    throw new Error(`${fileName} is not a Report Studio report (format ${parsed.format})`);
  if (!parsed.plan || typeof parsed.code !== 'string') throw new Error(`${fileName} is missing its plan or code`);
  return parsed as StudioReport;
}

export const fileNameFor = (reportName: string): string =>
  `${
    reportName
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'report'
  }${REPORT_FILE_SUFFIX}`;

export const fileStore = new FileStore();
