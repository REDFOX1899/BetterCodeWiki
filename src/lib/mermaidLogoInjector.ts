/**
 * Post-render SVG injector that adds tech stack logos to Mermaid diagram nodes.
 * Scans nodeLabel elements for technology keywords and prepends matching icons.
 */

import { getIconSvg } from './techIcons';

const ICON_SIZE = 18;
const INJECTED_ATTR = 'data-tech-icon-injected';

/**
 * Ensure a hex color has enough contrast for the given background.
 * For dark mode, lighten colors that are too dark.
 * For light mode, darken colors that are too light.
 */
function adjustColorForContrast(hex: string, dark: boolean): string {
  // Parse hex to RGB
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);

  // Relative luminance (simplified)
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

  if (dark && luminance < 0.4) {
    // Lighten for dark mode: blend towards white
    const factor = 0.6;
    const lr = Math.round(r + (255 - r) * factor);
    const lg = Math.round(g + (255 - g) * factor);
    const lb = Math.round(b + (255 - b) * factor);
    return `${lr.toString(16).padStart(2, '0')}${lg.toString(16).padStart(2, '0')}${lb.toString(16).padStart(2, '0')}`;
  }

  if (!dark && luminance > 0.85) {
    // Darken for light mode: blend towards black
    const factor = 0.4;
    const dr = Math.round(r * factor);
    const dg = Math.round(g * factor);
    const db = Math.round(b * factor);
    return `${dr.toString(16).padStart(2, '0')}${dg.toString(16).padStart(2, '0')}${db.toString(16).padStart(2, '0')}`;
  }

  return hex;
}

/**
 * Extract potential tech terms from a text string.
 * Splits by common delimiters used in Mermaid node labels.
 */
function extractTerms(text: string): string[] {
  // Split by newlines, pipes, brackets, parens, slashes, commas, colons
  return text
    .split(/[\n|/,:()\[\]{}]+/)
    .map(t => t.trim())
    .filter(t => t.length > 0 && t.length < 30);
}

/**
 * Inject tech stack logos into Mermaid diagram nodes within the given container.
 * Idempotent: calling multiple times will not duplicate icons.
 */
export function injectTechLogos(container: HTMLElement, dark: boolean): void {
  // Find all nodeLabel elements (inside foreignObject because Mermaid uses htmlLabels)
  const nodeLabels = container.querySelectorAll<HTMLElement>('.nodeLabel');

  for (const label of nodeLabels) {
    // Skip if already injected
    if (label.getAttribute(INJECTED_ATTR) === 'true') continue;

    const text = label.textContent || '';
    if (!text.trim()) continue;

    const terms = extractTerms(text);
    let matched = false;

    for (const term of terms) {
      const result = getIconSvg(term);
      if (result) {
        const color = adjustColorForContrast(result.hex, dark);

        // Create an inline SVG element
        const svgNS = 'http://www.w3.org/2000/svg';
        const svgEl = document.createElementNS(svgNS, 'svg');
        svgEl.setAttribute('xmlns', svgNS);
        svgEl.setAttribute('viewBox', '0 0 24 24');
        svgEl.setAttribute('width', String(ICON_SIZE));
        svgEl.setAttribute('height', String(ICON_SIZE));
        svgEl.style.display = 'inline-block';
        svgEl.style.verticalAlign = 'middle';
        svgEl.style.marginRight = '6px';
        svgEl.style.flexShrink = '0';

        // Parse the SVG string to extract the path
        const parser = new DOMParser();
        const svgDoc = parser.parseFromString(result.svg, 'image/svg+xml');
        const pathEl = svgDoc.querySelector('path');
        if (pathEl) {
          const newPath = document.createElementNS(svgNS, 'path');
          newPath.setAttribute('d', pathEl.getAttribute('d') || '');
          newPath.setAttribute('fill', `#${color}`);
          svgEl.appendChild(newPath);
        }

        // Prepend icon before the label content
        label.insertBefore(svgEl, label.firstChild);

        // Style the label for horizontal alignment
        label.style.display = 'flex';
        label.style.alignItems = 'center';
        label.style.justifyContent = 'center';

        matched = true;
        // Only inject the first matching icon per node
        break;
      }
    }

    if (matched) {
      label.setAttribute(INJECTED_ATTR, 'true');
    }
  }
}
