const SVG_NAMESPACE = 'http://www.w3.org/2000/svg';

/** index.html の `<symbol id="icon-…">` として定義した絵の名前。 */
export type IconName =
  'mine' | 'flag' | 'wrong-flag' | 'face-playing' | 'face-won' | 'face-lost';

/** SVGの要素は名前空間つきで作らないと、HTMLの未知の要素になって描画されない。 */
export function createSvgElement(name: string): SVGElement {
  return document.createElementNS(SVG_NAMESPACE, name);
}

/**
 * index.html に定義した絵を参照する `<svg><use/></svg>` を作る。
 * 絵をJSの文字列として持たずに済むので、innerHTMLを使わずに描ける。
 */
export function createIcon(name: IconName): SVGElement {
  const svg = createSvgElement('svg');
  svg.setAttribute('class', 'icon');
  // 絵の意味は、周りの要素の属性や通知領域で伝える。
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');
  const use = createSvgElement('use');
  use.setAttribute('href', `#icon-${name}`);
  svg.append(use);
  return svg;
}
