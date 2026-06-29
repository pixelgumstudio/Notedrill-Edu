import { safeParseJSON } from '../jsonParser';

describe('safeParseJSON', () => {
  it('parses valid JSON', () => {
    const input = '{ "title": "Test", "content": "Hello world" }';
    const result = safeParseJSON<{ title: string; content: string }>(input);
    expect(result.title).toBe('Test');
    expect(result.content).toBe('Hello world');
  });

  it('parses JSON with HTML content containing unescaped double quotes in text nodes', () => {
    const input = JSON.stringify({
      title: 'Biology Notes',
      content:
        '<h3>Overview</h3><p>The "cell" is the basic unit of life. The "cell" wall provides support.</p>',
    });
    const result = safeParseJSON<{ title: string; content: string }>(input);
    expect(result.title).toBe('Biology Notes');
    expect(result.content).toContain('The "cell" is the basic unit');
  });

  it('parses JSON with HTML attributes using double quotes', () => {
    const input = JSON.stringify({
      title: 'Test',
      content: '<p class="main" id="intro">Content here</p>',
    });
    const result = safeParseJSON<{ title: string; content: string }>(input);
    expect(result.content).toContain('<p');
  });

  it('handles JSON wrapped in markdown code fences', () => {
    const input = `\`\`\`json
{
  "title": "Test",
  "content": "Markdown wrapped"
}
\`\`\``;
    const result = safeParseJSON<{ title: string; content: string }>(input);
    expect(result.title).toBe('Test');
    expect(result.content).toBe('Markdown wrapped');
  });

  it('parses JSON with literal newlines in string values (via jsonrepair Layer 5)', () => {
    const malformedJSON = `{
  "title": "Multi-line",
  "content": "<h3>Section</h3>
<p>This has a literal newline in it.</p>"
}`;
    const result = safeParseJSON<{ title: string; content: string }>(malformedJSON);
    expect(result.title).toBe('Multi-line');
    expect(result.content).toContain('Section');
  });

  it('throws error when JSON is completely unparseable', () => {
    const input = 'not valid json at all {';
    expect(() => safeParseJSON(input)).toThrow('JSON parse failed after all repair attempts');
  });
});
