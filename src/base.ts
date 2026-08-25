import { GlobalWorkerOptions, PDFDocumentProxy, PDFPageProxy, PageViewport, RenderingCancelledException, TextLayer, getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import type { RenderTask, TextContent } from 'pdfjs-dist/types/src/display/api';

const chevronLeft = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-left" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M11.354 1.646a.5.5 0 0 1 0 .708L5.707 8l5.647 5.646a.5.5 0 0 1-.708.708l-6-6a.5.5 0 0 1 0-.708l6-6a.5.5 0 0 1 .708 0z"/>
</svg>`;

const chevronRight = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" class="bi bi-chevron-right" viewBox="0 0 16 16">
<path fill-rule="evenodd" d="M4.646 1.646a.5.5 0 0 1 .708 0l6 6a.5.5 0 0 1 0 .708l-6 6a.5.5 0 0 1-.708-.708L10.293 8 4.646 2.354a.5.5 0 0 1 0-.708z"/>
</svg>`;

const handleError = (containerDiv: Element) => (err: unknown) => {
  renderErrorMessage(containerDiv)(`There was an error fetching your document. Please try again later. Error: ${err}`);
};

const noop = () => undefined;

// pdf.js 6 fetches its JBIG2/OpenJPEG/QCMS decoders — and the plain-JS fallbacks
// that live beside them — from `wasmUrl`, which defaults to a page-relative
// "wasm" and so 404s on every nested route. Derive it from the worker instead,
// which the consumer already serves from a known location.
const wasmUrlFor = (workerSrc: string): string => String(workerSrc || '').replace(/[^/]*$/, 'wasm/');

const isCancelled = (err: unknown): boolean =>
  err instanceof RenderingCancelledException ||
  (typeof err === 'object' && err !== null && (err as { name?: string }).name === 'RenderingCancelledException');

const zoomValues = [50, 80, 100, 125, 150, 200, 300, 400];
const defaultWidth = 80;

const PDFtoCSSConvert = 96 / 72;
const defaultPageWidth = 700;

type CurrentPage = {
  textContent: TextContent;
  pdfPage: PDFPageProxy;
  viewport: PageViewport;
  originalPageWidth: number;
};

const scaleTextLayer = async (
  textLayerDiv: HTMLDivElement,
  textContent: TextContent,
  pdfPage: PDFPageProxy,
  canvas: HTMLCanvasElement,
  viewport: PageViewport,
  pdfScale: number,
  isStillCurrent: () => boolean,
) => {
  const textLayerFragment = document.createElement('div');
  textLayerFragment.className = 'textLayer';
  const scale = pdfScale * (canvas.offsetWidth / viewport.width);
  const vs = pdfPage.getViewport({ scale });
  await new TextLayer({
    textContentSource: textContent,
    container: textLayerFragment,
    viewport: vs,
  }).render();
  // A superseded run must not touch the DOM: two concurrent runs that both
  // cleared and refilled the layer are what garbled it on resize.
  if (!isStillCurrent()) return;
  textLayerDiv.replaceChildren(textLayerFragment);
};

const createLoadingIndicator = () => {
  const container = document.createElement('div');
  container.className = 'indicator-container';
  const indicator = document.createElement('div');
  indicator.className = 'lds-ring';
  indicator.innerHTML = '<div></div><div></div><div></div><div></div></div>';
  container.appendChild(indicator);
  return container;
};

export const renderPDF = (containerDiv: Element, documentUrl: string): { promise: Promise<unknown>; destroy: () => void } => {
  const wrapperDiv = document.createElement('div');
  wrapperDiv.className = 'wrapper';
  containerDiv.appendChild(wrapperDiv);
  const loadingIndicator = createLoadingIndicator();
  wrapperDiv.appendChild(loadingIndicator);
  const documentId = containerDiv.id;

  const canvasContainer = document.createElement('div');
  canvasContainer.className = 'canvas-container';
  const controlsDiv = document.createElement('div');
  controlsDiv.className = 'viewer-controls';
  const fullPageNumberDiv = document.createElement('div');
  fullPageNumberDiv.className = 'page-number';
  const pageNumberInput = document.createElement('input');
  pageNumberInput.className = 'page-number-input';
  pageNumberInput.type = 'number';
  const pageDiv = document.createElement('div');
  pageDiv.className = 'page-label';
  const outOfDiv = document.createElement('div');
  const pageCountDiv = document.createElement('div');
  const nextButton = document.createElement('button');
  nextButton.className = 'next-button';
  const prevButton = document.createElement('button');
  prevButton.className = 'prev-button';
  const loadingTask = getDocument({
    url: documentUrl,
    wasmUrl: wasmUrlFor(GlobalWorkerOptions.workerSrc),
  });

  const zoomSelect = document.createElement('select');
  zoomSelect.className = 'zoom-select';
  zoomValues.forEach((v) => {
    const zoomOption = document.createElement('option');
    zoomOption.value = `${v}`;
    zoomOption.textContent = `${v}%`;
    zoomSelect.appendChild(zoomOption);
  });
  zoomSelect.value = `${defaultWidth}`;

  const getZoomVal = (originalPageWidth: number) => {
    const pageWidth = (containerDiv as HTMLElement).clientWidth * (parseInt(zoomSelect.value) / 100);
    const scaledBy = pageWidth / originalPageWidth;
    (containerDiv as HTMLElement).style.setProperty('--scale-factor', scaledBy.toString());
    const scaleVal = scaledBy * 2.5 * PDFtoCSSConvert;
    return scaleVal;
  };

  const canvas = document.createElement('canvas');
  const textLayerDiv = document.createElement('div');

  // pdf.js tracks live render tasks per canvas in an internal WeakSet and throws
  // if a second render starts while the first still holds it. `currentRenderTask`
  // is that single slot, `renderChain` serializes callers, and `requestedPage`
  // lets superseded requests drop out instead of queueing a redundant render.
  let currentRenderTask: RenderTask | null = null;
  let renderChain: Promise<void> = Promise.resolve();
  let requestedPage = 1;
  let currentPage: CurrentPage | null = null;
  let textLayerGeneration = 0;
  let destroyed = false;

  const refreshTextLayer = (page: CurrentPage) => {
    textLayerGeneration += 1;
    const generation = textLayerGeneration;
    return scaleTextLayer(
      textLayerDiv,
      page.textContent,
      page.pdfPage,
      canvas,
      page.viewport,
      getZoomVal(page.originalPageWidth),
      () => !destroyed && generation === textLayerGeneration,
    );
  };

  // One listener over a mutable current-page slot. Registering it per page view
  // meant N pages produced N concurrent handlers on a single resize.
  const onResize = () => {
    if (destroyed || currentPage === null) return;
    refreshTextLayer(currentPage).catch(noop);
  };
  window.addEventListener('resize', onResize);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    window.removeEventListener('resize', onResize);
    if (currentRenderTask !== null) {
      currentRenderTask.cancel();
      currentRenderTask = null;
    }
    currentPage = null;
    loadingTask.destroy().catch(noop);
  };

  const promise = (async () => {
    try {
      const pdfDocument: PDFDocumentProxy = await loadingTask.promise;
      if (destroyed) return;
      wrapperDiv.removeChild(loadingIndicator);

      const isValidPage = (page: number) => page <= pdfDocument.numPages && page > 0;

      // initial viewer setup
      pageNumberInput.value = '1';
      pageDiv.textContent = 'Page ';
      outOfDiv.textContent = '/';
      pageCountDiv.textContent = `${pdfDocument.numPages}`;
      fullPageNumberDiv.appendChild(pageDiv);
      fullPageNumberDiv.appendChild(pageNumberInput);
      fullPageNumberDiv.appendChild(outOfDiv);
      fullPageNumberDiv.appendChild(pageCountDiv);

      // page container setup
      const pageContainer = document.createElement('div');
      pageContainer.className = 'page-container';
      pageContainer.style.width = `${defaultWidth}%`;
      canvasContainer.style.alignItems = 'center';
      canvasContainer.appendChild(pageContainer);
      canvas.className = 'pdf-viewer-canvas';
      canvas.id = `${documentId}-canvas`;
      pageContainer.appendChild(canvas);

      // text layer setup
      textLayerDiv.className = 'text-layer';
      pageContainer.appendChild(textLayerDiv);

      nextButton.innerHTML = chevronRight;
      prevButton.innerHTML = chevronLeft;

      wrapperDiv.appendChild(controlsDiv);
      controlsDiv.appendChild(prevButton);
      controlsDiv.appendChild(fullPageNumberDiv);
      controlsDiv.appendChild(nextButton);
      controlsDiv.appendChild(zoomSelect);
      wrapperDiv.appendChild(canvasContainer);

      const renderPage = async (page: number) => {
        const pdfPage = await pdfDocument.getPage(page);
        if (destroyed) return;
        const originalPageWidth = Number(pdfPage.view[2] || defaultPageWidth);
        const viewport = pdfPage.getViewport({ scale: getZoomVal(originalPageWidth) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        const task = pdfPage.render({ canvas, viewport });
        currentRenderTask = task;
        try {
          await task.promise;
        } finally {
          if (currentRenderTask === task) currentRenderTask = null;
        }
        if (destroyed) return;
        const textContent = await pdfPage.getTextContent();
        if (destroyed) return;
        currentPage = { textContent, pdfPage, viewport, originalPageWidth };
        await refreshTextLayer(currentPage);
      };

      const displayPage = (page: number): Promise<void> => {
        requestedPage = page;
        pageNumberInput.value = `${page}`;
        // Frees the canvas synchronously so the next chain link can claim it.
        if (currentRenderTask !== null) currentRenderTask.cancel();
        renderChain = renderChain
          .then(() => (destroyed || page !== requestedPage ? undefined : renderPage(page)))
          .catch((err: unknown) => {
            if (destroyed || isCancelled(err)) return;
            handleError(containerDiv)(err);
          });
        return renderChain;
      };

      zoomSelect.onchange = () => {
        const pageNumber = parseInt(pageNumberInput.value || '1');
        const zoomVal = parseInt(zoomSelect.value);
        pageContainer.style.width = `${zoomSelect.value}%`;
        if (zoomVal > 100) {
          canvasContainer.style.alignItems = 'flex-start';
        } else {
          canvasContainer.style.alignItems = 'center';
        }
        return displayPage(pageNumber);
      };

      const skipPage = (direction: number) => () => {
        const nextPageNumber = requestedPage + direction;
        if (isValidPage(nextPageNumber)) {
          void displayPage(nextPageNumber);
        }
      };
      nextButton.onclick = skipPage(1);
      prevButton.onclick = skipPage(-1);

      pageNumberInput.onchange = () => {
        const pageNumber = Math.max(Math.min(parseInt(pageNumberInput.value), pdfDocument.numPages), 1);
        void displayPage(pageNumber);
      };

      pageNumberInput.addEventListener('click', (e) => { e.stopPropagation(); });
      zoomSelect.addEventListener('click', (e) => { e.stopPropagation(); });

      containerDiv.addEventListener('keydown', (e) => {
        e.stopPropagation();
        switch ((e as KeyboardEvent).key) {
          case ('ArrowLeft'):
            skipPage(-1)();
            return;
          case ('ArrowRight'):
            skipPage(1)();
            return;
          default:
            return;
        }
      });

      containerDiv.addEventListener('click', () => {
        (containerDiv as HTMLDivElement).focus();
      });

      containerDiv.setAttribute('tabIndex', '1');

      (containerDiv as HTMLDivElement).focus();

      await displayPage(1);
      return;
    } catch (err) {
      if (destroyed || isCancelled(err)) return;
      handleError(containerDiv)(err);
      return err;
    }
  })();

  return { promise, destroy };
};

const renderDocx = (containerDiv: Element, documentUrl: string) => {
  const microsoftViewer = document.createElement('iframe');
  microsoftViewer.width = '100%';
  microsoftViewer.height = '100%';
  microsoftViewer.setAttribute('frameborder', '0');
  const params = new URLSearchParams({ src: documentUrl });
  microsoftViewer.setAttribute('src', `https://view.officeapps.live.com/op/embed.aspx?${params.toString()}`);
  containerDiv.appendChild(microsoftViewer);
};

const renderTxt = (containerDiv: Element, documentUrl: string) => {
  const embed = document.createElement('embed');
  embed.className = 'txt-embed';
  embed.setAttribute('src', documentUrl);
  containerDiv.appendChild(embed);
};

const renderErrorMessage = (containerDiv: Element) => (errorMessage: string) => {
  const errorDiv = document.createElement('div');
  errorDiv.className = 'error-message';
  errorDiv.textContent = errorMessage;
  containerDiv.appendChild(errorDiv);
};

// `init` renders on call and again on window load, and React StrictMode mounts
// twice; without this the earlier render's worker and resize listener outlive
// the DOM they were built for.
const teardowns = new WeakMap<Element, () => void>();

const renderDocumentIn = (workerSrc: string) => (containerDiv: Element): (() => void) => {
  try {
    containerDiv.innerHTML = '';
    const documentUrl = containerDiv.getAttribute('data-document-url');
    containerDiv.classList.add('document-viewer-ts');
    if (!documentUrl) throw new Error('No document url specified');
    const splitOnPeriods = documentUrl.split('.');
    const extension = splitOnPeriods[(splitOnPeriods.length - 1)]?.split('?')[0]?.toLowerCase();
    switch (extension) {
      case 'pdf':
        try {
          (() => globalThis)();
          new File([], 'test.txt');
          GlobalWorkerOptions.workerSrc = workerSrc;
          return renderPDF(containerDiv, documentUrl).destroy;
        } catch {
          renderErrorMessage(containerDiv)('Your browser does not support showing PDF previews. Click the download button to view this document.');
          return noop;
        }
      case 'doc': case 'docx': case 'ppt': case 'pptx': case 'xls': case 'xlsx': case 'xlt': case 'xlsm': case 'xlw': case 'pps': case 'ppxs': case 'ppsm': case 'sldx': case 'sldm':
        renderDocx(containerDiv, documentUrl);
        return noop;
      case 'txt':
        renderTxt(containerDiv, documentUrl);
        return noop;
      default:
        throw new Error('This file type is not supported for viewing in a web browser. Please click the “Download” button to view this document.');
    }
  } catch (err) {
    handleError(containerDiv)(err);
    return noop;
  }
};

export const renderDocument = (workerSrc: string) => (containerDiv: Element): (() => void) => {
  teardowns.get(containerDiv)?.();
  const destroy = renderDocumentIn(workerSrc)(containerDiv);
  const teardown = () => {
    if (teardowns.get(containerDiv) === teardown) teardowns.delete(containerDiv);
    destroy();
  };
  teardowns.set(containerDiv, teardown);
  return teardown;
};

const loadDocuments = (workerSrc: string) => () => {
  const containerDivs = document.getElementsByClassName('viewer-container');
  Array.from(containerDivs).forEach(renderDocument(workerSrc));
};

export const init = (workerSrc: string) => {
  loadDocuments(workerSrc)();
  window.addEventListener('load', loadDocuments(workerSrc));
};
