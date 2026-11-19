"use client";

// Oficina 3D del equipo (16-nov-2026). Cada persona es un avatar en su departamento; la calle es la zona del
// cambaceo, con el módulo y el banner. Lo que hace cada quien hoy aparece como burbuja sobre su cabeza (y confeti
// cuando se cobra un honorario). Todo se dibuja con figuras simples de three.js, sin modelos externos.
import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { burbuja, nuevas, type Actividad, type Departamento, type Resumen } from "@/lib/equipo/actividad";

export type PersonaVista = { id: string; nombre: string; departamento: Departamento; conCuenta: boolean; resumen: Resumen | null };

type Zona = { cx: number; cz: number; ancho: number; fondo: number; color: number; titulo: string; columnas: number };
const ZONAS: Record<Departamento, Zona> = {
  direccion: { cx: -12, cz: -6, ancho: 8, fondo: 6, color: 0x004aad, titulo: "Dirección", columnas: 2 },
  analisis: { cx: -2, cz: -6, ancho: 8, fondo: 6, color: 0x7c3aed, titulo: "Análisis y verificación", columnas: 3 },
  vendedores: { cx: 8, cz: -6, ancho: 8, fondo: 6, color: 0xd97706, titulo: "Vendedores", columnas: 3 },
  asesores: { cx: -6, cz: 4.5, ancho: 20, fondo: 8, color: 0x5e9e3a, titulo: "Asesores de pensiones", columnas: 5 },
  calle: { cx: 13, cz: 5, ancho: 10, fondo: 12, color: 0x6b7280, titulo: "Calle · cambaceo", columnas: 2 },
};
const PIELES = [0xc68642, 0xe0ac69, 0x8d5524, 0xf1c27d, 0xa86b3c];
const PELO = [0x1f1300, 0x3b2a1a, 0x111111, 0x4a3426];
const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);
const primerNombre = (n: string) => n.split(/\s+/)[0].toLowerCase().replace(/^./, (c) => c.toUpperCase());

type Avatar = {
  persona: PersonaVista; grupo: THREE.Group; brazoI: THREE.Object3D; brazoD: THREE.Object3D; cabeza: THREE.Object3D;
  piernaI: THREE.Object3D; piernaD: THREE.Object3D; etiqueta: THREE.Sprite; pantalla?: THREE.MeshStandardMaterial;
  base: THREE.Vector3; camina: boolean; fase: number; ruta?: THREE.Vector3[]; tramo: number; atiende?: THREE.Vector3 | null;
};
type Peaton = ReturnType<typeof crearAvatar> & { sube: boolean; vel: number; fase: number; carril: number;
  modo: "paseo" | "va" | "espera" | "regresa"; destino: THREE.Vector3 | null; hasta: number; gerente: string | null };
type Efecto = { obj: THREE.Object3D; nace: number; vida: number; tipo: "burbuja" | "confeti"; vel?: THREE.Vector3[] };

function texturaTexto(lineas: { texto: string; color: string; tamano: number; negrita?: boolean }[], fondo: string | null) {
  const lienzo = document.createElement("canvas");
  const ctx = lienzo.getContext("2d")!;
  const fuente = (l: (typeof lineas)[number]) => `${l.negrita ? "700" : "500"} ${l.tamano}px Poppins, Inter, system-ui, sans-serif`;
  // El ancho se ajusta al texto más largo: así ningún letrero sale cortado.
  const ancho = Math.ceil(Math.max(...lineas.map((l) => { ctx.font = fuente(l); return ctx.measureText(l.texto).width; })) + 64);
  const alto = lineas.reduce((a, l) => a + l.tamano * 1.35, 24);
  lienzo.width = ancho; lienzo.height = Math.ceil(alto);
  if (fondo) {
    ctx.fillStyle = fondo;
    const r = 28;
    ctx.beginPath(); ctx.roundRect(4, 4, ancho - 8, lienzo.height - 8, r); ctx.fill();
  }
  let y = 14;
  for (const l of lineas) {
    ctx.font = fuente(l);
    ctx.fillStyle = l.color; ctx.textAlign = "center"; ctx.textBaseline = "top";
    ctx.fillText(l.texto, ancho / 2, y);
    y += l.tamano * 1.35;
  }
  const t = new THREE.CanvasTexture(lienzo);
  t.colorSpace = THREE.SRGBColorSpace;
  return { textura: t, aspecto: ancho / lienzo.height };
}

function sprite(lineas: Parameters<typeof texturaTexto>[0], fondo: string | null, escala: number) {
  const { textura, aspecto } = texturaTexto(lineas, fondo);
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: textura, transparent: true, depthWrite: false }));
  s.scale.set(escala * aspecto, escala, 1);
  return s;
}

function lineasEtiqueta(p: PersonaVista) {
  const sub = !p.conCuenta ? "sin cuenta" : p.resumen?.total ? `${p.resumen.total} ${p.resumen.total === 1 ? "acción" : "acciones"} hoy` : "sin actividad hoy";
  return [
    { texto: primerNombre(p.nombre), color: "#0f172a", tamano: 64, negrita: true },
    { texto: sub, color: p.resumen?.total ? "#3F7A24" : "#64748b", tamano: 44 },
  ];
}

function mat(color: number, extra: Partial<THREE.MeshStandardMaterialParameters> = {}) {
  return new THREE.MeshStandardMaterial({ color, roughness: 0.8, ...extra });
}

function crearAvatar(p: PersonaVista, color: number): Omit<Avatar, "base" | "camina" | "fase" | "tramo" | "etiqueta" | "persona"> {
  const h = hash(p.id);
  const opaco = p.conCuenta ? {} : { transparent: true, opacity: 0.45 };
  const grupo = new THREE.Group();
  const ropa = mat(p.conCuenta ? color : 0x9ca3af, opaco);
  const piel = mat(PIELES[h % PIELES.length], opaco);
  const pantalon = mat(0x1e293b, opaco);
  const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, 0.55, 12), ropa);
  torso.position.y = 0.95; torso.castShadow = true; grupo.add(torso);
  const cabeza = new THREE.Group(); cabeza.position.y = 1.38; grupo.add(cabeza);
  const craneo = new THREE.Mesh(new THREE.SphereGeometry(0.17, 16, 12), piel); craneo.castShadow = true; cabeza.add(craneo);
  const pelo = new THREE.Mesh(new THREE.SphereGeometry(0.18, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), mat(PELO[h % PELO.length], opaco));
  pelo.position.y = 0.02; cabeza.add(pelo);
  const brazo = (lado: number) => {
    const pivote = new THREE.Group(); pivote.position.set(0.27 * lado, 1.18, 0);
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.42, 0.09), ropa); b.position.y = -0.2; b.castShadow = true;
    const mano = new THREE.Mesh(new THREE.SphereGeometry(0.055, 8, 6), piel); mano.position.y = -0.43;
    pivote.add(b, mano); grupo.add(pivote); return pivote;
  };
  const pierna = (lado: number) => {
    const pivote = new THREE.Group(); pivote.position.set(0.1 * lado, 0.68, 0);
    const l = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.62, 0.12), pantalon); l.position.y = -0.31; l.castShadow = true;
    pivote.add(l); grupo.add(pivote); return pivote;
  };
  return { grupo, brazoI: brazo(-1), brazoD: brazo(1), cabeza, piernaI: pierna(-1), piernaD: pierna(1) };
}

function escritorio(x: number, z: number, vacante: boolean, nombre?: string) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const madera = mat(0xe7d7c1);
  const cubierta = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.06, 0.75), madera); cubierta.position.y = 0.76; cubierta.castShadow = true; cubierta.receiveShadow = true; g.add(cubierta);
  for (const [dx, dz] of [[-0.68, -0.32], [0.68, -0.32], [-0.68, 0.32], [0.68, 0.32]]) {
    const pata = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.76, 0.05), mat(0x64748b)); pata.position.set(dx, 0.38, dz); g.add(pata);
  }
  const pantalla = mat(0x0f172a, { emissive: new THREE.Color(vacante ? 0x0f172a : 0x1d4ed8), emissiveIntensity: vacante ? 0 : 0.6 });
  const monitor = new THREE.Mesh(new THREE.BoxGeometry(0.62, 0.38, 0.04), [mat(0x111827), mat(0x111827), mat(0x111827), mat(0x111827), pantalla, mat(0x111827)]);
  monitor.position.set(0, 1.05, -0.2); g.add(monitor);
  const pie = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.2, 0.06), mat(0x111827)); pie.position.set(0, 0.86, -0.2); g.add(pie);
  const silla = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.08, 0.5), mat(0x334155)); silla.position.set(0, 0.48, 0.62); g.add(silla);
  const respaldo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.55, 0.06), mat(0x334155)); respaldo.position.set(0, 0.78, 0.88); g.add(respaldo);
  if (!vacante) {
    const teclado = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.02, 0.14), mat(0x1f2937)); teclado.position.set(0, 0.8, 0.08); g.add(teclado);
    const raton = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.02, 0.09), mat(0x1f2937)); raton.position.set(0.3, 0.8, 0.1); g.add(raton);
    const taza = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 12), mat(0xffffff)); taza.position.set(-0.5, 0.835, 0.05); g.add(taza);
    const cafe = new THREE.Mesh(new THREE.CircleGeometry(0.035, 12), mat(0x6b3e26)); cafe.rotation.x = -Math.PI / 2; cafe.position.set(-0.5, 0.881, 0.05); g.add(cafe);
    const papeles = new THREE.Mesh(new THREE.BoxGeometry(0.22, 0.04, 0.3), mat(0xf8fafc)); papeles.position.set(0.52, 0.81, -0.12); papeles.rotation.y = 0.2; g.add(papeles);
    const lapiz = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.18, 6), mat(0xfacc15)); lapiz.rotation.z = Math.PI / 2; lapiz.position.set(0.5, 0.84, 0.05); g.add(lapiz);
    const bote = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.11, 0.32, 12, 1, true), mat(0x475569, { side: THREE.DoubleSide })); bote.position.set(0.95, 0.16, 0.2); g.add(bote);
    if (nombre) {
      const placa = sprite([{ texto: nombre, color: "#ffffff", tamano: 44, negrita: true }], "#1e293b", 0.12);
      placa.position.set(0, 0.92, -0.37); g.add(placa);
    }
  }
  return { g, pantalla };
}

function moduloCalle(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.9, 0.7), mat(0x004aad)); mesa.position.y = 0.45; mesa.castShadow = true; g.add(mesa);
  const frente = sprite([{ texto: "RETIRO POR", color: "#ffffff", tamano: 52, negrita: true }, { texto: "DESEMPLEO", color: "#a3e635", tamano: 52, negrita: true }], null, 0.6);
  frente.position.set(0, 0.5, 0.37); g.add(frente);
  // Banner vertical (roll-up).
  const banner = new THREE.Mesh(new THREE.BoxGeometry(0.8, 2.0, 0.04), mat(0xffffff)); banner.position.set(1.4, 1.0, -0.1); banner.castShadow = true; g.add(banner);
  const franja = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.5, 0.05), mat(0x5e9e3a)); franja.position.set(1.4, 1.6, -0.08); g.add(franja);
  const textoBanner = sprite([{ texto: "¿Te quedaste", color: "#004AAD", tamano: 46, negrita: true }, { texto: "sin trabajo?", color: "#004AAD", tamano: 46, negrita: true }], null, 0.42);
  textoBanner.position.set(1.4, 1.05, 0.0); g.add(textoBanner);
  // Sombrilla.
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 2.4, 8), mat(0x9ca3af)); poste.position.set(-0.6, 1.2, 0); g.add(poste);
  const sombrilla = new THREE.Mesh(new THREE.ConeGeometry(1.1, 0.5, 8), mat(0x5e9e3a)); sombrilla.position.set(-0.6, 2.45, 0); sombrilla.castShadow = true; g.add(sombrilla);
  return g;
}

function arbol(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const tronco = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 1.2, 8), mat(0x7c5832)); tronco.position.y = 0.6; g.add(tronco);
  const copa = new THREE.Mesh(new THREE.IcosahedronGeometry(0.8, 0), mat(0x4d7c0f)); copa.position.y = 1.7; copa.castShadow = true; g.add(copa);
  return g;
}

function planta(x: number, z: number, alto = 1) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const maceta = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.17, 0.4, 12), mat(0xb45309)); maceta.position.y = 0.2; maceta.castShadow = true; g.add(maceta);
  for (let i = 0; i < 5; i++) {
    const hoja = new THREE.Mesh(new THREE.SphereGeometry(0.22 * alto, 8, 6), mat(i % 2 ? 0x15803d : 0x22c55e));
    hoja.position.set(Math.cos(i * 1.3) * 0.12, 0.55 + i * 0.12 * alto, Math.sin(i * 1.3) * 0.12); hoja.scale.y = 1.4; hoja.castShadow = true; g.add(hoja);
  }
  return g;
}

function garrafon(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const base = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.95, 0.4), mat(0xf1f5f9)); base.position.y = 0.475; base.castShadow = true; g.add(base);
  const agua = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.45, 16), new THREE.MeshStandardMaterial({ color: 0x60a5fa, transparent: true, opacity: 0.55, roughness: 0.1 }));
  agua.position.y = 1.18; g.add(agua);
  return g;
}

function cafeteria(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const barra = new THREE.Mesh(new THREE.BoxGeometry(2, 0.95, 0.6), mat(0x78350f)); barra.position.y = 0.475; barra.castShadow = true; g.add(barra);
  const cubierta = new THREE.Mesh(new THREE.BoxGeometry(2.05, 0.05, 0.65), mat(0xe5e7eb)); cubierta.position.y = 0.97; g.add(cubierta);
  const maquina = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.45, 0.35), mat(0x111827)); maquina.position.set(-0.55, 1.22, 0); g.add(maquina);
  const luz = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.02), mat(0xef4444, { emissive: new THREE.Color(0xef4444), emissiveIntensity: 1 })); luz.position.set(-0.45, 1.32, 0.18); g.add(luz);
  for (let i = 0; i < 4; i++) { const t = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.035, 0.09, 10), mat([0xffffff, 0x004aad, 0x5e9e3a, 0xfacc15][i])); t.position.set(0.1 + i * 0.15, 1.04, 0.05); g.add(t); }
  const titulo = sprite([{ texto: "Café", color: "#ffffff", tamano: 52, negrita: true }], "#78350f", 0.32); titulo.position.set(0, 1.85, 0); g.add(titulo);
  return g;
}

function sofa(x: number, z: number, rot: number, color = 0x004aad) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const asiento = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 0.8), mat(color)); asiento.position.y = 0.3; asiento.castShadow = true; g.add(asiento);
  const respaldo = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.6, 0.2), mat(color)); respaldo.position.set(0, 0.7, -0.3); g.add(respaldo);
  for (const sx of [-0.95, 0.95]) { const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.55, 0.8), mat(color)); brazo.position.set(sx, 0.45, 0); g.add(brazo); }
  const mesa = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.35, 0.04, 16), mat(0xe7d7c1)); mesa.position.set(0, 0.42, 1); g.add(mesa);
  const pataMesa = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.4, 8), mat(0x64748b)); pataMesa.position.set(0, 0.2, 1); g.add(pataMesa);
  const revista = new THREE.Mesh(new THREE.BoxGeometry(0.25, 0.01, 0.18), mat(0x5e9e3a)); revista.position.set(0.05, 0.45, 1); revista.rotation.y = 0.4; g.add(revista);
  return g;
}

function librero(x: number, z: number, rot: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const marco = new THREE.Mesh(new THREE.BoxGeometry(1.4, 1.8, 0.35), mat(0xe7d7c1)); marco.position.y = 0.9; marco.castShadow = true; g.add(marco);
  for (let fila = 0; fila < 3; fila++) for (let i = 0; i < 6; i++) {
    const libro = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.38, 0.25), mat([0x004aad, 0x5e9e3a, 0xd97706, 0x7c3aed, 0xef4444, 0x0f172a][(i + fila) % 6]));
    libro.position.set(-0.5 + i * 0.2, 0.35 + fila * 0.55, 0.06); g.add(libro);
  }
  return g;
}

function lampara(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.05, 1.7, 8), mat(0x334155)); poste.position.y = 0.85; g.add(poste);
  const foco = new THREE.MeshStandardMaterial({ color: 0xfff7ed, emissive: new THREE.Color(0xfde68a), emissiveIntensity: 0 });
  const pantalla = new THREE.Mesh(new THREE.ConeGeometry(0.28, 0.32, 16, 1, true), foco); pantalla.position.y = 1.8; g.add(pantalla);
  const luz = new THREE.PointLight(0xffd8a8, 0, 9, 1.6); luz.position.y = 1.7; g.add(luz);
  return { g, foco, luz };
}

function coche(color: number) {
  const g = new THREE.Group();
  const carroceria = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.45, 1.9), mat(color, { roughness: 0.4, metalness: 0.2 })); carroceria.position.y = 0.42; carroceria.castShadow = true; g.add(carroceria);
  const cabina = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.38, 1.0), new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.1, metalness: 0.3 })); cabina.position.set(0, 0.82, -0.1); g.add(cabina);
  for (const [dx, dz] of [[-0.45, -0.6], [0.45, -0.6], [-0.45, 0.6], [0.45, 0.6]]) {
    const rueda = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.12, 12), mat(0x111111)); rueda.rotation.z = Math.PI / 2; rueda.position.set(dx, 0.18, dz); g.add(rueda);
  }
  const faros = new THREE.MeshStandardMaterial({ color: 0xfef9c3, emissive: new THREE.Color(0xfef08a), emissiveIntensity: 0.2 });
  for (const dx of [-0.3, 0.3]) { const f = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.08, 0.03), faros); f.position.set(dx, 0.48, 0.96); g.add(f); }
  return { g, faros };
}

/** Pantalla grande con los contadores del día (la textura se redibuja con cada actividad). */
function crearTablero() {
  const lienzo = document.createElement("canvas"); lienzo.width = 1024; lienzo.height = 576;
  const textura = new THREE.CanvasTexture(lienzo); textura.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const marco = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.95, 0.1), mat(0x111827)); marco.position.y = 2.1; marco.castShadow = true; g.add(marco);
  const panel = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.75), new THREE.MeshBasicMaterial({ map: textura })); panel.position.set(0, 2.1, 0.06); g.add(panel);
  for (const sx of [-1.2, 1.2]) { const pata = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.2, 0.08), mat(0x334155)); pata.position.set(sx, 0.6, 0); g.add(pata); }
  const dibujar = (d: { activos: string; prospectos: number; verificados: number; avances: number; cierres: number; lider: string | null; hora: string }) => {
    const c = lienzo.getContext("2d")!;
    const fondo = c.createLinearGradient(0, 0, 0, 576); fondo.addColorStop(0, "#004AAD"); fondo.addColorStop(1, "#00337a");
    c.fillStyle = fondo; c.fillRect(0, 0, 1024, 576);
    c.fillStyle = "#ffffff"; c.font = "700 54px Poppins, Inter, sans-serif"; c.textAlign = "left"; c.fillText("Hoy en RetiroPorDesempleo", 48, 86);
    c.font = "500 34px Inter, sans-serif"; c.fillStyle = "#bfdbfe"; c.textAlign = "right"; c.fillText(d.hora, 976, 84);
    const cajas: [string, string][] = [["Activos", d.activos], ["Prospectos", String(d.prospectos)], ["Verificados", String(d.verificados)], ["Avances", String(d.avances)], ["Cobrados", String(d.cierres)]];
    cajas.forEach(([t, v], i) => {
      const x = 48 + i * 190;
      c.fillStyle = "rgba(255,255,255,0.12)"; c.beginPath(); c.roundRect(x, 140, 170, 220, 22); c.fill();
      c.fillStyle = i === 4 ? "#a3e635" : "#ffffff"; c.textAlign = "center"; c.font = "700 92px Poppins, Inter, sans-serif"; c.fillText(v, x + 85, 270);
      c.fillStyle = "#bfdbfe"; c.font = "500 30px Inter, sans-serif"; c.fillText(t, x + 85, 330);
    });
    c.textAlign = "left"; c.fillStyle = "#facc15"; c.font = "700 40px Poppins, Inter, sans-serif";
    c.fillText(d.lider ? `Líder del día: ${d.lider}` : "Todavía no hay movimiento hoy", 48, 450);
    c.fillStyle = "#bfdbfe"; c.font = "500 28px Inter, sans-serif"; c.fillText("Se actualiza solo, cada 20 segundos", 48, 515);
    textura.needsUpdate = true;
  };
  return { g, dibujar };
}

/** Reloj de pie con la hora real de la Ciudad de México. */
function crearReloj() {
  const lienzo = document.createElement("canvas"); lienzo.width = 256; lienzo.height = 256;
  const textura = new THREE.CanvasTexture(lienzo); textura.colorSpace = THREE.SRGBColorSpace;
  const g = new THREE.Group();
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.08, 2.2, 8), mat(0x334155)); poste.position.y = 1.1; g.add(poste);
  const caja = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.42, 0.08, 32), mat(0x111827)); caja.rotation.x = Math.PI / 2; caja.position.y = 2.45; g.add(caja);
  const cara = new THREE.Mesh(new THREE.CircleGeometry(0.38, 32), new THREE.MeshBasicMaterial({ map: textura })); cara.position.set(0, 2.45, 0.045); g.add(cara);
  const cara2 = cara.clone(); cara2.rotation.y = Math.PI; cara2.position.z = -0.045; g.add(cara2);
  const dibujar = () => {
    const partes = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "numeric", second: "numeric", hour12: false, timeZone: "America/Mexico_City" }).formatToParts(new Date());
    const n = (k: string) => Number(partes.find((x) => x.type === k)?.value ?? 0);
    const h = n("hour") % 12, m = n("minute"), sg = n("second");
    const c = lienzo.getContext("2d")!;
    c.fillStyle = "#ffffff"; c.beginPath(); c.arc(128, 128, 124, 0, Math.PI * 2); c.fill();
    c.fillStyle = "#004AAD"; for (let i = 0; i < 12; i++) { const a = (i / 12) * Math.PI * 2; c.beginPath(); c.arc(128 + Math.sin(a) * 104, 128 - Math.cos(a) * 104, i % 3 ? 4 : 8, 0, Math.PI * 2); c.fill(); }
    const aguja = (ang: number, largo: number, ancho: number, color: string) => { c.strokeStyle = color; c.lineWidth = ancho; c.lineCap = "round"; c.beginPath(); c.moveTo(128, 128); c.lineTo(128 + Math.sin(ang) * largo, 128 - Math.cos(ang) * largo); c.stroke(); };
    aguja(((h + m / 60) / 12) * Math.PI * 2, 60, 10, "#0f172a");
    aguja(((m + sg / 60) / 60) * Math.PI * 2, 88, 7, "#0f172a");
    aguja((sg / 60) * Math.PI * 2, 96, 3, "#ef4444");
    textura.needsUpdate = true;
  };
  return { g, dibujar };
}

function corona() {
  const g = new THREE.Group();
  const oro = mat(0xfacc15, { metalness: 0.6, roughness: 0.3, emissive: new THREE.Color(0xa16207), emissiveIntensity: 0.3 });
  const aro = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.1, 16, 1, true), oro); g.add(aro);
  for (let i = 0; i < 5; i++) { const pico = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.14, 6), oro); const a = (i / 5) * Math.PI * 2; pico.position.set(Math.sin(a) * 0.15, 0.1, Math.cos(a) * 0.15); g.add(pico); }
  g.position.y = 1.62;
  return g;
}

/** Luz del día según la hora de la Ciudad de México: 0 = noche, 1 = pleno día. */
function luzDelDia() {
  const partes = new Intl.DateTimeFormat("es-MX", { hour: "numeric", minute: "numeric", hour12: false, timeZone: "America/Mexico_City" }).formatToParts(new Date());
  const h = Number(partes.find((x) => x.type === "hour")?.value ?? 12) + Number(partes.find((x) => x.type === "minute")?.value ?? 0) / 60;
  if (h >= 8 && h < 18) return 1;
  if (h >= 6 && h < 8) return (h - 6) / 2;
  if (h >= 18 && h < 20) return 1 - (h - 18) / 2;
  return 0;
}

function mesaJuntas(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const cubierta = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 0.05, 24), mat(0xe7d7c1)); cubierta.position.y = 0.76; cubierta.castShadow = true; g.add(cubierta);
  const pie = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.25, 0.74, 12), mat(0x64748b)); pie.position.y = 0.37; g.add(pie);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const silla = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.06, 0.42), mat(0x334155)); silla.position.set(Math.sin(a) * 1.05, 0.46, Math.cos(a) * 1.05); g.add(silla);
    const resp = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.45, 0.05), mat(0x334155)); resp.position.set(Math.sin(a) * 1.27, 0.72, Math.cos(a) * 1.27); resp.rotation.y = a; g.add(resp);
  }
  const carpeta = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.02, 0.22), mat(0x004aad)); carpeta.position.set(0.15, 0.8, 0.1); carpeta.rotation.y = 0.3; g.add(carpeta);
  const titulo = sprite([{ texto: "Sala de juntas", color: "#ffffff", tamano: 46, negrita: true }], "#1e293b", 0.28); titulo.position.y = 1.7; g.add(titulo);
  return g;
}

function archivero(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.5, 1.3, 0.6), mat(0x94a3b8, { metalness: 0.3, roughness: 0.5 })); cuerpo.position.y = 0.65; cuerpo.castShadow = true; g.add(cuerpo);
  for (let i = 0; i < 4; i++) { const jalador = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.03, 0.03), mat(0x334155)); jalador.position.set(0, 0.25 + i * 0.3, 0.31); g.add(jalador); }
  return g;
}

function impresora(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const mueble = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.7, 0.6), mat(0xe2e8f0)); mueble.position.y = 0.35; g.add(mueble);
  const equipo = new THREE.Mesh(new THREE.BoxGeometry(0.7, 0.4, 0.55), mat(0xf8fafc)); equipo.position.y = 0.9; equipo.castShadow = true; g.add(equipo);
  const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.22), mat(0xffffff)); hoja.position.set(0, 1.11, 0.15); g.add(hoja);
  const luz = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.02), mat(0x22c55e, { emissive: new THREE.Color(0x22c55e), emissiveIntensity: 1 })); luz.position.set(0.25, 1.0, 0.28); g.add(luz);
  return g;
}

function perrito(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -0.6;
  const cama = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.12, 20), mat(0xd97706)); cama.position.y = 0.06; g.add(cama);
  const pelaje = mat(0xc08a5b);
  const cuerpo = new THREE.Mesh(new THREE.SphereGeometry(0.22, 12, 10), pelaje); cuerpo.scale.set(1.3, 0.75, 0.9); cuerpo.position.y = 0.24; cuerpo.castShadow = true; g.add(cuerpo);
  const cabeza = new THREE.Mesh(new THREE.SphereGeometry(0.12, 12, 10), pelaje); cabeza.position.set(0.3, 0.24, 0.05); g.add(cabeza);
  for (const dz of [-0.06, 0.12]) { const oreja = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.09, 6), mat(0x8b5e3c)); oreja.position.set(0.32, 0.36, dz); g.add(oreja); }
  const cola = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.22, 6), pelaje); cola.position.set(-0.32, 0.25, 0); cola.rotation.z = 1.1; g.add(cola);
  return { g, cuerpo, cola };
}

function bicicleta(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = 0.4;
  const metal = mat(0x16a34a, { metalness: 0.4, roughness: 0.4 });
  for (const dz of [-0.45, 0.45]) { const rueda = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.03, 8, 20), mat(0x111111)); rueda.rotation.y = Math.PI / 2; rueda.position.set(0, 0.32, dz); g.add(rueda); }
  const cuadro = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.04, 0.9), metal); cuadro.position.set(0, 0.55, 0); g.add(cuadro);
  const tubo = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.45, 0.04), metal); tubo.position.set(0, 0.55, -0.1); tubo.rotation.x = 0.3; g.add(tubo);
  const asiento = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.04, 0.2), mat(0x111111)); asiento.position.set(0, 0.8, -0.15); g.add(asiento);
  const manubrio = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.04, 0.04), mat(0x111111)); manubrio.position.set(0, 0.85, 0.42); g.add(manubrio);
  const canasta = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.18, 0.22), mat(0x92400e)); canasta.position.set(0, 0.85, 0.6); g.add(canasta);
  const volantes = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.06, 0.16), mat(0xffffff)); volantes.position.set(0, 0.96, 0.6); g.add(volantes);
  return g;
}

function puestoTacos(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -Math.PI / 2;
  const carro = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.95, 0.8), mat(0xdc2626)); carro.position.y = 0.6; carro.castShadow = true; g.add(carro);
  for (const dx of [-0.6, 0.6]) { const r = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.1, 12), mat(0x111111)); r.rotation.x = Math.PI / 2; r.position.set(dx, 0.15, 0.42); g.add(r); }
  const plancha = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.05, 0.6), mat(0x9ca3af, { metalness: 0.6 })); plancha.position.y = 1.1; g.add(plancha);
  const toldo = new THREE.Mesh(new THREE.BoxGeometry(2.1, 0.06, 1.2), mat(0xfacc15)); toldo.position.y = 2.15; toldo.castShadow = true; g.add(toldo);
  for (const dx of [-0.95, 0.95]) { const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), mat(0x9ca3af)); poste.position.set(dx, 1.6, 0); g.add(poste); }
  const letrero = sprite([{ texto: "Tacos", color: "#ffffff", tamano: 60, negrita: true }], "#dc2626", 0.38); letrero.position.y = 2.6; g.add(letrero);
  const taquero: PersonaVista = { id: "taquero", nombre: "", departamento: "calle", conCuenta: true, resumen: null };
  const t = crearAvatar(taquero, 0xffffff); t.grupo.position.set(0, 0, -0.75); t.brazoD.rotation.x = -1.2; t.brazoI.rotation.x = -1.2; g.add(t.grupo);
  return { g, taquero: t };
}

function semaforo(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const poste = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 3, 8), mat(0x374151)); poste.position.y = 1.5; g.add(poste);
  const caja = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.8, 0.25), mat(0x111827)); caja.position.y = 3.1; g.add(caja);
  const luces = [0xef4444, 0xfacc15, 0x22c55e].map((c, i) => {
    const m = new THREE.MeshStandardMaterial({ color: 0x1f2937, emissive: new THREE.Color(c), emissiveIntensity: 0 });
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.08, 10, 8), m); l.position.set(0, 3.35 - i * 0.25, 0.13); g.add(l); return m;
  });
  return { g, luces };
}

function pizarronPremio(premio: { nombre: string; meta: number } | null) {
  const g = new THREE.Group();
  const marco = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 0.06), mat(0x94a3b8)); marco.position.y = 1.5; marco.castShadow = true; g.add(marco);
  const lineas = premio
    ? [{ texto: "PREMIO", color: "#3F7A24", tamano: 56, negrita: true }, { texto: premio.nombre, color: "#0f172a", tamano: 44, negrita: true },
      { texto: `Meta: ${premio.meta} clientes de retiro cobrados`, color: "#334155", tamano: 34 }, { texto: "¡Vamos por ella!", color: "#004AAD", tamano: 40, negrita: true }]
    : [{ texto: "Pizarrón del equipo", color: "#0f172a", tamano: 50, negrita: true }, { texto: "¡A darle con todo hoy!", color: "#004AAD", tamano: 40, negrita: true }];
  const texto = sprite(lineas, "#ffffff", 1.05);
  // El texto mira siempre a la cámara: se dibuja encima del marco para que nunca quede tapado.
  texto.material.depthTest = false; texto.renderOrder = 5;
  texto.position.set(0, 1.5, 0.05); g.add(texto);
  for (const dx of [-0.9, 0.9]) { const pata = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.9, 0.05), mat(0x64748b)); pata.position.set(dx, 0.45, 0); g.add(pata); }
  return g;
}

/** Nubes de día que cruzan despacio. */
function nube() {
  const g = new THREE.Group();
  const blanco = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 1, transparent: true, opacity: 0.92 });
  for (let i = 0; i < 4; i++) { const b = new THREE.Mesh(new THREE.SphereGeometry(0.9 + (i % 2) * 0.4, 10, 8), blanco); b.position.set(i * 0.9 - 1.3, (i % 2) * 0.3, (i % 3) * 0.3); g.add(b); }
  return { g, blanco };
}

/** Ventanas de un edificio. De día: fachada clara con vidrios azulados. De noche: solo brillan las ventanas encendidas. */
function texturasVentanas(columnas: number, pisos: number, semilla: number) {
  const dia = document.createElement("canvas"), noche = document.createElement("canvas");
  for (const l of [dia, noche]) { l.width = columnas * 32; l.height = pisos * 40; }
  const cd = dia.getContext("2d")!, cn = noche.getContext("2d")!;
  cd.fillStyle = "#ffffff"; cd.fillRect(0, 0, dia.width, dia.height);
  cn.fillStyle = "#000000"; cn.fillRect(0, 0, noche.width, noche.height);
  let r = semilla;
  const azar = () => { r = (r * 1103515245 + 12345) % 2147483648; return r / 2147483648; };
  for (let y = 0; y < pisos; y++) for (let x = 0; x < columnas; x++) {
    cd.fillStyle = "#5b7a99"; cd.fillRect(x * 32 + 6, y * 40 + 8, 20, 24);
    if (azar() > 0.35) { cn.fillStyle = "#ffe9a8"; cn.fillRect(x * 32 + 6, y * 40 + 8, 20, 24); }
  }
  const tex = (l: HTMLCanvasElement) => { const t = new THREE.CanvasTexture(l); t.colorSpace = THREE.SRGBColorSpace; t.magFilter = THREE.NearestFilter; return t; };
  return { mapa: tex(dia), luces: tex(noche) };
}

function edificio(x: number, z: number, ancho: number, alto: number, fondo: number, color: number, semilla: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const { mapa, luces } = texturasVentanas(Math.max(2, Math.round(ancho * 1.2)), Math.max(2, Math.round(alto / 1.4)), semilla);
  const lado = new THREE.MeshStandardMaterial({ color, roughness: 0.8, map: mapa, emissive: new THREE.Color(0xffffff), emissiveMap: luces, emissiveIntensity: 0 });
  const techo = mat(new THREE.Color(color).multiplyScalar(0.8).getHex());
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(ancho, alto, fondo), [lado, lado, techo, techo, lado, lado]);
  cuerpo.position.y = alto / 2; cuerpo.castShadow = true; cuerpo.receiveShadow = true; g.add(cuerpo);
  const cornisa = new THREE.Mesh(new THREE.BoxGeometry(ancho + 0.2, 0.2, fondo + 0.2), techo); cornisa.position.y = alto + 0.1; g.add(cornisa);
  if (alto > 8) { // tinaco y antena en la azotea
    const tinaco = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.4, 0.7, 12), mat(0x1f2937)); tinaco.position.set(ancho * 0.25, alto + 0.55, 0); g.add(tinaco);
    const antena = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.6, 6), mat(0x9ca3af)); antena.position.set(-ancho * 0.25, alto + 0.9, 0); g.add(antena);
  }
  lado.userData.base = color;
  return { g, ventanas: lado };
}

function local(x: number, z: number, nombre: string, color: number, rot: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.2, 3), mat(color)); cuerpo.position.y = 1.6; cuerpo.castShadow = true; cuerpo.receiveShadow = true; g.add(cuerpo);
  const cortina = new THREE.Mesh(new THREE.BoxGeometry(2.6, 2, 0.05), mat(0x93c5fd, { roughness: 0.2, metalness: 0.2, emissive: new THREE.Color(0xfde68a), emissiveIntensity: 0 }));
  cortina.position.set(0, 1.1, 1.51); g.add(cortina);
  const toldo = new THREE.Mesh(new THREE.BoxGeometry(3.4, 0.08, 0.8), mat(new THREE.Color(color).multiplyScalar(0.7).getHex())); toldo.position.set(0, 2.35, 1.8); toldo.rotation.x = 0.25; g.add(toldo);
  const letrero = sprite([{ texto: nombre, color: "#ffffff", tamano: 60, negrita: true }], `#${new THREE.Color(color).multiplyScalar(0.55).getHexString()}`, 0.42);
  letrero.position.set(0, 2.85, 1.6); g.add(letrero);
  return { g, aparador: cortina.material as THREE.MeshStandardMaterial };
}

function poste(x: number, z: number, rot: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const tubo = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.07, 4, 8), mat(0x4b5563)); tubo.position.y = 2; g.add(tubo);
  const brazo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 0.06, 0.06), mat(0x4b5563)); brazo.position.set(0.42, 3.95, 0); g.add(brazo);
  const foco = new THREE.MeshStandardMaterial({ color: 0xfefce8, emissive: new THREE.Color(0xfde68a), emissiveIntensity: 0 });
  const cabeza = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.1, 0.22), foco); cabeza.position.set(0.85, 3.88, 0); g.add(cabeza);
  return { g, foco };
}

function paradaCamion(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = -Math.PI / 2;
  const techo = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.08, 1), mat(0x004aad)); techo.position.y = 2.3; techo.castShadow = true; g.add(techo);
  for (const dx of [-1.1, 1.1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 2.3, 0.06), mat(0x9ca3af)); p.position.set(dx, 1.15, -0.4); g.add(p); }
  const fondo = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.6), new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.35, side: THREE.DoubleSide })); fondo.position.set(0, 1.4, -0.45); g.add(fondo);
  const banca = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.08, 0.4), mat(0x78350f)); banca.position.set(0, 0.45, -0.2); g.add(banca);
  const letrero = sprite([{ texto: "Parada", color: "#ffffff", tamano: 54, negrita: true }], "#004AAD", 0.3); letrero.position.set(0, 2.7, 0); g.add(letrero);
  return g;
}

function pingPong(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const mesa = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.05, 1.3), mat(0x15803d)); mesa.position.y = 0.76; mesa.castShadow = true; g.add(mesa);
  const linea = new THREE.Mesh(new THREE.PlaneGeometry(2.4, 0.03), mat(0xffffff)); linea.rotation.x = -Math.PI / 2; linea.position.y = 0.79; g.add(linea);
  const red = new THREE.Mesh(new THREE.PlaneGeometry(0.02, 1.3), mat(0xffffff)); red.position.y = 0.86; g.add(red);
  const malla = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.14, 1.3), new THREE.MeshStandardMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })); malla.position.y = 0.85; g.add(malla);
  for (const [dx, dz] of [[-1.05, -0.55], [1.05, -0.55], [-1.05, 0.55], [1.05, 0.55]]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.74, 0.06), mat(0x334155)); p.position.set(dx, 0.37, dz); g.add(p); }
  for (const [dx, c] of [[-0.8, 0xef4444], [0.8, 0x111827]] as const) { const raqueta = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.02, 16), mat(c)); raqueta.position.set(dx, 0.8, 0.3); g.add(raqueta); }
  const pelota = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 6), mat(0xffffff)); pelota.position.set(0, 0.95, 0); g.add(pelota);
  return { g, pelota };
}

function maquinaBotanas(x: number, z: number, rot: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z); g.rotation.y = rot;
  const cuerpo = new THREE.Mesh(new THREE.BoxGeometry(0.9, 1.9, 0.7), mat(0xdc2626)); cuerpo.position.y = 0.95; cuerpo.castShadow = true; g.add(cuerpo);
  const vitrina = new THREE.Mesh(new THREE.PlaneGeometry(0.6, 1.2), new THREE.MeshStandardMaterial({ color: 0xfef3c7, emissive: new THREE.Color(0xfef3c7), emissiveIntensity: 0.5 }));
  vitrina.position.set(-0.08, 1.15, 0.36); g.add(vitrina);
  for (let f = 0; f < 4; f++) for (let i = 0; i < 3; i++) {
    const b = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.04), mat([0xfacc15, 0x2563eb, 0x16a34a, 0xf97316][(f + i) % 4])); b.position.set(-0.25 + i * 0.17, 0.7 + f * 0.27, 0.38); g.add(b);
  }
  return g;
}

function repisaTrofeos(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const mueble = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.1, 0.4), mat(0xe7d7c1)); mueble.position.y = 0.55; mueble.castShadow = true; g.add(mueble);
  const oro = mat(0xfacc15, { metalness: 0.7, roughness: 0.25 });
  [-0.5, 0, 0.5].forEach((dx, i) => {
    const base = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.08, 0.18), mat(0x111827)); base.position.set(dx, 1.14, 0); g.add(base);
    const copa = new THREE.Mesh(new THREE.CylinderGeometry(0.1 + i * 0.02, 0.04, 0.22 + i * 0.05, 12), oro); copa.position.set(dx, 1.32 + i * 0.02, 0); copa.castShadow = true; g.add(copa);
  });
  const titulo = sprite([{ texto: "Logros del equipo", color: "#ffffff", tamano: 44, negrita: true }], "#3F7A24", 0.24); titulo.position.y = 1.85; g.add(titulo);
  return g;
}

function perchero(x: number, z: number) {
  const g = new THREE.Group(); g.position.set(x, 0, z);
  const palo = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.8, 8), mat(0x78350f)); palo.position.y = 0.9; g.add(palo);
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.25, 0.05, 12), mat(0x78350f)); base.position.y = 0.03; g.add(base);
  const saco = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.6, 0.12), mat(0x1e3a8a)); saco.position.set(0.12, 1.4, 0); g.add(saco);
  const paraguero = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.45, 12, 1, true), mat(0x334155, { side: THREE.DoubleSide })); paraguero.position.set(0.45, 0.23, 0); g.add(paraguero);
  const paraguas = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.025, 0.85, 6), mat(0x5e9e3a)); paraguas.position.set(0.45, 0.5, 0); paraguas.rotation.z = 0.15; g.add(paraguas);
  return g;
}

/** Posiciones de escritorio dentro de una zona (en filas). */
function puestos(z: Zona, n: number) {
  const cols = Math.min(z.columnas, Math.max(1, n));
  const filas = Math.max(1, Math.ceil(n / cols));
  const dx = z.ancho / (cols + 0.4), dz = Math.min(2.6, z.fondo / (filas + 0.6));
  return Array.from({ length: n }, (_, i) => new THREE.Vector3(z.cx + (i % cols - (cols - 1) / 2) * dx, 0, z.cz + (Math.floor(i / cols) - (filas - 1) / 2) * dz - 0.3));
}

export function Oficina3D({ personas, actividades, autoGiro, premio }: { personas: PersonaVista[]; actividades: Actividad[]; autoGiro: boolean; premio: { nombre: string; meta: number } | null }) {
  const contenedor = useRef<HTMLDivElement>(null);
  const estado = useRef<{ avatares: Map<string, Avatar>; efectos: Efecto[]; escena: THREE.Scene; controles: OrbitControls; vistas: Set<string>; listo: boolean;
    tablero: (d: Parameters<ReturnType<typeof crearTablero>["dibujar"]>[0]) => void; corona: THREE.Group; llamarPeaton: (gerenteId: string) => void } | null>(null);
  const [ficha, setFicha] = useState<{ x: number; y: number; ancho: number; p: PersonaVista } | null>(null);
  const clavePersonas = personas.map((p) => `${p.id}:${p.departamento}:${p.conCuenta}`).join("|") + `|premio:${premio?.nombre ?? ""}:${premio?.meta ?? ""}`;

  // Escena: se arma una vez por plantilla de personas.
  useEffect(() => {
    const el = contenedor.current;
    if (!el) return;
    const reducir = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    el.appendChild(renderer.domElement);
    const escena = new THREE.Scene();
    escena.background = new THREE.Color(0xdbeafe);
    escena.fog = new THREE.Fog(0xdbeafe, 45, 80);
    const camara = new THREE.PerspectiveCamera(42, 1, 0.1, 200);
    camara.position.set(1, 15, 19);
    const controles = new OrbitControls(camara, renderer.domElement);
    controles.target.set(0, 0, -0.5); controles.enableDamping = true; controles.maxPolarAngle = Math.PI / 2.25;
    controles.minDistance = 8; controles.maxDistance = 50; controles.autoRotateSpeed = 0.6;

    escena.add(new THREE.HemisphereLight(0xffffff, 0x94a3b8, 1.1));
    const sol = new THREE.DirectionalLight(0xffffff, 1.6);
    sol.position.set(12, 22, 10); sol.castShadow = true;
    sol.shadow.mapSize.set(2048, 2048);
    Object.assign(sol.shadow.camera, { left: -25, right: 25, top: 20, bottom: -20, near: 1, far: 60 });
    escena.add(sol);

    // Piso de la oficina y la calle.
    const piso = new THREE.Mesh(new THREE.PlaneGeometry(26, 21), mat(0xf8fafc)); piso.rotation.x = -Math.PI / 2; piso.position.set(-4, 0, -0.5); piso.receiveShadow = true; escena.add(piso);
    const banqueta = new THREE.Mesh(new THREE.PlaneGeometry(4, 64), mat(0xd6d3d1)); banqueta.rotation.x = -Math.PI / 2; banqueta.position.set(11, 0.005, -0.5); banqueta.receiveShadow = true; escena.add(banqueta);
    const asfalto = new THREE.Mesh(new THREE.PlaneGeometry(8, 64), mat(0x4b5563)); asfalto.rotation.x = -Math.PI / 2; asfalto.position.set(17, 0, -0.5); asfalto.receiveShadow = true; escena.add(asfalto);
    for (let z = -31; z < 32; z += 2.5) {
      const raya = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 1.2), mat(0xfacc15)); raya.rotation.x = -Math.PI / 2; raya.position.set(17, 0.01, z); escena.add(raya);
    }
    const pasto = new THREE.Mesh(new THREE.PlaneGeometry(120, 120), mat(0xbbf7d0)); pasto.rotation.x = -Math.PI / 2; pasto.position.y = -0.02; pasto.receiveShadow = true; escena.add(pasto);
    // Muros bajos de la oficina (sin techo, para ver dentro).
    const muro = (w: number, d: number, x: number, z: number) => {
      const m = new THREE.Mesh(new THREE.BoxGeometry(w, 0.9, d), mat(0xe2e8f0)); m.position.set(x, 0.45, z); m.castShadow = true; m.receiveShadow = true; escena.add(m);
    };
    muro(26, 0.2, -4, -11); muro(0.2, 21, -17, -0.5); muro(26, 0.2, -4, 10); muro(0.2, 8, 9, -6.5); muro(0.2, 8, 9, 6.5);
    const letrero = sprite([{ texto: "RetiroPorDesempleo.com", color: "#004AAD", tamano: 60, negrita: true }], null, 1.4);
    letrero.position.set(-12, 4.4, -11); escena.add(letrero);

    // Detalles de la oficina: recepción con entrada, sala de espera, cafetería, agua, plantas, librero y lámparas.
    escena.add(arbol(10.5, -9), arbol(10.5, 9), arbol(21.5, -6), arbol(21.5, 7));
    const tapeteEntrada = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 3.6), mat(0x004aad)); tapeteEntrada.rotation.x = -Math.PI / 2; tapeteEntrada.position.set(8, 0.012, 0); escena.add(tapeteEntrada);
    const bienvenida = sprite([{ texto: "Bienvenido", color: "#ffffff", tamano: 56, negrita: true }], "#5E9E3A", 0.45); bienvenida.position.set(9.2, 1.5, 0); escena.add(bienvenida);
    escena.add(sofa(6, 1.2, -Math.PI / 2, 0x5e9e3a), librero(8.6, -5, -Math.PI / 2), cafeteria(-15.4, 8.8), garrafon(-16.4, -10.2), garrafon(7.8, 9.3));
    [[-16.3, -0.5], [-16.3, 9.2], [8.4, -10.3], [-6, -10.3], [4.2, 9.3], [8.4, 3.2], [-16.3, -6], [-8.6, 9.3]].forEach(([x, z], i) => escena.add(planta(x, z, i % 3 ? 1 : 1.3)));
    const lamparas = [[-15.8, -2.8], [-7, 0.2], [3.5, 0.2], [7.5, 6.8]].map(([x, z]) => { const l = lampara(x, z); escena.add(l.g); return l; });
    const tablero = crearTablero(); tablero.g.position.set(3.2, 0, -10.3); tablero.g.scale.setScalar(1.35); escena.add(tablero.g);
    const relojPie = crearReloj(); relojPie.g.position.set(7.4, 0, -3.4); escena.add(relojPie.g); relojPie.dibujar();
    escena.add(mesaJuntas(-14.9, -4.3), archivero(-5.7, -10.4), archivero(-5.1, -10.4), archivero(-4.5, -10.4), impresora(1.2, -10.3));
    const perro = perrito(5.1, 3.1); escena.add(perro.g);
    const pizarron = pizarronPremio(premio); pizarron.position.set(-3.2, 0, 8.9); escena.add(pizarron);
    // Ventanales sobre los muros del fondo y la izquierda.
    const vidrio = new THREE.MeshStandardMaterial({ color: 0xbfdbfe, transparent: true, opacity: 0.22, roughness: 0.05, metalness: 0.1, side: THREE.DoubleSide });
    const marcoV = mat(0x94a3b8);
    for (let x = -16.4; x <= 8.4; x += 2.6) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), vidrio); v.position.set(x + 1.3, 1.65, -11); escena.add(v);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.5, 0.1), marcoV); m.position.set(x, 1.65, -11); escena.add(m);
    }
    for (let z = -10.6; z <= 9.4; z += 2.6) {
      const v = new THREE.Mesh(new THREE.PlaneGeometry(2.5, 1.5), vidrio); v.rotation.y = Math.PI / 2; v.position.set(-17, 1.65, z + 1.3); escena.add(v);
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.06), marcoV); m.position.set(-17, 1.65, z); escena.add(m);
    }
    const travesano = new THREE.Mesh(new THREE.BoxGeometry(26, 0.08, 0.12), marcoV); travesano.position.set(-4, 2.42, -11); escena.add(travesano);
    const travesanoI = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.08, 21), marcoV); travesanoI.position.set(-17, 2.42, -0.5); escena.add(travesanoI);

    // Calle: paso de cebra frente a la entrada, semáforo, puesto de tacos enfrente.
    for (let x = 13.4; x <= 20.6; x += 0.7) { const r = new THREE.Mesh(new THREE.PlaneGeometry(0.4, 2.2), mat(0xf8fafc)); r.rotation.x = -Math.PI / 2; r.position.set(x, 0.012, 0); escena.add(r); }
    const sem = semaforo(13.1, -1.6); escena.add(sem.g);
    const tacos = puestoTacos(22.7, 4); escena.add(tacos.g);

    // Ciudad alrededor: torres al fondo y a la izquierda, locales del otro lado de la calle, postes de luz y parada.
    const torres = ([
      [-14, -24, 7, 14, 6, 0x94a3b8], [-5, -26, 6, 20, 6, 0xcbd5e1], [4, -23, 5, 11, 5, 0xfde68a], [12, -26, 7, 17, 6, 0x9ca3af],
      [22, -22, 6, 9, 5, 0xfca5a5], [-30, -14, 6, 12, 7, 0xa5b4fc], [-31, -2, 6, 16, 6, 0xd6d3d1], [-30, 9, 6, 10, 7, 0xbbf7d0],
      [31, -12, 6, 13, 6, 0xe2e8f0], [33, 12, 7, 19, 6, 0xc7d2fe], [-20, -33, 8, 24, 7, 0x64748b], [26, -33, 8, 22, 7, 0x475569],
    ] as const).map(([x, z, w, h, d, c], i) => { const e = edificio(x, z, w, h, d, c, 17 + i * 31); escena.add(e.g); return e; });
    const espectacular = sprite([{ texto: "RetiroPorDesempleo.com", color: "#ffffff", tamano: 64, negrita: true }, { texto: "¿Te quedaste sin trabajo? Te ayudamos", color: "#d9f99d", tamano: 40 }], "#004AAD", 1.6);
    espectacular.position.set(-5, 22.6, -26); escena.add(espectacular);
    const locales = ([["Farmacia", 0x16a34a, -8], ["Papelería", 0x2563eb, -3.8], ["Panadería", 0xd97706, 8.4], ["Lavandería", 0x0891b2, 12.6], ["Abarrotes", 0xbe123c, -12.4]] as const)
      .map(([n, c, z]) => { const l = local(24.2, z, n, c, -Math.PI / 2); escena.add(l.g); return l; });
    const banquetaEnfrente = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 64), mat(0xd6d3d1)); banquetaEnfrente.rotation.x = -Math.PI / 2; banquetaEnfrente.position.set(21.9, 0.006, 0); banquetaEnfrente.receiveShadow = true; escena.add(banquetaEnfrente);
    const postes = [[9.6, -8], [9.6, -2.8], [9.6, 4.5], [9.6, 9.5], [21.6, -6], [21.6, 7]].map(([x, z]) => { const p = poste(x, z, x < 15 ? 0 : Math.PI); escena.add(p.g); return p; });
    escena.add(paradaCamion(12.6, -6.8));

    // Más detalles adentro: ping-pong y botanas en la zona de descanso, trofeos, perchero y alfombra de la sala.
    const ping = pingPong(6.2, 6.4); escena.add(ping.g);
    escena.add(maquinaBotanas(-13.5, 9.4, Math.PI), repisaTrofeos(0.8, -10.45), perchero(8.3, -2.9));
    const alfombra = new THREE.Mesh(new THREE.CircleGeometry(1.4, 28), mat(0xfde68a)); alfombra.rotation.x = -Math.PI / 2; alfombra.position.set(5.6, 0.013, 1.6); alfombra.receiveShadow = true; escena.add(alfombra);
    const descanso = sprite([{ texto: "Zona de descanso", color: "#ffffff", tamano: 44, negrita: true }], "#0891b2", 0.28); descanso.position.set(6.2, 1.9, 6.4); escena.add(descanso);

    // Cielo: nubes de día, estrellas de noche.
    const nubes = Array.from({ length: 7 }, (_, i) => { const n = nube(); n.g.position.set(-45 + i * 14, 27 + (i % 3) * 2, -55 + (i % 3) * 6); n.g.scale.setScalar(1.8 + (i % 2) * 0.8); escena.add(n.g); return n; });
    const posEstrellas = new Float32Array(600 * 3);
    for (let i = 0; i < 600; i++) { const a = Math.random() * Math.PI * 2, r = 30 + Math.random() * 40; posEstrellas.set([Math.cos(a) * r, 18 + Math.random() * 25, Math.sin(a) * r - 10], i * 3); }
    const geoEstrellas = new THREE.BufferGeometry(); geoEstrellas.setAttribute("position", new THREE.BufferAttribute(posEstrellas, 3));
    const matEstrellas = new THREE.PointsMaterial({ color: 0xffffff, size: 0.18, transparent: true, opacity: 0 });
    escena.add(new THREE.Points(geoEstrellas, matEstrellas));

    // Calle viva: coches en los dos carriles y peatones en la banqueta.
    const coches = [0xef4444, 0xffffff, 0x2563eb, 0x111827, 0xfacc15].map((color, i) => {
      const c = coche(color); const sube = i % 2 === 0;
      c.g.position.set(sube ? 15.6 : 18.4, 0, -26 + i * 12); c.g.rotation.y = sube ? Math.PI : 0; escena.add(c.g);
      return { ...c, sube, vel: 2.2 + (i % 3) * 0.8 };
    });
    const peatones = [0, 1, 2, 3].map((i) => {
      const persona: PersonaVista = { id: `peaton-${i}`, nombre: "", departamento: "calle", conCuenta: true, resumen: null };
      const partes = crearAvatar(persona, [0x0ea5e9, 0xf43f5e, 0x84cc16, 0xa855f7][i]);
      const carril = i % 2 ? 10.3 : 11.8;
      partes.grupo.position.set(carril, 0, -9 + i * 5); partes.grupo.scale.setScalar(0.95); escena.add(partes.grupo);
      return { ...partes, sube: i % 2 === 0, vel: 0.7 + i * 0.12, fase: i * 1.7, carril, modo: "paseo", destino: null, hasta: 0, gerente: null } as Peaton;
    });
    // Un prospecto real de calle: el peatón libre más cercano se acerca al módulo de ese gerente.
    const llamarPeaton = (gerenteId: string) => {
      const m = modulos.get(gerenteId);
      if (!m) return;
      const libres = peatones.filter((w) => w.modo === "paseo");
      if (!libres.length) return;
      const w = libres.sort((a, b) => a.grupo.position.distanceTo(m) - b.grupo.position.distanceTo(m))[0];
      w.modo = "va"; w.gerente = gerenteId; w.destino = new THREE.Vector3(m.x + 0.4, 0, m.z + 1.25);
    };
    const coronaLider = corona(); coronaLider.visible = false; escena.add(coronaLider);

    // Zonas, escritorios y avatares.
    const avatares = new Map<string, Avatar>();
    const modulos = new Map<string, THREE.Vector3>();
    (Object.keys(ZONAS) as Departamento[]).forEach((dep) => {
      const z = ZONAS[dep];
      if (dep !== "calle") {
        const tapete = new THREE.Mesh(new THREE.PlaneGeometry(z.ancho, z.fondo), mat(z.color, { transparent: true, opacity: 0.14 }));
        tapete.rotation.x = -Math.PI / 2; tapete.position.set(z.cx, 0.01, z.cz); tapete.receiveShadow = true; escena.add(tapete);
      }
      const titulo = sprite([{ texto: z.titulo, color: "#ffffff", tamano: 58, negrita: true }], `#${z.color.toString(16).padStart(6, "0")}`, 0.85);
      titulo.position.set(z.cx, 3.2, z.cz - z.fondo / 2 + 0.6); escena.add(titulo);

      const gente = personas.filter((p) => p.departamento === dep);
      if (dep === "calle") {
        gente.forEach((p, i) => {
          const centro = new THREE.Vector3(z.cx - 1.5, 0, z.cz - 3 + i * 5);
          escena.add(moduloCalle(centro.x, centro.z), bicicleta(centro.x - 1.8, centro.z - 0.9));
          modulos.set(p.id, centro.clone());
          const partes = crearAvatar(p, z.color);
          const ruta = [new THREE.Vector3(centro.x + 0.2, 0, centro.z + 1.4), new THREE.Vector3(centro.x - 0.4, 0, centro.z + 3.2), new THREE.Vector3(centro.x + 1.6, 0, centro.z + 2.6)];
          partes.grupo.position.copy(ruta[0]);
          const etiqueta = sprite(lineasEtiqueta(p), "rgba(255,255,255,0.92)", 0.75); etiqueta.position.y = 2.35; partes.grupo.add(etiqueta);
          partes.grupo.userData.personaId = p.id; escena.add(partes.grupo);
          avatares.set(p.id, { ...partes, persona: p, etiqueta, base: ruta[0].clone(), camina: true, fase: hash(p.id) % 100, ruta, tramo: 0 });
        });
        if (gente.length === 0) {
          const v = sprite([{ texto: "Sin gerentes de campo", color: "#475569", tamano: 48 }], "rgba(255,255,255,0.85)", 0.4);
          v.position.set(z.cx - 1.5, 1, z.cz); escena.add(v);
        }
        return;
      }
      // Puestos vacantes: el departamento existe aunque hoy no tenga a nadie.
      const n = Math.max(gente.length, 1);
      puestos(z, n).forEach((pos, i) => {
        const p = gente[i];
        const { g, pantalla } = escritorio(pos.x, pos.z, !p, p ? primerNombre(p.nombre) : undefined);
        escena.add(g);
        if (!p) {
          const v = sprite([{ texto: "Puesto vacante", color: "#475569", tamano: 48 }], "rgba(255,255,255,0.85)", 0.36);
          v.position.set(pos.x, 1.7, pos.z); escena.add(v);
          return;
        }
        const partes = crearAvatar(p, z.color);
        partes.grupo.position.set(pos.x, 0, pos.z + 0.62);
        partes.grupo.rotation.y = Math.PI; // mira al monitor
        partes.piernaI.rotation.x = partes.piernaD.rotation.x = -Math.PI / 2; // sentado
        partes.grupo.position.y = -0.18;
        const etiqueta = sprite(lineasEtiqueta(p), "rgba(255,255,255,0.92)", 0.75); etiqueta.position.y = 2.35; partes.grupo.add(etiqueta);
        partes.grupo.userData.personaId = p.id; escena.add(partes.grupo);
        avatares.set(p.id, { ...partes, persona: p, etiqueta, pantalla, base: partes.grupo.position.clone(), camina: false, fase: hash(p.id) % 100, tramo: 0 });
      });
    });

    const efectos: Efecto[] = [];
    estado.current = { avatares, efectos, escena, controles, vistas: new Set(), listo: false, tablero: tablero.dibujar, corona: coronaLider, llamarPeaton };

    // Día y noche con la hora real de la CDMX: cielo, sol, lámparas, monitores y faros.
    const hemi = escena.children.find((o): o is THREE.HemisphereLight => o instanceof THREE.HemisphereLight)!;
    const aplicarHora = () => {
      const k = luzDelDia();
      const cielo = new THREE.Color(0x0b1530).lerp(new THREE.Color(0xdbeafe), k);
      (escena.background as THREE.Color).copy(cielo); escena.fog!.color.copy(cielo);
      hemi.intensity = 0.35 + 0.75 * k; sol.intensity = 0.15 + 1.45 * k;
      lamparas.forEach((l) => { l.luz.intensity = (1 - k) * 6; l.foco.emissiveIntensity = (1 - k) * 1.2; });
      coches.forEach((c) => { c.faros.emissiveIntensity = 0.2 + (1 - k) * 1.5; });
      nubes.forEach((n) => { n.blanco.opacity = 0.15 + 0.77 * k; });
      matEstrellas.opacity = Math.max(0, 1 - k * 1.6);
      torres.forEach((e) => { e.ventanas.emissiveIntensity = (1 - k) * 1.1; e.ventanas.color.setScalar(0.35 + 0.65 * k).multiply(new THREE.Color(e.ventanas.userData.base ?? 0xffffff)); });
      locales.forEach((l) => { l.aparador.emissiveIntensity = (1 - k) * 0.8; });
      postes.forEach((p) => { p.foco.emissiveIntensity = (1 - k) * 2; });
    };
    aplicarHora();
    const intervaloHora = setInterval(aplicarHora, 60_000);
    const intervaloReloj = setInterval(relojPie.dibujar, 1000);

    // Ficha al pasar el cursor (o tocar) a una persona.
    const rayo = new THREE.Raycaster(), puntero = new THREE.Vector2();
    const buscar = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      puntero.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      rayo.setFromCamera(puntero, camara);
      const golpe = rayo.intersectObjects([...avatares.values()].map((a) => a.grupo), true)[0];
      let o: THREE.Object3D | null = golpe?.object ?? null;
      while (o && !o.userData.personaId) o = o.parent;
      const a = o ? avatares.get(o.userData.personaId) : null;
      renderer.domElement.style.cursor = a ? "pointer" : "";
      setFicha(a ? { x: ev.clientX - r.left, y: ev.clientY - r.top, ancho: r.width, p: a.persona } : null);
    };
    renderer.domElement.addEventListener("pointermove", buscar);
    renderer.domElement.addEventListener("pointerdown", buscar);
    const salir = () => setFicha(null);
    renderer.domElement.addEventListener("pointerleave", salir);

    const ajustar = () => {
      const w = el.clientWidth, h = el.clientHeight;
      renderer.setSize(w, h); camara.aspect = w / h; camara.updateProjectionMatrix();
    };
    const ro = new ResizeObserver(ajustar); ro.observe(el); ajustar();

    const reloj = new THREE.Clock();
    let raf = 0;
    const cuadro = () => {
      raf = requestAnimationFrame(cuadro);
      const dt = Math.min(reloj.getDelta(), 0.05), t = reloj.elapsedTime;
      const vel = reducir ? 0.25 : 1;
      for (const a of avatares.values()) {
        const activo = (a.persona.resumen?.total ?? 0) > 0;
        const f = t * vel + a.fase;
        if (a.camina && a.atiende) {
          // Atiende al peatón que se acercó: se detiene, lo voltea a ver y le entrega un volante.
          const v = a.atiende.clone().sub(a.grupo.position); a.grupo.rotation.y = Math.atan2(v.x, v.z);
          a.piernaI.rotation.x = a.piernaD.rotation.x = 0; a.brazoI.rotation.x = 0; a.brazoD.rotation.x = -1.2 + Math.sin(f * 2) * 0.1;
        } else if (a.camina && a.ruta) {
          const destino = a.ruta[(a.tramo + 1) % a.ruta.length];
          const dir = destino.clone().sub(a.grupo.position); dir.y = 0;
          const d = dir.length();
          if (d < 0.05) a.tramo = (a.tramo + 1) % a.ruta.length;
          else {
            const paso = Math.min(d, dt * 0.9 * vel);
            a.grupo.position.addScaledVector(dir.normalize(), paso);
            a.grupo.rotation.y = Math.atan2(dir.x, dir.z);
          }
          const s = Math.sin(f * 6);
          a.piernaI.rotation.x = s * 0.5; a.piernaD.rotation.x = -s * 0.5;
          a.brazoI.rotation.x = -s * 0.4; a.brazoD.rotation.x = -0.9 + Math.sin(f * 1.3) * 0.15; // entrega volante
        } else {
          // Escribe en la computadora: más rápido si hoy tiene actividad.
          const r = activo ? 9 : 3;
          a.brazoI.rotation.x = -1.1 + Math.sin(f * r) * 0.08;
          a.brazoD.rotation.x = -1.1 + Math.cos(f * r) * 0.08;
          a.cabeza.rotation.y = Math.sin(f * 0.4) * 0.25;
          a.cabeza.rotation.x = Math.sin(f * 0.7) * 0.05;
          if (a.pantalla) a.pantalla.emissiveIntensity = activo ? 0.7 + Math.sin(f * 2) * 0.15 : 0.25;
        }
      }
      // Semáforo: verde 9 s, amarillo 2 s, rojo 5 s. En rojo los coches esperan antes del paso de cebra.
      const ciclo = (t * vel) % 16, luz = ciclo < 9 ? 2 : ciclo < 11 ? 1 : 0;
      sem.luces.forEach((m, i) => { m.emissiveIntensity = i === luz ? 1.4 : 0; });
      for (const c of coches) {
        const z = c.g.position.z;
        const espera = luz === 0 && (c.sube ? z > 1.3 && z < 2.8 : z < -1.3 && z > -2.8);
        if (!espera) c.g.position.z += (c.sube ? -1 : 1) * c.vel * dt * vel;
        if (c.g.position.z < -30) c.g.position.z = 30;
        if (c.g.position.z > 30) c.g.position.z = -30;
      }
      const ahora = performance.now();
      for (const a of avatares.values()) a.atiende = null;
      for (const w of peatones) {
        const s = Math.sin((t * vel + w.fase) * 6);
        const caminar = () => { w.piernaI.rotation.x = s * 0.5; w.piernaD.rotation.x = -s * 0.5; w.brazoI.rotation.x = -s * 0.4; w.brazoD.rotation.x = s * 0.4; };
        if (w.modo === "paseo") {
          w.grupo.position.z += (w.sube ? -1 : 1) * w.vel * dt * vel;
          if (w.grupo.position.z < -10.5) w.grupo.position.z = 9.5;
          if (w.grupo.position.z > 9.5) w.grupo.position.z = -10.5;
          w.grupo.rotation.y = w.sube ? Math.PI : 0; caminar();
        } else if ((w.modo === "va" || w.modo === "regresa") && w.destino) {
          const dir = w.destino.clone().sub(w.grupo.position); dir.y = 0;
          const d = dir.length();
          if (d < 0.08) {
            if (w.modo === "va") {
              w.modo = "espera"; w.hasta = ahora + 5500;
              const b = sprite([{ texto: "¡Me interesa!", color: "#ffffff", tamano: 56, negrita: true }], "#5E9E3A", 0.5); b.position.y = 2.6; w.grupo.add(b);
              efectos.push({ obj: b, nace: ahora, vida: 5, tipo: "burbuja" });
            } else { w.modo = "paseo"; w.destino = null; w.gerente = null; }
          } else {
            w.grupo.position.addScaledVector(dir.normalize(), Math.min(d, dt * 1.1 * vel));
            w.grupo.rotation.y = Math.atan2(dir.x, dir.z); caminar();
          }
        } else if (w.modo === "espera") {
          w.piernaI.rotation.x = w.piernaD.rotation.x = 0; w.brazoI.rotation.x = 0; w.brazoD.rotation.x = -0.6 + Math.sin(t * 3) * 0.1; // recibe el volante
          const g = w.gerente ? avatares.get(w.gerente) : null;
          if (g) { g.atiende = w.grupo.position.clone(); const v = g.grupo.position.clone().sub(w.grupo.position); w.grupo.rotation.y = Math.atan2(v.x, v.z); }
          if (ahora > w.hasta) { w.modo = "regresa"; w.destino = new THREE.Vector3(w.carril, 0, w.grupo.position.z + (w.sube ? -1.5 : 1.5)); }
        }
      }
      // El perrito respira y mueve la cola; el taquero voltea la carne.
      perro.cuerpo.scale.y = 0.75 + Math.sin(t * 1.6) * 0.03; perro.cola.rotation.x = Math.sin(t * 5) * 0.4;
      tacos.taquero.brazoD.rotation.x = -1.2 + Math.sin(t * 4) * 0.25;
      ping.pelota.position.x = Math.sin(t * 2.2 * vel) * 0.95; ping.pelota.position.y = 0.82 + Math.abs(Math.cos(t * 4.4 * vel)) * 0.22;
      for (const n of nubes) { n.g.position.x += dt * 0.35 * vel; if (n.g.position.x > 55) n.g.position.x = -55; }
      if (coronaLider.visible && coronaLider.userData.personaId) {
        const a = avatares.get(coronaLider.userData.personaId);
        if (a) { a.cabeza.getWorldPosition(coronaLider.position); coronaLider.position.y += 0.28; coronaLider.rotation.y += dt; }
      }
      // Burbujas y confeti.
      for (let i = efectos.length - 1; i >= 0; i--) {
        const e = efectos[i];
        const edad = (performance.now() - e.nace) / 1000;
        if (edad > e.vida) { e.obj.parent?.remove(e.obj); efectos.splice(i, 1); continue; }
        if (e.tipo === "burbuja") {
          e.obj.position.y = 2.95 + edad * 0.25;
          (e.obj as THREE.Sprite).material.opacity = edad > e.vida - 1 ? e.vida - edad : 1;
        } else {
          e.obj.children.forEach((c, k) => { c.position.addScaledVector(e.vel![k], dt); e.vel![k].y -= 3.5 * dt; c.rotation.x += dt * 4; });
        }
      }
      controles.update();
      renderer.render(escena, camara);
    };
    cuadro();

    return () => {
      cancelAnimationFrame(raf); ro.disconnect(); controles.dispose(); clearInterval(intervaloHora); clearInterval(intervaloReloj);
      renderer.domElement.removeEventListener("pointermove", buscar); renderer.domElement.removeEventListener("pointerdown", buscar); renderer.domElement.removeEventListener("pointerleave", salir);
      escena.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose();
        const mats = Array.isArray(m.material) ? m.material : m.material ? [m.material] : [];
        mats.forEach((x) => { (x as THREE.MeshStandardMaterial).map?.dispose(); x.dispose(); });
      });
      renderer.dispose(); el.removeChild(renderer.domElement); estado.current = null;
    };
    // La escena se reconstruye solo si cambia el equipo (no con cada actividad).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [clavePersonas]);

  // Giro automático.
  useEffect(() => { if (estado.current) estado.current.controles.autoRotate = autoGiro; }, [autoGiro, clavePersonas]);

  // Actividad: actualiza etiquetas y lanza burbujas (y confeti al cobrar) solo por lo nuevo.
  useEffect(() => {
    const s = estado.current;
    if (!s) return;
    for (const p of personas) {
      const a = s.avatares.get(p.id);
      if (!a) continue;
      a.persona = p;
      const nueva = sprite(lineasEtiqueta(p), "rgba(255,255,255,0.92)", 0.75);
      a.etiqueta.material.map?.dispose(); a.etiqueta.material.map = nueva.material.map; a.etiqueta.scale.copy(nueva.scale); a.etiqueta.material.needsUpdate = true;
    }
    // Pantalla grande y corona del líder del día.
    const conCuenta = personas.filter((p) => p.conCuenta);
    const suma = (k: keyof Resumen) => personas.reduce((a, p) => a + (p.resumen?.[k] ?? 0), 0);
    const lider = [...personas].filter((p) => (p.resumen?.total ?? 0) > 0).sort((a, b) => (b.resumen!.total - a.resumen!.total))[0] ?? null;
    s.tablero({ activos: `${personas.filter((p) => (p.resumen?.total ?? 0) > 0).length}/${conCuenta.length}`, prospectos: suma("prospectos"), verificados: suma("verificados"),
      avances: suma("avances"), cierres: suma("cierres"), lider: lider ? `${primerNombre(lider.nombre)} (${lider.resumen!.total})` : null,
      hora: new Intl.DateTimeFormat("es-MX", { timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date()) });
    s.corona.visible = Boolean(lider && s.avatares.has(lider.id));
    s.corona.userData.personaId = lider?.id ?? null;
    const recientes = nuevas(actividades, s.vistas);
    actividades.forEach((x) => s.vistas.add(x.id));
    // En la primera carga solo se muestran las últimas 3, para no saturar la escena.
    const lanzar = s.listo ? recientes : recientes.slice(-3);
    s.listo = true;
    lanzar.forEach((act, i) => {
      const a = s.avatares.get(act.usuarioId);
      if (!a) return;
      setTimeout(() => {
        if (!estado.current) return;
        const b = sprite([{ texto: burbuja(act), color: "#ffffff", tamano: 56, negrita: true }], act.tipo === "cierre" ? "#3F7A24" : "#004AAD", 0.55);
        b.position.y = 2.6; a.grupo.add(b);
        s.efectos.push({ obj: b, nace: performance.now(), vida: 6, tipo: "burbuja" });
        if (act.tipo === "campo") s.llamarPeaton(act.usuarioId);
        if (act.tipo === "cierre" || act.tipo === "verificacion") {
          const lluvia = new THREE.Group(); lluvia.position.set(0, 2.4, 0);
          const vel: THREE.Vector3[] = [];
          for (let k = 0; k < 40; k++) {
            const c = new THREE.Mesh(new THREE.PlaneGeometry(0.08, 0.08), new THREE.MeshBasicMaterial({ color: [0x004aad, 0x5e9e3a, 0xfacc15, 0xef4444][k % 4], side: THREE.DoubleSide }));
            lluvia.add(c); vel.push(new THREE.Vector3((Math.random() - 0.5) * 3, 2 + Math.random() * 2.5, (Math.random() - 0.5) * 3));
          }
          a.grupo.add(lluvia);
          s.efectos.push({ obj: lluvia, nace: performance.now(), vida: 2.5, tipo: "confeti", vel });
        }
      }, i * 1200);
    });
  }, [actividades, personas]);

  const DEPTO: Record<Departamento, string> = { direccion: "Dirección", analisis: "Análisis y verificación", asesores: "Asesor de pensiones", vendedores: "Vendedor", calle: "Gerente de campo" };
  return (
    <div className="relative">
      <div ref={contenedor} className="h-[62vh] min-h-[380px] w-full overflow-hidden rounded-[var(--radius-tarjeta)] border border-borde bg-sky-100" aria-label="Oficina 3D del equipo" role="img" />
      {ficha && (
        <div className="pointer-events-none absolute z-10 w-60 rounded-[var(--radius-boton)] border border-borde bg-surface p-3 text-sm shadow-lg"
          style={{ left: Math.min(ficha.x + 14, ficha.ancho - 250), top: Math.max(ficha.y - 10, 8) }}>
          <p className="font-display font-semibold text-ink">{ficha.p.nombre}</p>
          <p className="text-xs text-ink-muted">{DEPTO[ficha.p.departamento]}{ficha.p.conCuenta ? "" : " · sin cuenta"}</p>
          {ficha.p.resumen?.total ? (
            <ul className="mt-2 grid grid-cols-2 gap-x-3 gap-y-0.5 text-xs">
              <li>Prospectos: <b>{ficha.p.resumen.prospectos}</b></li><li>Verificados: <b>{ficha.p.resumen.verificados}</b></li>
              <li>Avances: <b>{ficha.p.resumen.avances}</b></li><li>Cobrados: <b>{ficha.p.resumen.cierres}</b></li>
            </ul>
          ) : <p className="mt-2 text-xs text-ink-muted">Sin actividad hoy todavía.</p>}
        </div>
      )}
    </div>
  );
}
