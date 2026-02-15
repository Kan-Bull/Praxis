import { describe, it, expect } from 'vitest';
import { generateDescription } from '@shared/descriptionGenerator';
import type { InteractionEvent, ElementInfo } from '@shared/types';

function makeElement(overrides: Partial<ElementInfo> = {}): ElementInfo {
  return {
    tagName: 'BUTTON',
    boundingRect: { x: 0, y: 0, width: 100, height: 30, top: 0, right: 100, bottom: 30, left: 0 },
    isInIframe: false,
    ...overrides,
  };
}

function makeEvent(overrides: Partial<InteractionEvent> = {}): InteractionEvent {
  return {
    type: 'click',
    timestamp: Date.now(),
    url: 'https://example.com',
    element: makeElement(),
    ...overrides,
  };
}

describe('generateDescription – click', () => {
  it('should use ariaLabel first', () => {
    const event = makeEvent({
      element: makeElement({ ariaLabel: 'Submit form' }),
    });
    expect(generateDescription(event)).toBe("Clicked 'Submit form'");
  });

  it('should fall back to textContent', () => {
    const event = makeEvent({
      element: makeElement({ textContent: 'Save Changes' }),
    });
    expect(generateDescription(event)).toBe("Clicked 'Save Changes'");
  });

  it('should fall back to placeholder', () => {
    const event = makeEvent({
      element: makeElement({ tagName: 'INPUT', placeholder: 'Search...' }),
    });
    expect(generateDescription(event)).toBe("Clicked 'Search...'");
  });

  it('should fall back to title', () => {
    const event = makeEvent({
      element: makeElement({ title: 'More options' }),
    });
    expect(generateDescription(event)).toBe("Clicked 'More options'");
  });

  it('should fall back to id', () => {
    const event = makeEvent({
      element: makeElement({ id: 'submit-btn' }),
    });
    expect(generateDescription(event)).toBe("Clicked 'submit-btn'");
  });

  it('should use generic fallback for unknown elements', () => {
    const event = makeEvent({
      element: makeElement({ tagName: 'SPAN' }),
    });
    expect(generateDescription(event)).toBe('Clicked element');
  });

  it('should truncate long labels', () => {
    const event = makeEvent({
      element: makeElement({ textContent: 'a'.repeat(100) }),
    });
    const desc = generateDescription(event);
    expect(desc.length).toBeLessThanOrEqual(60); // "Clicked '" + 50 chars + "'"
  });

  it('should append href for links', () => {
    const event = makeEvent({
      element: makeElement({
        tagName: 'A',
        textContent: 'Docs',
        href: 'https://docs.example.com',
      }),
    });
    expect(generateDescription(event)).toBe(
      "Clicked 'Docs' (https://docs.example.com)",
    );
  });

  it('should indicate role=tab', () => {
    const event = makeEvent({
      element: makeElement({
        ariaRole: 'tab',
        textContent: 'Settings',
      }),
    });
    expect(generateDescription(event)).toBe("Clicked tab 'Settings'");
  });

  it('should indicate role=menuitem', () => {
    const event = makeEvent({
      element: makeElement({
        ariaRole: 'menuitem',
        textContent: 'Delete',
      }),
    });
    expect(generateDescription(event)).toBe("Clicked menu item 'Delete'");
  });

  it('should prefix iframe interactions', () => {
    const event = makeEvent({
      element: makeElement({
        textContent: 'OK',
        isInIframe: true,
      }),
    });
    expect(generateDescription(event)).toBe("In iframe: Clicked 'OK'");
  });

  it('should mask sensitive field clicks', () => {
    const event = makeEvent({
      element: makeElement({
        tagName: 'INPUT',
        type: 'password',
        placeholder: 'Password',
      }),
    });
    expect(generateDescription(event)).toBe('Clicked sensitive field');
  });
});

describe('generateDescription – input', () => {
  it('should describe text input with label', () => {
    const event = makeEvent({
      type: 'input',
      element: makeElement({
        tagName: 'INPUT',
        type: 'text',
        ariaLabel: 'Username',
      }),
    });
    expect(generateDescription(event)).toBe("Typed in text field 'Username'");
  });

  it('should describe email input', () => {
    const event = makeEvent({
      type: 'input',
      element: makeElement({
        tagName: 'INPUT',
        type: 'email',
        ariaLabel: 'Email',
      }),
    });
    expect(generateDescription(event)).toBe("Typed in email field 'Email'");
  });

  it('should mask sensitive input fields', () => {
    const event = makeEvent({
      type: 'input',
      element: makeElement({
        tagName: 'INPUT',
        type: 'password',
        ariaLabel: 'Password',
      }),
    });
    expect(generateDescription(event)).toBe('Typed in sensitive field');
  });

  it('should describe textarea input', () => {
    const event = makeEvent({
      type: 'input',
      element: makeElement({
        tagName: 'TEXTAREA',
        ariaLabel: 'Comments',
      }),
    });
    expect(generateDescription(event)).toBe("Typed in textarea 'Comments'");
  });

  it('should include typed value with label', () => {
    const event = makeEvent({
      type: 'input',
      value: 'Hello',
      element: makeElement({
        tagName: 'INPUT',
        type: 'text',
        ariaLabel: 'Search Wikipedia',
      }),
    });
    expect(generateDescription(event)).toBe(
      `Typed "Hello" in text field 'Search Wikipedia'`,
    );
  });

  it('should include typed value without label', () => {
    const event = makeEvent({
      type: 'input',
      value: 'Hello',
      element: makeElement({
        tagName: 'INPUT',
        type: 'text',
      }),
    });
    expect(generateDescription(event)).toBe('Typed "Hello" in text field');
  });

  it('should include typed value in textarea', () => {
    const event = makeEvent({
      type: 'input',
      value: 'Some comment',
      element: makeElement({
        tagName: 'TEXTAREA',
        ariaLabel: 'Comments',
      }),
    });
    expect(generateDescription(event)).toBe(
      `Typed "Some comment" in textarea 'Comments'`,
    );
  });

  it('should NOT include value for sensitive fields', () => {
    const event = makeEvent({
      type: 'input',
      value: 'secret123',
      element: makeElement({
        tagName: 'INPUT',
        type: 'password',
        ariaLabel: 'Password',
      }),
    });
    expect(generateDescription(event)).toBe('Typed in sensitive field');
  });

  it('should truncate long typed values', () => {
    const event = makeEvent({
      type: 'input',
      value: 'a'.repeat(100),
      element: makeElement({
        tagName: 'INPUT',
        type: 'text',
        ariaLabel: 'Search',
      }),
    });
    const desc = generateDescription(event);
    // Value should be truncated, not the full 100 chars
    expect(desc).toContain('"');
    expect(desc.length).toBeLessThan(120);
  });

  it('should handle redacted value placeholder', () => {
    const event = makeEvent({
      type: 'input',
      value: '[REDACTED]',
      element: makeElement({
        tagName: 'INPUT',
        type: 'text',
        ariaLabel: 'Membership ID',
      }),
    });
    // Redacted values should not be shown in quotes
    expect(generateDescription(event)).toBe("Typed in text field 'Membership ID'");
  });
});

describe('generateDescription – change', () => {
  it('should describe select change', () => {
    const event = makeEvent({
      type: 'change',
      element: makeElement({
        tagName: 'SELECT',
        ariaLabel: 'Country',
      }),
      value: 'US',
    });
    expect(generateDescription(event)).toBe("Selected 'US' from 'Country'");
  });

  it('should describe checkbox check', () => {
    const event = makeEvent({
      type: 'change',
      element: makeElement({
        tagName: 'INPUT',
        type: 'checkbox',
        ariaLabel: 'Agree to terms',
        checked: true,
      }),
    });
    expect(generateDescription(event)).toBe("Checked 'Agree to terms'");
  });

  it('should describe checkbox uncheck', () => {
    const event = makeEvent({
      type: 'change',
      element: makeElement({
        tagName: 'INPUT',
        type: 'checkbox',
        ariaLabel: 'Subscribe',
        checked: false,
      }),
    });
    expect(generateDescription(event)).toBe("Unchecked 'Subscribe'");
  });

  it('should describe radio selection', () => {
    const event = makeEvent({
      type: 'change',
      element: makeElement({
        tagName: 'INPUT',
        type: 'radio',
        ariaLabel: 'Monthly plan',
      }),
    });
    expect(generateDescription(event)).toBe("Selected 'Monthly plan'");
  });
});

describe('generateDescription – keypress', () => {
  it('should describe key press', () => {
    const event = makeEvent({
      type: 'keypress',
      key: 'Enter',
      element: makeElement(),
    });
    expect(generateDescription(event)).toBe('Pressed Enter');
  });

  it('should handle modifier+key combos', () => {
    const event = makeEvent({
      type: 'keypress',
      key: 'Ctrl+S',
      element: makeElement(),
    });
    expect(generateDescription(event)).toBe('Pressed Ctrl+S');
  });
});

describe('generateDescription – navigation', () => {
  it('should describe navigation', () => {
    const event = makeEvent({
      type: 'navigation',
      url: 'https://example.com/dashboard',
      element: makeElement(),
    });
    expect(generateDescription(event)).toBe(
      'Navigated to https://example.com/dashboard',
    );
  });
});

describe('generateDescription – scroll', () => {
  it('should describe scroll', () => {
    const event = makeEvent({
      type: 'scroll',
      element: makeElement(),
    });
    expect(generateDescription(event)).toBe('Scrolled page');
  });
});
