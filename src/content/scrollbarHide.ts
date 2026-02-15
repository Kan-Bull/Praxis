const STYLE_ID = '__praxis-scrollbar-hide';

const SCROLLBAR_HIDE_CSS =
  'html::-webkit-scrollbar{display:none!important}' +
  'html{scrollbar-width:none!important}';

/** Inject a style element that hides browser scrollbars for screenshot capture. */
export function hideScrollbars(): void {
  if (document.getElementById(STYLE_ID)) return;
  const style = document.createElement('style');
  style.id = STYLE_ID;
  style.textContent = SCROLLBAR_HIDE_CSS;
  (document.head ?? document.documentElement).appendChild(style);
}

/** Remove the injected scrollbar-hiding style. */
export function showScrollbars(): void {
  document.getElementById(STYLE_ID)?.remove();
}
