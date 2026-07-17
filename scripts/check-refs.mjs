// Static undeclared-reference checker. Parses a JSX file and reports any
// identifier that is referenced but neither declared locally nor imported nor
// a known global. Catches the missing-import class of bug (e.g. GOAL_TYPES)
// that a passing `vite build` does NOT — those are runtime ReferenceErrors.
// Usage: node scripts/check-refs.mjs src/features/Feed.jsx [...more files]
import { readFileSync } from 'node:fs'
import { parse } from '@babel/parser'
import _traverse from '@babel/traverse'
const traverse = _traverse.default || _traverse

const GLOBALS = new Set([
  'console','window','document','localStorage','sessionStorage','navigator','location','fetch',
  'setTimeout','clearTimeout','setInterval','clearInterval','requestAnimationFrame','cancelAnimationFrame',
  'Math','JSON','Object','Array','String','Number','Boolean','Date','Promise','Map','Set','Symbol',
  'RegExp','Error','parseInt','parseFloat','isNaN','isFinite','encodeURIComponent','decodeURIComponent',
  'Intl','structuredClone','URL','Blob','FileReader','FormData','Image','Audio','crypto','atob','btoa',
  'undefined','null','NaN','Infinity','globalThis','React','requestIdleCallback',
  'indexedDB','IDBKeyRange','MediaRecorder','WebSocket','alert','confirm','prompt','getComputedStyle',
])

let bad = 0
for (const file of process.argv.slice(2)) {
  const code = readFileSync(file, 'utf8')
  const ast = parse(code, { sourceType: 'module', plugins: ['jsx'] })
  const unresolved = new Map()
  traverse(ast, {
    ReferencedIdentifier(path) {
      const name = path.node.name
      if (GLOBALS.has(name)) return
      if (path.scope.hasBinding(name)) return
      // JSX member roots and object keys are handled by babel scope already.
      if (!unresolved.has(name)) unresolved.set(name, path.node.loc?.start.line)
    },
  })
  if (unresolved.size) {
    bad++
    console.log(`\n✗ ${file} — undeclared references:`)
    for (const [name, line] of unresolved) console.log(`    ${name} (first used L${line})`)
  } else {
    console.log(`✓ ${file} — all references resolved`)
  }
}
process.exit(bad ? 1 : 0)
