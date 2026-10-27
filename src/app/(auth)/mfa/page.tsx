import type { Metadata } from "next";
import { SegundoFactor } from "./segundo-factor";

export const metadata: Metadata = { title: "Verificación en dos pasos" };

export default function Mfa() {
  return <SegundoFactor />;
}
