// Run npm ci --ignore-scripts --omit=optional in this directory first.
import {copyFileSync} from 'node:fs';
for(const [source,target] of [['legacy/build/pdf.min.mjs','pdf.mjs'],['legacy/build/pdf.worker.min.mjs','pdf.worker.mjs']]) {
  copyFileSync(new URL('./node_modules/pdfjs-dist/'+source,import.meta.url),new URL('../../functions/_lib/my-chat-ui/'+target,import.meta.url));
}
copyFileSync(new URL('./node_modules/pdfjs-dist/LICENSE',import.meta.url),new URL('./PDFJS-LICENSE',import.meta.url));
