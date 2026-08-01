import { defineConfig } from 'vite'

// 入口：sim.html 为唯一正式入口。
// 根路径 "/" 与 "/sim.html" 均直达驾驶场景（见 index.html redirect 与 build 多页配置）。
export default defineConfig({
  root: '.',
  server: {
    port: 8080,
    host: true,
    open: false
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    rollupOptions: {
      input: {
        sim: 'sim.html'
      }
    }
  },
  optimizeDeps: {
    include: ['three']
  }
})
