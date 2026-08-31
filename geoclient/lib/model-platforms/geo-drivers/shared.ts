/**
 * 模板字符串辅助函数：将多行选择器字符串拆分为 SelectorChain（string[]）。
 * 每行 trim 后过滤空行，保持顺序。
 *
 * 用法：
 *   const sel = CHAIN`
 *     textarea#input
 *     textarea[placeholder*="输入"]
 *   `
 *   // → ['textarea#input', 'textarea[placeholder*="输入"]']
 */
export const CHAIN = (strings: TemplateStringsArray): string[] =>
  strings[0]
    .split('\n')
    .map((s) => s.trim())
    .filter(Boolean)
