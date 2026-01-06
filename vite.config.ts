import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  // เปลี่ยน 'travel-claim' เป็นชื่อ Repository ของนายใน GitHub เป๊ะๆ
  base: '/travel-claim/', 
})