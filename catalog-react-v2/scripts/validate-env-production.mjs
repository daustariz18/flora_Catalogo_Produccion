import { readFile } from 'node:fs/promises'

const EXPECTED_BASE = 'https://catalogo-web-708265049038.us-central1.run.app/'
const FORBIDDEN_BASE = 'https://api.joindata.com.co'

async function main() {
  const envUrl = new URL('../.env.production', import.meta.url)
  const content = await readFile(envUrl, 'utf8')

  if (!content.includes(`VITE_API_URL=${EXPECTED_BASE}`)) {
    throw new Error('VITE_API_URL debe apuntar al backend real de Petalops.')
  }

  if (!content.includes(`VITE_API_BASE_URL=${EXPECTED_BASE}`)) {
    throw new Error('VITE_API_BASE_URL debe coincidir con el backend real de Petalops.')
  }

  if (content.includes(FORBIDDEN_BASE)) {
    throw new Error('La referencia al backend placeholder no puede permanecer en .env.production.')
  }

  console.log('.env.production validado correctamente.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error))
  process.exitCode = 1
})
