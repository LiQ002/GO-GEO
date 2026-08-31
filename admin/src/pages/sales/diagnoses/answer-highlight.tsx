import { Fragment } from 'react';

type HighlightedAnswerProps = {
  content?: string;
  terms: string[];
};

export function HighlightedAnswer({
  content = '',
  terms,
}: HighlightedAnswerProps) {
  const normalizedTerms = [
    ...new Set(terms.map((item) => item.trim()).filter(Boolean)),
  ].sort((left, right) => right.length - left.length);
  if (!content || normalizedTerms.length === 0) return <>{content}</>;

  const lowerContent = content.toLocaleLowerCase();
  const lowerTerms = normalizedTerms.map((term) => term.toLocaleLowerCase());
  const parts: Array<{ content: string; highlighted: boolean; start: number }> =
    [];
  let cursor = 0;
  while (cursor < content.length) {
    let nextIndex = -1;
    let matchedLength = 0;
    for (const term of lowerTerms) {
      const index = lowerContent.indexOf(term, cursor);
      if (index < 0 || (nextIndex >= 0 && index > nextIndex)) continue;
      if (index === nextIndex && term.length <= matchedLength) continue;
      nextIndex = index;
      matchedLength = term.length;
    }
    if (nextIndex < 0) {
      parts.push({
        content: content.slice(cursor),
        highlighted: false,
        start: cursor,
      });
      break;
    }
    if (nextIndex > cursor) {
      parts.push({
        content: content.slice(cursor, nextIndex),
        highlighted: false,
        start: cursor,
      });
    }
    parts.push({
      content: content.slice(nextIndex, nextIndex + matchedLength),
      highlighted: true,
      start: nextIndex,
    });
    cursor = nextIndex + matchedLength;
  }

  return (
    <>
      {parts.map((part) => (
        <Fragment key={part.start}>
          {part.highlighted ? <mark>{part.content}</mark> : part.content}
        </Fragment>
      ))}
    </>
  );
}

export function diagnosisBrandHighlightTerms(diagnosis?: API.SalesDiagnosis) {
  return [
    diagnosis?.profile?.brandName,
    ...(diagnosis?.profile?.brandAliases ?? []),
    ...(diagnosis?.brandTerms ?? [])
      .filter((item) => item.termType === 1 || item.termType === 2)
      .map((item) => item.term),
  ].filter((item): item is string => Boolean(item?.trim()));
}
