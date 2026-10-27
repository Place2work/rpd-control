import type { Metadata } from "next";
import { RecibirLiga } from "./recibir-liga";

export const metadata: Metadata = { title: "Verificando tu liga" };

export default function Callback() {
  return <RecibirLiga />;
}
