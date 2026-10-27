import * as React from "react";
import { cn } from "@/lib/utils";

// Versión mínima de Radix Slot: pasa clases y props al único hijo.
export function Slot({ children, className, ...props }: React.HTMLAttributes<HTMLElement> & { children?: React.ReactNode }) {
  if (!React.isValidElement<{ className?: string }>(children)) return null;
  return React.cloneElement(children, { ...props, className: cn(className, children.props.className) });
}
