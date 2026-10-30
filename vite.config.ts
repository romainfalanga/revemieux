import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import build from '@hono/vite-build/cloudflare-pages'
import devServer from '@hono/vite-dev-server'
import adapter from '@hono/vite-dev-server/cloudflare'
import { defineConfig } from 'vite'

export default defineConfig({
  define: {
    __ASSET_VERSION__: JSON.stringify(createHash('sha256')
      .update(['public/static/app.js', 'public/static/emotions.js', 'public/static/style.css', 'public/static/tailwind.css', 'public/static/chart.umd.js']
        .map(path => readFileSync(path)).reduce((all, part) => Buffer.concat([all, part]), Buffer.alloc(0)))
      .digest('hex').slice(0, 12))
  },
  plugins: [
    build(),
    devServer({
      adapter,
      entry: 'src/index.tsx'
    })
  ]
})
