import assert from "node:assert/strict";
import test from "node:test";
import {
  articleHTMLToMarkdown,
  markdownToArticleHTML,
} from "../src/lib/article-content.ts";

test("generated Markdown can initialize the rich text editor", () => {
  const html = markdownToArticleHTML(
    "# 标题\n\n正文包含 **重点** 和 [链接](https://example.com)。",
  );

  assert.match(html, /<h1>标题<\/h1>/);
  assert.match(html, /<strong>重点<\/strong>/);
  assert.match(html, /href="https:\/\/example.com"/);
});

test("rich text HTML keeps a Markdown compatibility copy", () => {
  const markdown = articleHTMLToMarkdown(`
    <h2>渠道标题</h2>
    <p>正文包含 <strong>重点</strong> 和 <del>旧内容</del>。</p>
    <table>
      <thead><tr><th>平台</th><th>状态</th></tr></thead>
      <tbody><tr><td>示例平台</td><td>可投放</td></tr></tbody>
    </table>
  `);

  assert.match(markdown, /^## 渠道标题/m);
  assert.match(markdown, /\*\*重点\*\*/);
  assert.match(markdown, /~{1,2}旧内容~{1,2}/);
  assert.match(markdown, /\| 平台 \| 状态 \|/);
});
