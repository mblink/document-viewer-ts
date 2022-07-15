/// <reference types="jest" />
import { ViewerWindow, renderPDF } from '../src/base';
import { GlobalWorkerOptions } from 'pdfjs-dist';

describe('test pdf viewer', () => {
  const documentId = 'doc-1';
  const documentUrl = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';
  GlobalWorkerOptions.workerSrc = '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js'; // legacy worker to handle jsdom
  const containerDiv = document.createElement('div');
  containerDiv.className = 'viewerContainer';
  containerDiv.setAttribute('id', documentId);
  containerDiv.setAttribute('data-document-url', documentUrl);
  document.body.appendChild(containerDiv);

  it('should create PDF canvas container, canvas for every page, and skip pages', async () => {
    const vw = window as unknown as ViewerWindow;
    await renderPDF(containerDiv, documentUrl);
    expect(vw.viewerState[documentId]?.pageBreaks).toEqual([16,  48,  80, 112, 144, 176, 208, 240, 272, 304, 336, 368, 400, 432]);
    const canvasContainer = document.getElementsByClassName('canvasContainer');
    expect(canvasContainer.length).toEqual(1);
    const canvasElements = document.getElementsByClassName('pdfViewerCanvas');
    expect(canvasElements.length).toEqual(14);
    const pageContainers = document.getElementsByClassName('pageContainer');
    expect(pageContainers.length).toEqual(14);
    const pageNumberDivs = document.getElementsByClassName('pageNumberRaw');
    expect(pageNumberDivs.length).toEqual(1);
    const pageNumberDiv = pageNumberDivs[0] as Element;
    expect(pageNumberDiv.textContent).toEqual('1');
    const nextButtons = document.getElementsByClassName('nextButton');
    expect(nextButtons.length).toEqual(1);
    const nextButton = nextButtons[0] as HTMLButtonElement;
    const prevButtons = document.getElementsByClassName('prevButton');
    expect(prevButtons.length).toEqual(1);
    const prevButton = prevButtons[0] as HTMLButtonElement;
    nextButton.click();
    expect(pageNumberDiv.textContent).toEqual('2');
    prevButton.click();
    expect(pageNumberDiv.textContent).toEqual('1');
    prevButton.click();
    expect(pageNumberDiv.textContent).toEqual('1');
    const zoomButtons = document.getElementsByClassName('zoomButton');
    expect(zoomButtons.length).toEqual(1);
    const zoomButton = zoomButtons[0] as HTMLButtonElement;
    const firstPage = pageContainers[0] as HTMLDivElement;
    expect(firstPage.style.width).toEqual('80%');
    zoomButton.click();
    expect(firstPage.style.width).toEqual('100%');
    zoomButton.click();
    expect(firstPage.style.width).toEqual('80%');
  });
});