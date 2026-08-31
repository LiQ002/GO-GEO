import { marked } from "marked";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  headingStyle: "atx",
  strongDelimiter: "**",
});

turndown.use(gfm);

export function markdownToArticleHTML(markdown: string): string {
  if (!markdown.trim()) return "<p></p>";
  return marked.parse(markdown, {
    async: false,
    breaks: true,
    gfm: true,
  });
}

export function articleHTMLToMarkdown(html: string): string {
  if (!html.trim()) return "";
  return turndown.turndown(html).trim();
}
