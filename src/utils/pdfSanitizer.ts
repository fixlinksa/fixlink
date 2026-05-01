/**
 * Extremely aggressive sanitizer for html2canvas to prevent "Unexpected EOF" errors 
 * and other CSS parsing crashes caused by Tailwind 4's modern CSS features.
 */
export const sanitizeForHtml2Canvas = (clonedDoc: Document, targetId: string) => {
  const target = clonedDoc.getElementById(targetId);
  if (!target) return;

  // 1. Remove all dangerous global tags
  const tagsToRemove = clonedDoc.querySelectorAll('style, link, script, iframe, noscript, svg style, meta, head link');
  tagsToRemove.forEach(el => el.remove());

  // 2. Disable all remaining stylesheets
  try {
    for (let i = 0; i < clonedDoc.styleSheets.length; i++) {
      try {
        clonedDoc.styleSheets[i].disabled = true;
      } catch (e) {}
    }
  } catch (e) {}

  // 3. Force clean the body and html
  const html = clonedDoc.documentElement;
  const body = clonedDoc.body;
  html.className = '';
  html.style.cssText = 'background: white !important; color: black !important;';
  body.className = '';
  body.style.cssText = 'background: white !important; color: black !important; margin: 0; padding: 0;';

  // 4. Isolate the target: Remove everything else from body
  const targetClone = target.cloneNode(true) as HTMLElement;
  body.innerHTML = '';
  body.appendChild(targetClone);

  // 5. Deep sanitize every single element in the remaining tree
  const allElements = Array.from(body.querySelectorAll('*'));
  
  // Whitelist of safe CSS properties that html2canvas handles well
  const cssWhitelist = [
    'display', 'position', 'top', 'left', 'right', 'bottom',
    'width', 'height', 'min-width', 'min-height', 'max-width', 'max-height',
    'margin', 'margin-top', 'margin-bottom', 'margin-left', 'margin-right',
    'padding', 'padding-top', 'padding-bottom', 'padding-left', 'padding-right',
    'background', 'background-color', 'color',
    'border', 'border-top', 'border-bottom', 'border-left', 'border-right',
    'border-width', 'border-style', 'border-color', 'border-radius', 'border-collapse',
    'font-size', 'font-weight', 'font-family', 'font-style', 'line-height',
    'text-align', 'text-transform', 'text-decoration', 'letter-spacing',
    'vertical-align', 'opacity', 'visibility', 'z-index', 'overflow',
    'box-sizing', 'table-layout', 'list-style'
  ];

  // Dangerous values/functions that cause html2canvas parser to crash or EOF
  const poison = [
    'var(', 'calc(', 'oklch(', 'oklab(', 'lab(', 'lch(', 'color-mix(', 
    'clamp(', 'min(', 'max(', 'light-dark(', 'env(', 'attr(', 'url(', 
    'linear-gradient(', 'radial-gradient(', 'conic-gradient(', '\\'
  ];

  allElements.forEach(el => {
    const htmlEl = el as HTMLElement;
    
    // A. STRIP ALL CLASSES - This is critical to prevent Tailwind 4 lookups
    htmlEl.removeAttribute('class');
    htmlEl.removeAttribute('className');
    
    // B. Strip data attributes and event handlers
    const attrs = Array.from(htmlEl.attributes);
    attrs.forEach(attr => {
      if (attr.name.startsWith('data-') || attr.name.startsWith('on')) {
        htmlEl.removeAttribute(attr.name);
      }
    });

    // C. Sanitize Inline Styles
    const styleAttr = htmlEl.getAttribute('style');
    if (styleAttr) {
      // Manual parse to avoid being tricked by nested parens
      const declarations: string[] = [];
      let current = '';
      let depth = 0;
      let inQuote: string | null = null;

      for (let i = 0; i < styleAttr.length; i++) {
        const char = styleAttr[i];
        if (char === '"' || char === "'") {
          if (!inQuote) inQuote = char;
          else if (inQuote === char) inQuote = null;
        }
        if (!inQuote) {
          if (char === '(') depth++;
          if (char === ')') depth--;
          if (char === ';' && depth === 0) {
            if (current.trim()) declarations.push(current.trim());
            current = '';
            continue;
          }
        }
        current += char;
      }
      if (current.trim()) declarations.push(current.trim());

      const sanitizedDeclarations = declarations.map(decl => {
        const colonIndex = decl.indexOf(':');
        if (colonIndex === -1) return null;

        const key = decl.slice(0, colonIndex).trim().toLowerCase();
        let val = decl.slice(colonIndex + 1).trim();

        // 1. Must be in whitelist
        if (!cssWhitelist.includes(key)) return null;

        // 2. Must not contain poison
        const hasPoison = poison.some(p => val.toLowerCase().includes(p));
        if (hasPoison) {
          // Special cases: try to provide a fallback instead of just dropping
          if (key.includes('color')) return `${key}: #000000`;
          if (key.includes('width') || key.includes('height')) {
            if (val.includes('%')) return `${key}: 100%`;
            return `${key}: auto`;
          }
          return null;
        }

        // 3. Fix unclosed parens or quotes (just in case)
        let openP = 0;
        for (const c of val) {
          if (c === '(') openP++;
          if (c === ')') openP--;
        }
        while (openP > 0) { val += ')'; openP--; }
        while (openP < 0) { val = '(' + val; openP++; }

        return `${key}: ${val}`;
      }).filter(Boolean);

      if (sanitizedDeclarations.length > 0) {
        htmlEl.setAttribute('style', sanitizedDeclarations.join('; ') + ';');
      } else {
        htmlEl.removeAttribute('style');
      }
    }

    // D. SVG Specific Cleanup
    if (htmlEl.tagName.toLowerCase() === 'svg') {
      htmlEl.setAttribute('width', htmlEl.getAttribute('width') || '20');
      htmlEl.setAttribute('height', htmlEl.getAttribute('height') || '20');
    }
  });

  // 6. Final safety check: ensure the document has NO style tags left
  const remainingStyles = clonedDoc.querySelectorAll('style');
  remainingStyles.forEach(s => s.remove());
};
