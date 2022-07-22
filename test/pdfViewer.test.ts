/// <reference types="jest" />
import { GlobalWorkerOptions } from 'pdfjs-dist';
import { renderPDF } from '../src/base';

describe('test pdf viewer', () => {
  const documentId = 'doc-1';
  const documentUrl = 'https://raw.githubusercontent.com/mozilla/pdf.js/ba2edeae/web/compressed.tracemonkey-pldi-09.pdf';
  GlobalWorkerOptions.workerSrc = '../../../node_modules/pdfjs-dist/legacy/build/pdf.worker.min.js'; // legacy worker to handle jsdom
  const containerDiv = document.createElement('div');
  containerDiv.className = 'viewer-container';
  containerDiv.setAttribute('id', documentId);
  containerDiv.setAttribute('data-document-url', documentUrl);
  document.body.appendChild(containerDiv);

  it('should create PDF canvas container, canvas for every page, and skip pages', async () => {
    await renderPDF(containerDiv, documentUrl);
    const canvasContainer = document.getElementsByClassName('canvas-container');
    expect(canvasContainer.length).toEqual(1);
    const canvasElements = document.getElementsByClassName('pdf-viewer-canvas');
    expect(canvasElements.length).toEqual(1);
    const pageContainers = document.getElementsByClassName('page-container');
    expect(pageContainers.length).toEqual(1);
    const pageNumberInputs = document.getElementsByClassName('page-number-input');
    expect(pageNumberInputs.length).toEqual(1);
    const pageNumberInput = pageNumberInputs[0] as HTMLInputElement;
    expect(pageNumberInput.value).toEqual('1');
    const nextButtons = document.getElementsByClassName('next-button');
    expect(nextButtons.length).toEqual(1);
    const prevButtons = document.getElementsByClassName('prev-button');
    expect(prevButtons.length).toEqual(1);
    const zoomButtons = document.getElementsByClassName('zoom-button');
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