import { init } from '../dist/es2020/index.js';
import { renderDocument } from '../dist/es2020/base.js';

declare global {
  interface Window {
    documentViewerHarness: { renderDocument: typeof renderDocument; workerSrc: string };
  }
}

const workerSrc = 'http://localhost:8080/pdf.worker.min.mjs';

init(workerSrc);

// The teardown contract has no other observable surface for tests to drive.
window.documentViewerHarness = { renderDocument, workerSrc };
