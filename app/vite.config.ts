import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'
import { fileURLToPath, URL } from 'node:url'

export default defineConfig({
  plugins: [vue()],
  base: './',
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) }
  },
  server: { port: 5178, host: '127.0.0.1', strictPort: true },
  build: { outDir: 'dist', chunkSizeWarningLimit: 2000 },
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'html'],
      reportsDirectory: './coverage',
      // 不清理旧目录直接覆盖写入：CI 每次是干净 runner，本地重复跑也无残留问题；
      // 同时规避某些受管环境对 fs.rm/trash 的拦截（clean=true 会触发删除失败）。
      clean: false,
      // 覆盖率口径：domain 纯函数 + store 编排层（业务规则与状态流转的核心）
      // views/.vue 依赖真实 DOM，六门禁由 smoke/e2e 覆盖，不在此处重复统计
      include: ['src/domain/**/*.ts', 'src/store/**/*.ts'],
      exclude: ['src/**/*.d.ts', 'src/**/*.spec.ts'],
      // 阈值在实测基线上设定（见 docs/CI-PIPELINE.md），防覆盖率回归
      thresholds: {
        lines: 84,
        functions: 84,
        branches: 80,
        statements: 84
      }
    }
  }
})
