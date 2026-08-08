/// <reference types="vite/client" />

// JOS test support: the integration tests read source files during Vitest runs.
// Keep this declaration in vite-env.d.ts because this file is always included
// by the application TypeScript project when the src folder is replaced.
declare module 'node:fs' {
  export function readFileSync(path: URL | string, encoding: 'utf8'): string
}
