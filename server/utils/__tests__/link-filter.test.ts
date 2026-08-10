import { describe, it, expect } from 'vitest'
import {
  hasLinks,
  hasNonWhitelistedLinks,
  filterLinks,
  getNonWhitelistedLinks,
} from '../link-filter'

describe('Link Filter', () => {
  describe('hasLinks', () => {
    it('should detect links in HTML', () => {
      const html = '<p>Check out <a href="https://example.com">this link</a></p>'
      expect(hasLinks(html)).toBe(true)
    })

    it('should return false for content without links', () => {
      const html = '<p>Just plain text</p>'
      expect(hasLinks(html)).toBe(false)
    })
  })

  describe('hasNonWhitelistedLinks', () => {
    it('should detect non-whitelisted links', () => {
      const html = '<p>Visit <a href="https://malicious-site.com">here</a></p>'
      expect(hasNonWhitelistedLinks(html)).toBe(true)
    })

    it('should return false for whitelisted links', () => {
      const html = '<p>Visit <a href="https://vndb.org/v123">VNDB</a></p>'
      expect(hasNonWhitelistedLinks(html)).toBe(false)
    })

    it('should return false for site own links', () => {
      const html = '<p>Visit <a href="https://www.sharotto.com/games/1">game</a></p>'
      expect(hasNonWhitelistedLinks(html)).toBe(false)
    })
  })

  describe('filterLinks', () => {
    it('should remove non-whitelisted links but keep text', () => {
      const html = '<p>Visit <a href="https://bad-site.com">this site</a> for more</p>'
      const filtered = filterLinks(html, 'whitelist')
      expect(filtered).toBe('<p>Visit this site for more</p>')
    })

    it('should keep whitelisted links', () => {
      const html = '<p>Check <a href="https://vndb.org/v123">VNDB</a></p>'
      const filtered = filterLinks(html, 'whitelist')
      expect(filtered).toContain('href="https://vndb.org/v123"')
    })

    it('should remove all links in remove-all mode', () => {
      const html = '<p>Visit <a href="https://vndb.org/v123">VNDB</a></p>'
      const filtered = filterLinks(html, 'remove-all')
      expect(filtered).toBe('<p>Visit VNDB</p>')
    })

    it('should handle multiple links', () => {
      const html = `
        <p>
          Visit <a href="https://vndb.org">VNDB</a> and 
          <a href="https://bad-site.com">bad site</a>
        </p>
      `
      const filtered = filterLinks(html, 'whitelist')
      expect(filtered).toContain('href="https://vndb.org"')
      expect(filtered).not.toContain('href="https://bad-site.com"')
      expect(filtered).toContain('bad site')
    })
  })

  describe('getNonWhitelistedLinks', () => {
    it('should return list of non-whitelisted links', () => {
      const html = `
        <p>
          <a href="https://vndb.org">VNDB</a>
          <a href="https://bad1.com">Bad 1</a>
          <a href="https://bad2.com">Bad 2</a>
        </p>
      `
      const links = getNonWhitelistedLinks(html)
      expect(links).toHaveLength(2)
      expect(links).toContain('https://bad1.com')
      expect(links).toContain('https://bad2.com')
      expect(links).not.toContain('https://vndb.org')
    })
  })

  describe('Subdomain matching', () => {
    it('should match subdomains of whitelisted domains', () => {
      const html = '<a href="https://api.vndb.org/v1">API</a>'
      expect(hasNonWhitelistedLinks(html)).toBe(false)
    })

    it('should be case insensitive', () => {
      const html = '<a href="https://VNDB.ORG/v123">VNDB</a>'
      expect(hasNonWhitelistedLinks(html)).toBe(false)
    })
  })
})
