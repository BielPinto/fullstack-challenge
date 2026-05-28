import { Logger } from "@nestjs/common";
import { spyOn } from "bun:test";

export function silenceNestLogger(): () => void {
  const errorSpy = spyOn(Logger.prototype, "error").mockImplementation(() => undefined);
  const warnSpy = spyOn(Logger.prototype, "warn").mockImplementation(() => undefined);

  return () => {
    errorSpy.mockRestore();
    warnSpy.mockRestore();
  };
}
