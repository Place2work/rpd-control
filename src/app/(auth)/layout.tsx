import { Marca } from "@/components/rpd/marca";

export default function LayoutAuth({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-8 px-4 py-10">
      <Marca className="scale-125" />
      <div className="w-full max-w-sm">{children}</div>
      <p className="text-center text-xs text-ink-muted">Uso interno · datos personales protegidos (LFPDPPP)</p>
    </main>
  );
}
