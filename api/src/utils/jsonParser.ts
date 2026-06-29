import { jsonrepair } from 'jsonrepair';

export function safeParseJSON<T>(rawString: string): T {
  let cleanStr = rawString.trim();

  // Layer 1: Strip markdown code fences
  cleanStr = cleanStr.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();

  // Layer 2: Extract outermost JSON object or array
  const jsonMatch = cleanStr.match(/(\{[\s\S]*\}|\[[\s\S]*\])/);
  if (jsonMatch) {
    cleanStr = jsonMatch[1].trim();
  }

  // Layer 3: Direct parse
  try {
    return JSON.parse(cleanStr) as T;
  } catch (_) {}

  // Layer 4: Fix unescaped double quotes inside HTML attribute values.
  // Converts attr="val" → attr='val' inside any HTML tag, which is the
  // most common cause of JSON.parse failures when AI embeds HTML in string values.
  const fixedHtmlAttrs = cleanStr.replace(
    /<[a-zA-Z][^<>]*>/g,
    (tag) => tag.replace(/([\s][\w:.-]+)="([^"]*)"/g, "$1='$2'")
  );
  try {
    return JSON.parse(fixedHtmlAttrs) as T;
  } catch (_) {}

  // Layer 5: Use jsonrepair as final fallback.
  // Handles unescaped quotes in text nodes, literal newlines, trailing commas, etc.
  try {
    const repaired = jsonrepair(cleanStr);
    return JSON.parse(repaired) as T;
  } catch (_) {}

  throw new Error(
    `JSON parse failed after all repair attempts. Raw (first 300 chars): ${rawString.substring(0, 300)}`
  );
}
