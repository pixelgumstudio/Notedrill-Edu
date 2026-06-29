/**
 * Convert HTML to plain text, removing all tags and entities
 * Preserves line breaks from paragraph/heading tags
 */
export function htmlToPlainText(html: string): string {
  if (!html) return '';

  let text = html;

  // Replace block-level elements with newlines
  text = text.replace(/<\/?(p|div|h[1-6]|blockquote|li|ul|ol|br|hr)[\s\S]*?>/gi, '\n');

  // Remove other HTML tags
  text = text.replace(/<[^>]+>/g, '');

  // Decode HTML entities
  text = decodeHTMLEntities(text);

  // Clean up multiple newlines (replace 3+ with 2)
  text = text.replace(/\n{3,}/g, '\n\n');

  // Trim leading/trailing whitespace
  text = text.trim();

  return text;
}

/**
 * Decode common HTML entities
 */
function decodeHTMLEntities(text: string): string {
  const entityMap: Record<string, string> = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&#39;': "'",
    '&nbsp;': ' ',
  };

  return text.replace(/&[a-z]+;/gi, (match) => entityMap[match] || match);
}
