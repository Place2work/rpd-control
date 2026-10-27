import type { Metadata } from "next";
import { DefinirContrasena } from "./definir-contrasena";

export const metadata: Metadata = { title: "Define tu contraseña" };

export default function Contrasena() {
  return <DefinirContrasena />;
}
