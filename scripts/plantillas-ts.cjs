// Genera src/lib/contratos/plantillas-iniciales.ts desde prisma/plantillas/*.md.
// Uso: node scripts/plantillas-ts.cjs   (una prueba verifica que estén sincronizados)
const fs = require('node:fs');
const path = require('node:path');
const PLANTILLAS = [
  ['contrato-retiro.md', 'contrato', 'RETIRO_DESEMPLEO', 'Contrato de retiro parcial por desempleo'],
  ['contrato-fallecimiento.md', 'contrato', 'FALLECIMIENTO', 'Contrato de pensión por fallecimiento (viudez)'],
  ['aviso-fallecimiento.md', 'aviso_privacidad', 'FALLECIMIENTO', 'Aviso de privacidad integral (pensión por fallecimiento)'],
];
const filas = PLANTILLAS.map(([archivo, clase, servicio, nombre]) => {
  const cuerpo = fs.readFileSync(path.join(__dirname, '..', 'prisma', 'plantillas', archivo), 'utf8');
  return `  { archivo: ${JSON.stringify(archivo)}, clase: ${JSON.stringify(clase)}, tipoServicio: ${JSON.stringify(servicio)}, nombre: ${JSON.stringify(nombre)},\n    cuerpo: ${JSON.stringify(cuerpo)} },`;
});
fs.writeFileSync(path.join(__dirname, '..', 'src', 'lib', 'contratos', 'plantillas-iniciales.ts'),
`// GENERADO por scripts/plantillas-ts.cjs desde prisma/plantillas/*.md. No editar a mano.
// Versión 1 de cada plantilla: se carga a la base la primera vez que se necesita.
export const PLANTILLAS_INICIALES = [
${filas.join('\n')}
] as const;
`);
console.log('ok');
