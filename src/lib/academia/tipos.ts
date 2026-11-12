// Tipos del contenido de la Academia (docs/CAPACITACION.md). Se usan en el servidor y en el navegador
// (el navegador nunca recibe `correcta`, `tolerancia` ni `explicacion` antes de calificar).
export type ClaveRuta = "N0" | "R1" | "R2" | "P1" | "P2";
export type ClaveAcuse = "codigo_conducta" | "privacidad_interna";

export type Ruta = {
  clave: ClaveRuta; nombre: string; orden: number; prerrequisitos: ClaveRuta[]; vigencia_meses: number | null;
  requisitos: {
    examen: { minimo: number; n: number };
    acuses?: ClaveAcuse[]; casos?: number; roleplays?: string[]; shadowing?: number; diagnosticos?: number; entrevista?: boolean;
  };
  permisos_habilita: string[];
};

export type Modulo = {
  clave: string; ruta: ClaveRuta; titulo: string; orden: number; duracion_min: number; version: number;
  parametros: string[]; fuentes: string[]; contenido: string;
};

export type Pregunta = {
  clave: string; modulo: string; critica: boolean; tipo: "opcion_multiple" | "numerica";
  enunciado: string; opciones: string[]; correcta: number; tolerancia: number | null;
  explicacion: string | null; parametros: string[]; version: number;
};

export type Acuse = { clave: ClaveAcuse; titulo: string; version: string; texto: string };

/** Lo que el navegador ve de una pregunta durante una evaluación. */
export type PreguntaServida = { clave: string; tipo: Pregunta["tipo"]; enunciado: string; opciones: string[]; critica: boolean };

/** Reglas de intentos (sección 9.3), en content/academia/evaluacion.json. */
export type ReglaIntentos = { n: number; minimo?: number; intentos_max: number | null; espera_horas: number; bloqueo_dias: number };
export type ReglasEvaluacion = { quiz_modulo: ReglaIntentos; examen_ruta: ReglaIntentos };
