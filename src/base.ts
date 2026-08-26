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

const cancelledNames = ['RenderingCancelledException', 'AbortError'];

const isCancelled = (err: unknown): boolean =>
  err instanceof RenderingCancelledException ||
  (typeof err === 'object' && err !== null && cancelledNames.includes(String((err as { name?: string }).name)));

// pdf.js's own ceilings (AppOptions maxCanvasPixels / maxCanvasDim). Past
// either one the browser hands back a blank canvas with no error, so a zoom
// that would exceed them is rendered at the largest scale that fits.
const maxCanvasPixels = 2 ** 25;
const maxCanvasDim = 32767;

const fittedScale = (pdfPage: PDFPageProxy, scale: number): number => {
  const { width, height } = pdfPage.getViewport({ scale });
  const byArea = Math.sqrt(maxCanvasPixels / (width * height));
  const bySide = Math.min(maxCanvasDim / width, maxCanvasDim / height);
  return scale * Math.min(1, byArea, bySide);
};

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

export const renderPDF = (containerDiv: Element, documentUrl: string): (() => void) => {
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
    const scaleVal = scaledBy * 2.5 * PDFtoCSSConvert;
    return scaleVal;
  };

  const canvas = document.createElement('canvas');
  const textLayerDiv = document.createElement('div');

  // pdf.js tracks live render tasks per canvas in an internal WeakSet and throws
  // if a second render starts while the first still holds it. `currentRenderTask`
  // is that single slot, `renderChain` serializes callers, and `requestedPage`
  // lets superseded requests drop out instead of queueing a redundant render.
  const controller = new AbortController();
  const { signal } = controller;
  // JavaScript has no cancellable await, so resumption has to be made
  // conditional by hand. Awaiting through this rather than bare keeps the
  // guarded form the shorter one to write and the funnel the only exit.
  const upTo = <A>(p: Promise<A>): Promise<A> => p.then((a) => { signal.throwIfAborted(); return a; });
  // pdf.js rejects in-flight work with a plain Error when the loading task is
  // destroyed, so a cancelled render is not identifiable from the error alone.
  const ignorable = (err: unknown): boolean => signal.aborted || isCancelled(err);
  let currentRenderTask: RenderTask | null = null;
  let renderChain: Promise<void> = Promise.resolve();
  let requestedPage = 1;
  let currentPage: CurrentPage | null = null;
  let textLayerGeneration = 0;

  const refreshTextLayer = (page: CurrentPage) => {
    const pdfScale = getZoomVal(page.originalPageWidth);
    // pdf.js sizes the layer as --total-scale-factor * the raw page width, so
    // this must come from the laid-out canvas: deriving it from the container
    // overshoots wherever .wrapper reserves a classic scrollbar.
    if (canvas.offsetWidth > 0) {
      (containerDiv as HTMLElement).style
        .setProperty('--scale-factor', `${canvas.offsetWidth / page.originalPageWidth}`);
    }
    textLayerGeneration += 1;
    const generation = textLayerGeneration;
    return scaleTextLayer(
      textLayerDiv,
      page.textContent,
      page.pdfPage,
      canvas,
      page.viewport,
      pdfScale,
      () => !signal.aborted && generation === textLayerGeneration,
    );
  };

  // One observer over a mutable current-page slot. Registering per page view
  // meant N pages produced N concurrent handlers on a single resize, and a
  // window listener misses the container being resized by anything other than
  // the viewport — a tab, accordion or modal revealing it, most importantly,
  // which is what left a hidden container stuck at a 0x0 canvas.
  let lastWidth = 0;
  let rerender: (() => void) | null = null;
  const onResize = () => {
    const width = (containerDiv as HTMLElement).clientWidth;
    // ResizeObserver coalesces to one callback per frame, but a drag still
    // yields a callback per frame; a width that did not change cannot move the
    // text layer, and rebuilding it streams every item on the page.
    if (currentPage === null || width === 0 || width === lastWidth) return;
    lastWidth = width;
    // A container that was not laid out rendered a 0x0 canvas; scaling the text
    // layer over it cannot recover, only rendering the page again can.
    if (canvas.width === 0 && rerender !== null) { rerender(); return; }
    refreshTextLayer(currentPage).catch(noop);
  };
  const observer = new ResizeObserver(onResize);
  observer.observe(containerDiv);
  signal.addEventListener('abort', () => { observer.disconnect(); });

  signal.addEventListener('abort', () => {
    if (currentRenderTask !== null) {
      currentRenderTask.cancel();
      currentRenderTask = null;
    }
    currentPage = null;
    wrapperDiv.remove();
    loadingTask.destroy().catch(noop);
  });

  const destroy = () => { controller.abort(); };

  void (async () => {
    try {
      const pdfDocument: PDFDocumentProxy = await upTo(loadingTask.promise);
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
        const pdfPage = await upTo(pdfDocument.getPage(page));
        const originalPageWidth = Number(pdfPage.view[2] || defaultPageWidth);
        const viewport = pdfPage.getViewport({ scale: fittedScale(pdfPage, getZoomVal(originalPageWidth)) });
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        canvas.style.width = '100%';
        const task = pdfPage.render({ canvas, viewport });
        currentRenderTask = task;
        try {
          await upTo(task.promise);
        } finally {
          if (currentRenderTask === task) currentRenderTask = null;
        }
        const textContent = await upTo(pdfPage.getTextContent());
        currentPage = { textContent, pdfPage, viewport, originalPageWidth };
        await refreshTextLayer(currentPage);
      };

      const displayPage = (page: number): Promise<void> => {
        requestedPage = page;
        pageNumberInput.value = `${page}`;
        // Frees the canvas synchronously so the next chain link can claim it.
        if (currentRenderTask !== null) currentRenderTask.cancel();
        renderChain = renderChain
          .then(() => (signal.aborted || page !== requestedPage ? undefined : renderPage(page)))
          .catch((err: unknown) => {
            if (ignorable(err)) return;
            handleError(containerDiv)(err);
          });
        return renderChain;
      };

      rerender = () => { void displayPage(requestedPage); };

      zoomSelect.onchange = () => {
        const pageNumber = requestedPage;
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
        const parsed = parseInt(pageNumberInput.value);
        const pageNumber = Number.isNaN(parsed) ? requestedPage : Math.max(Math.min(parsed, pdfDocument.numPages), 1);
        void displayPage(pageNumber);
      };

      pageNumberInput.addEventListener('click', (e) => { e.stopPropagation(); }, { signal });
      zoomSelect.addEventListener('click', (e) => { e.stopPropagation(); }, { signal });

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
      }, { signal });

      containerDiv.addEventListener('click', () => {
        (containerDiv as HTMLDivElement).focus();
      }, { signal });

      containerDiv.setAttribute('tabIndex', '1');

      (containerDiv as HTMLDivElement).focus();

      await displayPage(1);
    } catch (err) {
      if (ignorable(err)) return;
      wrapperDiv.remove();
      handleError(containerDiv)(err);
    }
  })();

  return destroy;
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
          return renderPDF(containerDiv, documentUrl);
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
    // A superseded render was already torn down when its replacement claimed
    // the container; running this again would blank the live viewer.
    if (teardowns.get(containerDiv) !== teardown) return;
    teardowns.delete(containerDiv);
    destroy();
    // Only the pdf path owns a destroy; the iframe, embed and error renderers
    // append straight to the container and would otherwise outlive teardown.
    containerDiv.replaceChildren();
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
