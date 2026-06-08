// Email block model + HTML compiler. The campaign builder edits a list of
// blocks; on save it compiles them to email-safe inline-styled `body_html`
// (the field the Node sender actually delivers) and appends the design as an
// HTML comment so the builder can round-trip when editing a draft again.

const MARKER = 'LYDIA_BLOCKS:';

export const blockDefaults = (type) => {
  switch (type) {
    case 'heading': return { type, text: 'Your headline' };
    case 'text': return { type, text: 'Write your message here. You can use {{contact.name}}.' };
    case 'button': return { type, label: 'Visit website', url: 'https://' };
    case 'image': return { type, url: '', alt: '' };
    case 'divider': return { type };
    default: return { type: 'text', text: '' };
  }
};

const esc = (s) =>
  String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function blockHtml(b) {
  switch (b.type) {
    case 'heading':
      return `<h2 style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:22px;color:#111827;">${esc(b.text)}</h2>`;
    case 'text':
      return `<p style="margin:0 0 16px;font-family:Arial,sans-serif;font-size:15px;line-height:1.6;color:#374151;">${esc(b.text).replace(/\n/g, '<br>')}</p>`;
    case 'button':
      return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 16px;"><tr><td style="border-radius:6px;background:#2563eb;"><a href="${esc(b.url)}" style="display:inline-block;padding:10px 20px;font-family:Arial,sans-serif;font-size:15px;color:#ffffff;text-decoration:none;">${esc(b.label)}</a></td></tr></table>`;
    case 'image':
      return b.url ? `<img src="${esc(b.url)}" alt="${esc(b.alt)}" style="max-width:100%;border-radius:6px;margin:0 0 16px;display:block;" />` : '';
    case 'divider':
      return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:0 0 16px;" />`;
    default:
      return '';
  }
}

// compileEmail renders blocks to a full HTML body and embeds the design JSON.
export function compileEmail(blocks) {
  const inner = blocks.map(blockHtml).join('\n');
  const body = `<div style="max-width:600px;margin:0 auto;padding:24px;">\n${inner}\n</div>`;
  const design = `<!--${MARKER}${btoa(unescape(encodeURIComponent(JSON.stringify(blocks))))}-->`;
  return `${body}\n${design}`;
}

// parseBlocks recovers the design from a previously-compiled body_html. Returns
// null when the campaign wasn't built with the block editor.
export function parseBlocks(bodyHtml) {
  if (!bodyHtml) return null;
  const m = bodyHtml.match(new RegExp(`<!--${MARKER}([^>]*)-->`));
  if (!m) return null;
  try {
    return JSON.parse(decodeURIComponent(escape(atob(m[1]))));
  } catch {
    return null;
  }
}
