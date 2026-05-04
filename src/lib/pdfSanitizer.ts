/**
 * pdfSanitizer.ts
 *
 * Renders a DOM element inside an isolated <iframe> with ZERO external
 * stylesheets, so html2canvas never encounters oklch/var()/calc() from
 * Tailwind 4. All styles are pre-resolved via window.getComputedStyle()
 * which always returns safe rgb() values.
 */

import html2canvas from 'html2canvas';

const RENDER_PROPS = [
  'display', 'visibility', 'opacity',
  'position', 'top', 'right', 'bottom', 'left', 'z-index',
  'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
  'box-sizing', 'overflow',
  'margin-top', 'margin-right', 'margin-bottom', 'margin-left',
  'padding-top', 'padding-right', 'padding-bottom', 'padding-left',
  'border-top-width', 'border-right-width', 'border-bottom-width', 'border-left-width',
  'border-top-style', 'border-right-style', 'border-bottom-style', 'border-left-style',
  'border-top-color', 'border-right-color', 'border-bottom-color', 'border-left-color',
  'border-top-left-radius', 'border-top-right-radius',
  'border-bottom-right-radius', 'border-bottom-left-radius',
  'border-collapse', 'border-spacing',
  'color', 'background-color',
  'font-size', 'font-weight', 'font-style',
  'line-height', 'letter-spacing', 'text-align', 'text-transform',
  'text-decoration', 'text-indent', 'white-space', 'word-break',
  'vertical-align',
  'flex-direction', 'flex-wrap', 'justify-content', 'align-items',
  'align-self', 'flex-grow', 'flex-shrink',
  'table-layout',
];

const SAFE_FONT = 'Arial, Helvetica, sans-serif';
const MODERN_RE = /oklch\(|oklab\(|lab\(|lch\(|color-mix\(|var\(|env\(|clamp\(|light-dark\(/i;

/** Recursively build clean HTML with only safe inline styles */
function buildCleanHtml(el: Element): string {
  // Text nodes
  if (el.nodeType === Node.TEXT_NODE) return (el as unknown as Text).textContent || '';
  if (!(el instanceof HTMLElement)) return '';

  const tag = el.tagName.toLowerCase();
  // Skip script/style tags entirely
  if (tag === 'script' || tag === 'style' || tag === 'noscript') return '';

  // Compute safe styles
  const computed = window.getComputedStyle(el);
  const styles: string[] = [];
  for (const prop of RENDER_PROPS) {
    try {
      const val = computed.getPropertyValue(prop).trim();
      if (!val || val === 'initial' || val === 'inherit' || val === 'unset') continue;
      if (MODERN_RE.test(val)) continue;
      // Skip system-ui / family-name stacks that reference CSS variables
      if (prop === 'font-family') {
        styles.push(`font-family: ${SAFE_FONT}`);
        continue;
      }
      styles.push(`${prop}: ${val}`);
    } catch { /* skip */ }
  }

  const attrs: string[] = [`style="${styles.join('; ')}"`];

  if (tag === 'img') {
    const src = el.getAttribute('src') || '';
    const alt = el.getAttribute('alt') || '';
    if (src) attrs.push(`src="${src}"`);
    attrs.push(`alt="${alt}"`, 'crossorigin="anonymous"');
    return `<img ${attrs.join(' ')}>`;
  }

  // Colspan / rowspan for tables
  const colspan = el.getAttribute('colspan');
  const rowspan = el.getAttribute('rowspan');
  if (colspan) attrs.push(`colspan="${colspan}"`);
  if (rowspan) attrs.push(`rowspan="${rowspan}"`);

  const children = Array.from(el.childNodes).map(child => {
    if (child.nodeType === Node.TEXT_NODE) return child.textContent || '';
    if (child instanceof Element) return buildCleanHtml(child);
    return '';
  }).join('');

  return `<${tag} ${attrs.join(' ')}>${children}</${tag}>`;
}

/**
 * Main export: renders the element in an isolated iframe and returns a canvas.
 * Call this instead of html2canvas directly.
 */
export const renderPdfCanvas = async (elementId: string): Promise<HTMLCanvasElement> => {
  const element = document.getElementById(elementId);
  if (!element) throw new Error(`Element #${elementId} not found`);

  // Build clean HTML from computed (rgb) styles
  const cleanHtml = buildCleanHtml(element);
  const elWidth = element.scrollWidth || 900;
  const elHeight = element.scrollHeight || 1400;

  console.log(`[PDF Engine] Initializing render for #${elementId} (${elWidth}x${elHeight})`);

  // Create a hidden iframe with no stylesheets
  const iframe = document.createElement('iframe');
  // REMOVED: sandbox attribute was too restrictive for some production CORS/CSP environments
  iframe.src = 'about:blank';
  iframe.style.cssText = `position:fixed;top:-10000px;left:-10000px;width:${elWidth}px;height:${elHeight}px;border:none;visibility:hidden;z-index:-1;`;
  document.body.appendChild(iframe);

  try {
    const iDoc = iframe.contentDocument!;
    iDoc.open();
    iDoc.write(`<!DOCTYPE html><html><head><meta charset="UTF-8"><style>
      *{box-sizing:border-box;margin:0;padding:0;}
      body{background:#fff;font-family:${SAFE_FONT};color:#000;width:${elWidth}px;height:${elHeight}px;overflow:hidden;}
      table{border-collapse:collapse;width:100%;}
      img{display:block;max-width:100%;height:auto;}
    </style></head><body>${cleanHtml}</body></html>`);
    iDoc.close();

    // Wait for images inside the iframe to load
    const images = Array.from(iDoc.querySelectorAll('img')) as HTMLImageElement[];
    console.log(`[PDF Engine] Waiting for ${images.length} images to load...`);
    
    await Promise.all(images.map(img => {
      if (img.complete) return Promise.resolve();
      return new Promise(resolve => {
        img.onload = () => resolve(true);
        img.onerror = () => {
          console.warn(`[PDF Engine] Image failed to load: ${img.src}`);
          resolve(false);
        };
      });
    }));

    // Extra settle time for rendering engine to finish painting
    await new Promise(r => setTimeout(r, 400));

    const targetEl = iDoc.body.firstElementChild as HTMLElement || iDoc.body;

    console.log('[PDF Engine] Capturing canvas via html2canvas...');
    const canvas = await html2canvas(targetEl, {
      scale: 2, // Increased scale for higher quality prints
      useCORS: true,
      allowTaint: false,
      logging: true, // Enable logging for easier debugging in production console
      backgroundColor: '#ffffff',
      windowWidth: elWidth,
      windowHeight: elHeight,
      width: elWidth,
      height: elHeight,
    });

    console.log('[PDF Engine] Canvas capture successful.');
    return canvas;
  } catch (err) {
    console.error('[PDF Engine] Critical Failure:', err);
    throw err;
  } finally {
    if (document.body.contains(iframe)) {
      document.body.removeChild(iframe);
    }
  }
};

// Keep legacy export so existing onclone calls don't break (no-op now)
export const sanitizeForHtml2Canvas = (_clonedDoc: Document, _targetId?: string) => {};
export const freezeElementStyles = (_elementId: string): (() => void) => () => {};
