import { Logger } from "@nestjs/common";
import { spyOn } from "bun:test";

/** Suppresses Nest error/warn logs when a test intentionally triggers failure paths. */
export function silenceNestLogger(): () => void {
  const errorSpy = spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  const warnSpy = spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

  return () => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  };
}
