import { readFileSync } from 'fs'
import { tokenize } from './packages/core/src/tokenizer/index.js'
import { parse } from './packages/core/src/parser/index.js'
import { transform } from './packages/core/src/transformer/index.js'

const source = readFileSync('/tmp/paper.tex', 'utf8')
console.log(`\n📄 Testing arXiv paper with ${source.length} characters of LaTeX...`)

try {
  console.log('\n1️⃣  Starting tokenization...')
  const tokens = tokenize(source)
  console.log(`✅ Tokenization successful: ${tokens.length} tokens`)

  console.log('\n2️⃣  Starting parsing...')
  const ast = parse(tokens)
  const parseErrors = ast.errors?.filter((e: any) => e) || []
  console.log(`✅ Parsing successful: ${parseErrors.length} parse errors`)
  if (parseErrors.length > 0) {
    parseErrors.slice(0, 5).forEach((err: any) => {
      console.log(`   ⚠️  ${err.message}`)
    })
  }

  console.log('\n3️⃣  Starting transformation...')
  const tree = transform(ast)
  console.log(`✅ Transformation successful: ${tree.length} root nodes`)

  console.log('\n📊 === SUMMARY ===')
  console.log(`Source size: ${(source.length / 1024).toFixed(2)} KB`)
  console.log(`Tokens: ${tokens.length}`)
  console.log(`Parse errors: ${parseErrors.length}`)
  console.log(`✅ All stages completed successfully!`)
} catch (err: any) {
  console.error('\n❌ ERROR:', err.message)
  console.error(err.stack?.split('\n').slice(0, 10).join('\n'))
}
