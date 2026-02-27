<?xml version="1.0" encoding="UTF-8"?>
<xsl:stylesheet version="2.0"
  xmlns:xsl="http://www.w3.org/1999/XSL/Transform"
  xmlns:sitemap="http://www.sitemaps.org/schemas/sitemap/0.9">
  <xsl:output method="html" encoding="UTF-8" indent="yes"/>
  <xsl:template match="/">
    <html lang="en">
      <head>
        <meta charset="UTF-8"/>
        <meta name="viewport" content="width=device-width, initial-scale=1.0"/>
        <title>Sitemap — ScentWise</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: #0f0f0f;
            color: #e0e0e0;
            padding: 2rem;
            line-height: 1.6;
          }
          .container { max-width: 960px; margin: 0 auto; }
          h1 {
            font-size: 1.5rem;
            font-weight: 600;
            margin-bottom: 0.25rem;
            color: #fff;
          }
          .subtitle {
            color: #888;
            font-size: 0.9rem;
            margin-bottom: 1.5rem;
          }
          .count {
            background: #1a1a2e;
            border: 1px solid #2a2a4a;
            border-radius: 8px;
            padding: 0.75rem 1rem;
            margin-bottom: 1.5rem;
            font-size: 0.85rem;
            color: #aaa;
          }
          .count strong { color: #c9a0dc; }
          table {
            width: 100%;
            border-collapse: collapse;
            font-size: 0.85rem;
          }
          thead th {
            text-align: left;
            padding: 0.6rem 0.75rem;
            border-bottom: 2px solid #2a2a4a;
            color: #888;
            font-weight: 500;
            font-size: 0.75rem;
            text-transform: uppercase;
            letter-spacing: 0.05em;
          }
          tbody tr { border-bottom: 1px solid #1a1a2e; }
          tbody tr:hover { background: #1a1a2e; }
          tbody td { padding: 0.5rem 0.75rem; }
          a {
            color: #c9a0dc;
            text-decoration: none;
            word-break: break-all;
          }
          a:hover { text-decoration: underline; }
          .priority {
            display: inline-block;
            padding: 0.15rem 0.5rem;
            border-radius: 4px;
            font-size: 0.75rem;
            font-weight: 600;
          }
          .priority-high { background: #1a2e1a; color: #6fcf6f; }
          .priority-med { background: #2e2e1a; color: #cfcf6f; }
          .priority-low { background: #1a1a2e; color: #8888aa; }
          .date { color: #888; }
          .freq { color: #666; text-transform: capitalize; }
        </style>
      </head>
      <body>
        <div class="container">
          <h1>ScentWise Sitemap</h1>
          <p class="subtitle">This is the XML sitemap for <a href="https://scent-wise.com">scent-wise.com</a>, used by search engines to discover pages.</p>
          <div class="count">
            <strong><xsl:value-of select="count(sitemap:urlset/sitemap:url)"/></strong> URLs in this sitemap
          </div>
          <table>
            <thead>
              <tr>
                <th>URL</th>
                <th>Priority</th>
                <th>Change Freq</th>
                <th>Last Modified</th>
              </tr>
            </thead>
            <tbody>
              <xsl:for-each select="sitemap:urlset/sitemap:url">
                <xsl:sort select="sitemap:priority" order="descending" data-type="number"/>
                <tr>
                  <td>
                    <a href="{sitemap:loc}"><xsl:value-of select="sitemap:loc"/></a>
                  </td>
                  <td>
                    <xsl:choose>
                      <xsl:when test="sitemap:priority &gt;= 0.8">
                        <span class="priority priority-high"><xsl:value-of select="sitemap:priority"/></span>
                      </xsl:when>
                      <xsl:when test="sitemap:priority &gt;= 0.5">
                        <span class="priority priority-med"><xsl:value-of select="sitemap:priority"/></span>
                      </xsl:when>
                      <xsl:otherwise>
                        <span class="priority priority-low"><xsl:value-of select="sitemap:priority"/></span>
                      </xsl:otherwise>
                    </xsl:choose>
                  </td>
                  <td class="freq"><xsl:value-of select="sitemap:changefreq"/></td>
                  <td class="date"><xsl:value-of select="sitemap:lastmod"/></td>
                </tr>
              </xsl:for-each>
            </tbody>
          </table>
        </div>
      </body>
    </html>
  </xsl:template>
</xsl:stylesheet>
