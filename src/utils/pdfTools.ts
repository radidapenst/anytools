import { PDFDocument } from 'pdf-lib';
import * as pdfjsLib from 'pdfjs-dist';

// Configure pdfjs worker dynamically for Vite
// @ts-ignore
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import JSZip from 'jszip';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

export interface PdfCompressOptions {
  quality: number; // 0.1 to 1.0 (e.g. 0.5 for medium)
  scale: number;   // resolution scale (e.g. 1.0)
}

export interface PdfToImageOptions {
  format: 'jpeg' | 'png';
  scale: number;
}

export interface ImageToPdfOptions {
  pageSize: 'fit' | 'a4';
  margin: number;
}

/**
 * Merge multiple PDF files into one single PDF Uint8Array.
 */
export async function mergePdfs(files: File[], onProgress?: (msg: string) => void): Promise<Uint8Array> {
  const mergedPdf = await PDFDocument.create();

  for (let i = 0; i < files.length; i++) {
    const file = files[i];
    if (onProgress) onProgress(`Memproses file ${i + 1} dari ${files.length}: ${file.name}`);
    
    const arrayBuffer = await file.arrayBuffer();
    const pdf = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
    const copiedPages = await mergedPdf.copyPages(pdf, pdf.getPageIndices());
    copiedPages.forEach((page) => mergedPdf.addPage(page));
  }

  if (onProgress) onProgress('Menyimpan file PDF hasil gabungan...');
  return await mergedPdf.save();
}

/**
 * Split PDF based on mode:
 * Mode 1 ('all'): Each page is extracted as an individual PDF. Returned as array of Blobs or zipped.
 */
export async function splitPdfAllPages(file: File, onProgress?: (msg: string) => void): Promise<{ name: string; blob: Blob }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();
  const results: { name: string; blob: Blob }[] = [];

  const baseName = file.name.replace(/\.[^/.]+$/, '');

  for (let i = 0; i < totalPages; i++) {
    if (onProgress) onProgress(`Mengekstrak halaman ${i + 1} dari ${totalPages}...`);
    const newDoc = await PDFDocument.create();
    const [copiedPage] = await newDoc.copyPages(srcDoc, [i]);
    newDoc.addPage(copiedPage);
    const pdfBytes = await newDoc.save();
    const blob = new Blob([new Uint8Array(pdfBytes)], { type: 'application/pdf' });
    results.push({
      name: `${baseName}_halaman_${i + 1}.pdf`,
      blob,
    });
  }

  return results;
}

/**
 * Split PDF by page range string like "1-3, 5, 8-10"
 */
export async function splitPdfByRange(
  file: File,
  rangeStr: string,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const srcDoc = await PDFDocument.load(arrayBuffer, { ignoreEncryption: true });
  const totalPages = srcDoc.getPageCount();

  // Parse range string (1-indexed input)
  const pageIndicesToKeep = parsePageRanges(rangeStr, totalPages);
  if (pageIndicesToKeep.length === 0) {
    throw new Error('Rentang halaman tidak valid atau di luar jangkauan.');
  }

  if (onProgress) onProgress(`Mengekstrak ${pageIndicesToKeep.length} halaman terpilih...`);
  const newDoc = await PDFDocument.create();
  const copiedPages = await newDoc.copyPages(srcDoc, pageIndicesToKeep);
  copiedPages.forEach((page) => newDoc.addPage(page));

  return await newDoc.save();
}

/**
 * Helper to parse page range input string like "1-3, 5, 7" into 0-indexed page indices.
 */
export function parsePageRanges(rangeStr: string, maxPages: number): number[] {
  const indicesSet = new Set<number>();
  const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);

  for (const part of parts) {
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((s) => s.trim());
      const start = parseInt(startStr, 10);
      const end = parseInt(endStr, 10);
      if (!isNaN(start) && !isNaN(end)) {
        const from = Math.max(1, Math.min(start, end));
        const to = Math.min(maxPages, Math.max(start, end));
        for (let i = from; i <= to; i++) {
          indicesSet.add(i - 1); // 0-indexed
        }
      }
    } else {
      const pageNum = parseInt(part, 10);
      if (!isNaN(pageNum) && pageNum >= 1 && pageNum <= maxPages) {
        indicesSet.add(pageNum - 1);
      }
    }
  }

  return Array.from(indicesSet).sort((a, b) => a - b);
}

/**
 * Compress PDF by rendering pages to compressed images and reconstructing the PDF.
 */
export async function compressPdf(
  file: File,
  options: PdfCompressOptions,
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfjsDoc = await loadingTask.promise;
  const totalPages = pdfjsDoc.numPages;

  const newPdfDoc = await PDFDocument.create();

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress(`Mekompres halaman ${i} dari ${totalPages}...`);
    const page = await pdfjsDoc.getPage(i);
    const viewport = page.getViewport({ scale: options.scale });

    // Render page to offscreen canvas
    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gagal menginisialisasi kanvas browser.');

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    // Convert canvas to compressed JPEG blob / dataURL
    const dataUrl = canvas.toDataURL('image/jpeg', options.quality);
    const base64Data = dataUrl.split(',')[1];
    const imageBytes = Uint8Array.from(atob(base64Data), (c) => c.charCodeAt(0));

    // Embed JPEG into new PDF document
    const embeddedImg = await newPdfDoc.embedJpg(imageBytes);
    const pdfPage = newPdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
    pdfPage.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: embeddedImg.width,
      height: embeddedImg.height,
    });
  }

  if (onProgress) onProgress('Menyimpan file PDF terkompresi...');
  return await newPdfDoc.save();
}

/**
 * Convert PDF pages to JPG or PNG images.
 * Returns array of image objects ({ name, blob }).
 */
export async function convertPdfToImages(
  file: File,
  options: PdfToImageOptions,
  onProgress?: (msg: string) => void
): Promise<{ name: string; blob: Blob; dataUrl: string }[]> {
  const arrayBuffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
  const pdfjsDoc = await loadingTask.promise;
  const totalPages = pdfjsDoc.numPages;

  const results: { name: string; blob: Blob; dataUrl: string }[] = [];
  const baseName = file.name.replace(/\.[^/.]+$/, '');
  const mimeType = options.format === 'png' ? 'image/png' : 'image/jpeg';
  const ext = options.format === 'png' ? 'png' : 'jpg';

  for (let i = 1; i <= totalPages; i++) {
    if (onProgress) onProgress(`Mengonversi halaman ${i} dari ${totalPages}...`);
    const page = await pdfjsDoc.getPage(i);
    const viewport = page.getViewport({ scale: options.scale });

    const canvas = document.createElement('canvas');
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Gagal menginisialisasi kanvas browser.');

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      canvas: canvas,
    }).promise;

    const dataUrl = canvas.toDataURL(mimeType, 0.92);
    
    // Create Blob from dataURL
    const base64Data = dataUrl.split(',')[1];
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Array(byteCharacters.length);
    for (let j = 0; j < byteCharacters.length; j++) {
      byteNumbers[j] = byteCharacters.charCodeAt(j);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: mimeType });

    results.push({
      name: `${baseName}_halaman_${i}.${ext}`,
      blob,
      dataUrl,
    });
  }

  return results;
}

/**
 * Convert images (JPG, PNG) to a single PDF document.
 */
export async function convertImagesToPdf(
  imageFiles: File[],
  onProgress?: (msg: string) => void
): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();

  for (let i = 0; i < imageFiles.length; i++) {
    const file = imageFiles[i];
    if (onProgress) onProgress(`Memproses gambar ${i + 1} dari ${imageFiles.length}: ${file.name}`);

    const arrayBuffer = await file.arrayBuffer();
    const bytes = new Uint8Array(arrayBuffer);

    let embeddedImg;
    const type = file.type.toLowerCase();

    if (type.includes('png')) {
      embeddedImg = await pdfDoc.embedPng(bytes);
    } else {
      // Default / fallback to JPG embedding
      try {
        embeddedImg = await pdfDoc.embedJpg(bytes);
      } catch {
        // Fallback for WebP or unsupported formats: render to canvas and export as PNG
        const blobUrl = URL.createObjectURL(file);
        const img = new Image();
        img.src = blobUrl;
        await new Promise((resolve) => { img.onload = resolve; });
        
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        URL.revokeObjectURL(blobUrl);

        const dataUrl = canvas.toDataURL('image/png');
        const pngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), (c) => c.charCodeAt(0));
        embeddedImg = await pdfDoc.embedPng(pngBytes);
      }
    }

    const page = pdfDoc.addPage([embeddedImg.width, embeddedImg.height]);
    page.drawImage(embeddedImg, {
      x: 0,
      y: 0,
      width: embeddedImg.width,
      height: embeddedImg.height,
    });
  }

  if (onProgress) onProgress('Membuat file PDF dari gambar...');
  return await pdfDoc.save();
}

/**
 * Create a ZIP file from multiple Blob files and trigger download or return zip blob.
 */
export async function zipBlobs(
  files: { name: string; blob: Blob }[]
): Promise<Blob> {
  const zip = new JSZip();
  files.forEach((f) => {
    zip.file(f.name, f.blob);
  });
  return await zip.generateAsync({ type: 'blob' });
}
