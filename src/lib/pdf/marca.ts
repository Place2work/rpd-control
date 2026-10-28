// Datos fijos de la marca para documentos generados (11.4).
import "server-only";
import path from "node:path";
import { Font } from "@react-pdf/renderer";

const dir = path.join(process.cwd(), "src/lib/pdf/fuentes");
let registradas = false;

export function registrarFuentes() {
  if (registradas) return;
  Font.register({ family: "Poppins", fonts: [
    { src: path.join(dir, "poppins-latin-500-normal.woff"), fontWeight: 500 },
    { src: path.join(dir, "poppins-latin-600-normal.woff"), fontWeight: 600 },
  ] });
  Font.register({ family: "Inter", fonts: [
    { src: path.join(dir, "inter-latin-400-normal.woff"), fontWeight: 400 },
    { src: path.join(dir, "inter-latin-500-normal.woff"), fontWeight: 500 },
    { src: path.join(dir, "inter-latin-600-normal.woff"), fontWeight: 600 },
  ] });
  Font.registerHyphenationCallback((palabra) => [palabra]); // sin guiones a media palabra
  registradas = true;
}

// Logo recortado y con fondo blanco limpio (el JPG trae un recuadro gris por compresión).
export const LOGO = path.join(process.cwd(), "src/lib/pdf/logo-pdf.png");

export const COLOR = { azul: "#004AAD", azulTenue: "#E8F0FB", verde: "#3F7A24", verdeTenue: "#EEF6E9", tinta: "#0F172A", gris: "#64748B", borde: "#E2E8F0", rojo: "#B91C1C", ambar: "#B45309" };

export const PIE = [
  "Blvd. Gustavo Díaz Ordaz No. 49, Interior D-3, Col. Acapantzingo, C.P. 62440, Cuernavaca, Mor.",
  "800 611 1245 · WhatsApp 56 6474 9567 · hola@retiropordesempleo.com · www.retiropordesempleo.com",
  "Horario: lunes a viernes 9:00-18:00, sábado 9:00-14:00",
];
