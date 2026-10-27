import { describe, expect, it } from "vitest";
import { horaCDMX, hoyCDMX } from "./tiempo";

describe("hora de CDMX", () => {
  it("a las 05:59 UTC todavía es el día anterior en CDMX (UTC−6)", () => {
    expect(hoyCDMX(new Date("2026-10-28T05:59:00Z"))).toBe("2026-10-27");
    expect(hoyCDMX(new Date("2026-10-28T06:00:00Z"))).toBe("2026-10-28");
  });
  it("las 07:00 de CDMX son las 13:00 UTC, en invierno y en verano", () => {
    expect(horaCDMX(new Date("2026-01-15T13:00:00Z"))).toBe("07:00");
    expect(horaCDMX(new Date("2026-07-15T13:00:00Z"))).toBe("07:00");
  });
});
