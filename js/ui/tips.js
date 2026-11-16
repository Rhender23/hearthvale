// Tooltips stay short: a name and one plain line. The full story lives in the glossary and the Details sheet.
const MAX = 90;
export function oneLine(text) {
  if (!text) return '';
  const t = String(text).trim(), m = t.match(/^.*?[.!?](?=\s|$)/), first = m ? m[0] : t;
  if (first.length <= MAX) return first;
  const cut = first.slice(0, MAX), sp = cut.lastIndexOf(' ');
  return cut.slice(0, sp > 40 ? sp : MAX).replace(/[,;:]$/, '') + '…';
}
