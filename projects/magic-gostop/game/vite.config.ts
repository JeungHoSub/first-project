import { defineConfig } from 'vitest/config';

// 2단계(화면)에서 Vite 개발 서버/번들에 쓴다. 1단계는 vitest 설정만 사용.
export default defineConfig({
  test: { include: ['tests/**/*.test.ts'] },
});
