import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it } from 'vitest';
import { RichText } from './RichText';

const html = (text: string) => renderToStaticMarkup(createElement(RichText, { text }));

describe('RichText', () => {
  it('turns headings into h3 and below, since the page already has an h1', () => {
    expect(html('## Cover')).toContain('<h3 class="rich-heading">Cover</h3>');
    expect(html('#### Half Cover')).toContain('<h5 class="rich-heading">Half Cover</h5>');
  });

  it('renders bold, italic spell names and _italic_', () => {
    const out = html('Cast **fireball** or *magic missile*, then _rest_.');
    expect(out).toContain('<strong>fireball</strong>');
    expect(out).toContain('<em>magic missile</em>');
    expect(out).toContain('<em>rest</em>');
  });

  it('keeps one list when there are blank lines between items', () => {
    const out = html('- one\n\n- two\n\nAfter');
    expect(out.match(/<ul>/g)).toHaveLength(1);
    expect(out).toContain('<li>two</li>');
    expect(out).toContain('<p>After</p>');
  });

  it('renders numbered lists', () => {
    expect(html('1. Roll\n2. Add')).toContain('<ol><li>Roll</li><li>Add</li></ol>');
  });

  it('renders pipe tables with a header row', () => {
    const out = html('| d6 | Trait |\n|---|---|\n| 1 | Brave |');
    expect(out).toContain('<th>Trait</th>');
    expect(out).toContain('<td>Brave</td>');
  });

  it('leaves text with a lone asterisk alone', () => {
    expect(html('2 * 3')).toBe('<div class="rich"><p>2 * 3</p></div>');
  });
});
