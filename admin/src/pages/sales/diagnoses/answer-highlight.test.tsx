import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import {
  diagnosisBrandHighlightTerms,
  HighlightedAnswer,
} from './answer-highlight';

describe('HighlightedAnswer', () => {
  it('highlights all target brand names without changing answer text', () => {
    const { container } = render(
      <HighlightedAnswer
        content="星河云适合企业客户，Xinghe Cloud 也出现在回答中。"
        terms={['星河云', 'Xinghe Cloud']}
      />,
    );

    expect(screen.getByText('星河云').tagName).toBe('MARK');
    expect(screen.getByText('Xinghe Cloud').tagName).toBe('MARK');
    expect(container.textContent).toBe(
      '星河云适合企业客户，Xinghe Cloud 也出现在回答中。',
    );
  });

  it('only uses target brand and alias preparation terms', () => {
    expect(
      diagnosisBrandHighlightTerms({
        profile: { brandName: '星河云', brandAliases: ['星河'] },
        brandTerms: [
          { term: 'Xinghe Cloud', termType: 2 },
          { term: '竞争品牌', termType: 5 },
        ],
      }),
    ).toEqual(['星河云', '星河', 'Xinghe Cloud']);
  });
});
