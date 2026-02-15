import { describe, it, expect, vi } from 'vitest';
import { extractElementInfo } from '../../../src/content/elementExtractor';
import { mockBoundingRect } from '../../setup';
import { TRUNCATE_LENGTH } from '../../../src/shared/constants';

function createElement(tag: string, attrs: Record<string, string> = {}): HTMLElement {
  const el = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'textContent') {
      el.textContent = value;
    } else {
      el.setAttribute(key, value);
    }
  }
  return el;
}

describe('extractElementInfo', () => {
  it('extracts tagName as lowercase', () => {
    const el = createElement('button');
    const info = extractElementInfo(el);
    expect(info.tagName).toBe('button');
  });

  it('extracts id when present', () => {
    const el = createElement('div', { id: 'main-nav' });
    const info = extractElementInfo(el);
    expect(info.id).toBe('main-nav');
  });

  it('omits id when empty', () => {
    const el = createElement('div');
    const info = extractElementInfo(el);
    expect(info.id).toBeUndefined();
  });

  it('extracts className', () => {
    const el = createElement('div', { class: 'btn btn-primary' });
    const info = extractElementInfo(el);
    expect(info.className).toBe('btn btn-primary');
  });

  it('extracts and sanitizes textContent, truncated to TRUNCATE_LENGTH', () => {
    const longText = 'A'.repeat(100);
    const el = createElement('span', { textContent: longText });
    const info = extractElementInfo(el);
    expect(info.textContent).toHaveLength(TRUNCATE_LENGTH);
  });

  it('strips angle brackets from textContent', () => {
    const el = createElement('span', { textContent: '<script>alert("x")</script>' });
    const info = extractElementInfo(el);
    expect(info.textContent).not.toContain('<');
    expect(info.textContent).not.toContain('>');
  });

  it('extracts ariaLabel', () => {
    const el = createElement('button', { 'aria-label': 'Close dialog' });
    const info = extractElementInfo(el);
    expect(info.ariaLabel).toBe('Close dialog');
  });

  it('extracts ariaRole', () => {
    const el = createElement('div', { role: 'navigation' });
    const info = extractElementInfo(el);
    expect(info.ariaRole).toBe('navigation');
  });

  it('extracts href from anchor elements (https)', () => {
    const el = createElement('a', { href: 'https://example.com/page' });
    const info = extractElementInfo(el);
    expect(info.href).toBe('https://example.com/page');
  });

  it('omits javascript: href', () => {
    const el = createElement('a');
    el.setAttribute('href', 'javascript:void(0)');
    const info = extractElementInfo(el);
    expect(info.href).toBeUndefined();
  });

  it('extracts type, name, placeholder for input', () => {
    const el = createElement('input', {
      type: 'email',
      name: 'user_email',
      placeholder: 'Enter email',
    }) as HTMLInputElement;
    const info = extractElementInfo(el);
    expect(info.type).toBe('email');
    expect(info.name).toBe('user_email');
    expect(info.placeholder).toBe('Enter email');
  });

  it('extracts autocomplete attribute', () => {
    const el = createElement('input', { autocomplete: 'email' }) as HTMLInputElement;
    const info = extractElementInfo(el);
    expect(info.autocomplete).toBe('email');
  });

  it('extracts title attribute', () => {
    const el = createElement('button', { title: 'Submit form' });
    const info = extractElementInfo(el);
    expect(info.title).toBe('Submit form');
  });

  it('extracts value for non-sensitive input', () => {
    const el = document.createElement('input');
    el.type = 'text';
    el.name = 'username';
    el.value = 'john_doe';
    const info = extractElementInfo(el);
    expect(info.value).toBe('john_doe');
  });

  it('redacts value for sensitive field (password type)', () => {
    const el = document.createElement('input');
    el.type = 'password';
    el.value = 'my-secret-pass';
    const info = extractElementInfo(el);
    expect(info.value).toBe('[REDACTED]');
  });

  it('redacts value for sensitive field (name=ssn)', () => {
    const el = document.createElement('input');
    el.type = 'text';
    el.name = 'ssn';
    el.value = '123-45-6789';
    const info = extractElementInfo(el);
    expect(info.value).toBe('[REDACTED]');
  });

  it('extracts checked for checkbox', () => {
    const el = document.createElement('input');
    el.type = 'checkbox';
    el.checked = true;
    const info = extractElementInfo(el);
    expect(info.checked).toBe(true);
  });

  it('extracts checked=false for unchecked radio', () => {
    const el = document.createElement('input');
    el.type = 'radio';
    el.checked = false;
    const info = extractElementInfo(el);
    expect(info.checked).toBe(false);
  });

  it('extracts boundingRect using mocked values', () => {
    const el = createElement('div');
    mockBoundingRect(el, { x: 10, y: 20, width: 100, height: 50, top: 20, right: 110, bottom: 70, left: 10 });
    const info = extractElementInfo(el);
    expect(info.boundingRect).toEqual({
      x: 10, y: 20, width: 100, height: 50,
      top: 20, right: 110, bottom: 70, left: 10,
    });
  });

  it('returns all-zero boundingRect without mock (jsdom default)', () => {
    const el = createElement('div');
    const info = extractElementInfo(el);
    expect(info.boundingRect.width).toBe(0);
    expect(info.boundingRect.height).toBe(0);
  });

  it('sets isInIframe to false in main window', () => {
    const el = createElement('div');
    const info = extractElementInfo(el);
    expect(info.isInIframe).toBe(false);
  });

  it('extracts value for select element', () => {
    const select = document.createElement('select');
    const option = document.createElement('option');
    option.value = 'choice-a';
    option.textContent = 'Choice A';
    select.appendChild(option);
    select.value = 'choice-a';
    const info = extractElementInfo(select);
    expect(info.value).toBe('choice-a');
  });

  it('extracts value for textarea element', () => {
    const el = document.createElement('textarea');
    el.name = 'notes';
    el.value = 'Some notes here';
    const info = extractElementInfo(el);
    expect(info.value).toBe('Some notes here');
  });
});
