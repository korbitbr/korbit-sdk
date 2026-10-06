// Sincroniza o fixture de contrato com a spec pública do repo korbit-docs.
// Rodar depois de `node scripts/build-openapi.mjs --spec <spec> --out openapi/korbit-public-v1.json` na doc.
import { copyFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const docsSpec = new URL('../../../korbit-docs/openapi/korbit-public-v1.json', import.meta.url);
const fixture = new URL('../test/fixtures/korbit-public-v1.json', import.meta.url);
try {
  copyFileSync(fileURLToPath(docsSpec), fileURLToPath(fixture));
  console.log('fixture de contrato atualizada a partir de korbit-docs/openapi/korbit-public-v1.json');
} catch (error) {
  console.error('Não encontrou ../korbit-docs — passe o caminho da spec: node scripts/sync-spec.mjs <caminho>');
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
}
