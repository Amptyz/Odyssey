import { defineConfig } from 'vitest/config';

export default defineConfig({
  // A fresh clone has no Creator-generated temp/tsconfig.cocos.json yet.
  // Supply a complete string so Vite does not resolve the editor's tsconfig.
  esbuild: {
    tsconfigRaw: JSON.stringify({ compilerOptions: { target:'ES2020', useDefineForClassFields:true } }),
  },
  test: { include:['tests/**/*.test.ts'] },
});
