import { expect, it } from "vitest";
import { calculateLandedCost } from "./index.ts";

it("is a stub until M5", () => {
  expect(() => calculateLandedCost({ source: "copart", bidUsdCents: 0, yardCode: "x" })).toThrow(
    /M5/,
  );
});
