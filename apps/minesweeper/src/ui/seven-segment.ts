import { litSegments, SEGMENT_NAMES } from './display';
import type { SegmentName } from './display';
import { createSvgElement } from './svg';

// 1桁ぶんの座標系。幅12、高さ22。
const DIGIT_VIEW_BOX = '0 0 12 22';
const DIGIT_COUNT = 3;

/** 横向きのセグメント（両端がとがった六角形）。`centerY` は中心線の高さ。 */
function horizontalSegment(centerY: number): string {
  const top = centerY - 1.5;
  const bottom = centerY + 1.5;
  return `2.5,${centerY} 4,${top} 8,${top} 9.5,${centerY} 8,${bottom} 4,${bottom}`;
}

/** 縦向きのセグメント。`centerX` は中心線の位置、`top` は上端。長さは8。 */
function verticalSegment(centerX: number, top: number): string {
  const left = centerX - 1.5;
  const right = centerX + 1.5;
  const bottom = top + 8;
  return `${centerX},${top} ${right},${top + 1.5} ${right},${bottom - 1.5} ${centerX},${bottom} ${left},${bottom - 1.5} ${left},${top + 1.5}`;
}

function segmentPoints(name: SegmentName): string {
  switch (name) {
    case 'a':
      return horizontalSegment(2);
    case 'b':
      return verticalSegment(10, 2.5);
    case 'c':
      return verticalSegment(10, 11.5);
    case 'd':
      return horizontalSegment(20);
    case 'e':
      return verticalSegment(2, 11.5);
    case 'f':
      return verticalSegment(2, 2.5);
    case 'g':
      return horizontalSegment(11);
  }
}

interface Digit {
  readonly segments: ReadonlyMap<SegmentName, SVGElement>;
}

function createDigit(parent: HTMLElement): Digit {
  const svg = createSvgElement('svg');
  svg.setAttribute('class', 'segment-digit');
  svg.setAttribute('viewBox', DIGIT_VIEW_BOX);
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('focusable', 'false');

  const segments = new Map<SegmentName, SVGElement>();
  for (const name of SEGMENT_NAMES) {
    const polygon = createSvgElement('polygon');
    polygon.setAttribute('class', 'segment');
    polygon.setAttribute('points', segmentPoints(name));
    svg.append(polygon);
    segments.set(name, polygon);
  }
  parent.append(svg);
  return { segments };
}

export interface SegmentDisplay {
  readonly element: HTMLElement;
  /**
   * @param text 表示する3文字（`formatCounter` の結果）
   * @param label 読み上げ用の説明
   */
  show(text: string, label: string): void;
}

/** 3桁の7セグメント表示器を作る。 */
export function createSegmentDisplay(testId: string): SegmentDisplay {
  const element = document.createElement('div');
  element.className = 'segment-display';
  element.dataset.testid = testId;
  // セグメントの絵からは値を読み取れないので、全体を1つの絵として説明を付ける。
  element.setAttribute('role', 'img');

  const digits: Digit[] = [];
  for (let index = 0; index < DIGIT_COUNT; index += 1) {
    digits.push(createDigit(element));
  }

  return {
    element,
    show(text: string, label: string): void {
      // タイマーの割り込みは値が変わらなくても来るので、同じ値では書き換えない。
      if (element.dataset.value === text) {
        return;
      }
      element.dataset.value = text;
      element.setAttribute('aria-label', label);
      const characters = [...text];
      digits.forEach((digit, index) => {
        const lit = litSegments(characters[index] ?? '');
        for (const [name, polygon] of digit.segments) {
          polygon.classList.toggle('is-lit', lit.includes(name));
        }
      });
    },
  };
}
