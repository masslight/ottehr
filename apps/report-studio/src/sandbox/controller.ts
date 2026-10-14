// SPA side of the report sandbox — the EHR's invariants (sandbox="allow-scripts", srcDoc, CSP with no
// network, JSON-only messages), as a singleton the runner can drive outside React: render() resolves
// with the frame's "rendered" (text + profile) or "error" message. The Report panel attaches the
// <iframe>; the runtime bundle is inlined into the single-file build as a string.
import type { FhirResource } from 'fhir/r4b';
import { AdHocFrameEventSchema } from 'utils/lib/types/adhoc/sandbox/events';
import runtimeBundle from 'virtual:report-studio-runtime';
import type { FrameMessage } from '../../runtime/index';
import type { RenderResult } from '../state/store';

const CSP = [
  "default-src 'none'",
  "script-src 'unsafe-inline' 'unsafe-eval'",
  "style-src 'unsafe-inline' https://fonts.googleapis.com",
  'font-src data: https://fonts.gstatic.com',
  'img-src data: blob:',
  "connect-src 'none'",
  "form-action 'none'",
].join('; ');

const BASE_CSS = `html, body { margin: 0; padding: 12px 8px 8px; background: #fff; }`;

export const SANDBOX_TIMEOUT_MS = 20000;

export interface RenderRequest {
  code: string;
  resources: Record<string, FhirResource[]>;
  params: { dateRange?: { start: string; end: string }; timeZone: string; patientId?: string };
  profile?: boolean;
  muiLicenseKey?: string;
}

type Listener = (message: FrameMessage | { event: string; [key: string]: unknown }) => void;

class SandboxController {
  readonly srcDoc: string;
  private frame: HTMLIFrameElement | null = null;
  private ready = false;
  private pending: {
    resolve: (result: RenderResult) => void;
    startedAt: number;
    timer: ReturnType<typeof setTimeout>;
  } | null = null;
  private queued: { request: RenderRequest; resolve: (result: RenderResult) => void } | null = null;
  private listeners = new Set<Listener>();

  constructor() {
    this.srcDoc = [
      '<!DOCTYPE html><html><head><meta charset="utf-8">',
      `<meta http-equiv="Content-Security-Policy" content="${CSP}">`,
      '<link href="https://fonts.googleapis.com/css2?family=Rubik:wght@400;500;600&display=swap" rel="stylesheet">',
      `<style>${BASE_CSS}</style>`,
      '</head><body><div id="root"></div>',
      `<script>${runtimeBundle.replace(/<\/script/gi, '<\\/script')}</script>`,
      '</body></html>',
    ].join('');
    window.addEventListener('message', this.onMessage);
  }

  attach(frame: HTMLIFrameElement | null): void {
    if (frame === this.frame) return;
    this.frame = frame;
    this.ready = false;
  }

  subscribe(listener: Listener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Render; a render requested while one is in flight replaces any still-queued one. */
  render(request: RenderRequest): Promise<RenderResult> {
    return new Promise((resolve) => {
      if (this.pending) {
        if (this.queued) this.queued.resolve({ ok: false, error: 'superseded by a newer render', ms: 0 });
        this.queued = { request, resolve };
        return;
      }
      this.start(request, resolve);
    });
  }

  private start(request: RenderRequest, resolve: (result: RenderResult) => void): void {
    const win = this.frame?.contentWindow;
    if (!win) {
      resolve({ ok: false, error: 'The report frame is not mounted (open the Report tab).', ms: 0 });
      return;
    }
    const startedAt = Date.now();
    const timer = setTimeout(() => {
      this.finish({
        ok: false,
        error: `Report timed out after ${SANDBOX_TIMEOUT_MS / 1000}s — the code may be too slow or stuck.`,
        ms: Date.now() - startedAt,
      });
    }, SANDBOX_TIMEOUT_MS);
    this.pending = { resolve, startedAt, timer };
    const send = (): void => win.postMessage({ type: 'render', ...request }, '*');
    if (this.ready) send();
    else this.whenReady = send;
  }

  private whenReady: (() => void) | null = null;

  private finish(result: RenderResult): void {
    const pending = this.pending;
    if (!pending) return;
    clearTimeout(pending.timer);
    this.pending = null;
    pending.resolve(result);
    const next = this.queued;
    this.queued = null;
    if (next) this.start(next.request, next.resolve);
  }

  private onMessage = (ev: MessageEvent): void => {
    if (!this.frame || ev.source !== this.frame.contentWindow) return;
    const msg = ev.data as FrameMessage | { event?: string } | undefined;
    if (!msg || typeof msg !== 'object') return;
    if ('event' in msg && typeof msg.event === 'string') {
      const parsed = AdHocFrameEventSchema.safeParse(msg);
      if (parsed.success) for (const listener of this.listeners) listener(parsed.data as unknown as { event: string });
      return;
    }
    const frameMessage = msg as FrameMessage;
    for (const listener of this.listeners) listener(frameMessage);
    switch (frameMessage.type) {
      case 'ready':
        this.ready = true;
        if (this.whenReady) {
          const send = this.whenReady;
          this.whenReady = null;
          send();
        }
        break;
      case 'rendered':
        this.finish({
          ok: true,
          text: frameMessage.text,
          profile: frameMessage.profile,
          ms: Date.now() - (this.pending?.startedAt ?? Date.now()),
        });
        break;
      case 'error':
        if (frameMessage.fatal === false) return;
        this.finish({
          ok: false,
          error: frameMessage.message,
          ms: Date.now() - (this.pending?.startedAt ?? Date.now()),
        });
        break;
      default:
        break;
    }
  };
}

export const sandbox = new SandboxController();
