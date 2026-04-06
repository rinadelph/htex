/// <reference types="vite/client" />
// Allow importing .tex files as raw strings
declare module '*.tex?raw' {
  const content: string
  export default content
}
