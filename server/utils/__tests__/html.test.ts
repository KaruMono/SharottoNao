import { describe, it, expect } from 'vitest'
import { sanitizeHtml, stripHtml } from '../html'

describe('HTML Sanitization', () => {
  describe('sanitizeHtml', () => {
    it('should preserve empty paragraphs (line breaks)', () => {
      const html = '<p>第一段</p><p></p><p>第三段</p>'
      const result = sanitizeHtml(html)
      expect(result).toContain('<p></p>')
      expect(result).toContain('第一段')
      expect(result).toContain('第三段')
    })

    it('should preserve multiple empty paragraphs', () => {
      const html = '<p>内容</p><p></p><p></p><p></p><p>更多内容</p>'
      const result = sanitizeHtml(html)
      // 应该保留所有空段落
      const emptyPCount = (result.match(/<p><\/p>/g) || []).length
      expect(emptyPCount).toBeGreaterThanOrEqual(3)
    })

    it('should preserve br tags', () => {
      const html = '<p>第一行<br>第二行</p>'
      const result = sanitizeHtml(html)
      expect(result).toContain('<br')
    })

    it('should preserve whitespace in pre tags', () => {
      const html = '<pre>line 1\nline 2\nline 3</pre>'
      const result = sanitizeHtml(html)
      expect(result).toContain('\n')
    })

    it('should remove dangerous tags', () => {
      const html = '<p>Safe</p><script>alert("xss")</script><p>Content</p>'
      const result = sanitizeHtml(html)
      expect(result).not.toContain('<script')
      expect(result).toContain('Safe')
      expect(result).toContain('Content')
    })

    it('should add noopener noreferrer to external links', () => {
      const html = '<a href="https://example.com">Link</a>'
      const result = sanitizeHtml(html)
      expect(result).toContain('rel="noopener noreferrer"')
      expect(result).toContain('target="_blank"')
    })

    it('should not modify internal links', () => {
      const html = '<a href="/games/1">Internal</a>'
      const result = sanitizeHtml(html)
      expect(result).not.toContain('target="_blank"')
    })
  })

  describe('stripHtml', () => {
    it('should remove all HTML tags', () => {
      const html = '<p>Hello <strong>World</strong></p>'
      const result = stripHtml(html)
      expect(result).toBe('Hello World')
    })

    it('should handle empty paragraphs', () => {
      const html = '<p>Text</p><p></p><p>More</p>'
      const result = stripHtml(html)
      expect(result).toContain('Text')
      expect(result).toContain('More')
    })
  })
})
