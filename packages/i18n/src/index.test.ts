import { expect, it } from "vitest";
import { messages } from "./index.ts";

function keys(obj: object, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([k, v]) =>
    typeof v === "object" && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  );
}

it("EN has exactly the LT keys", () => {
  expect(keys(messages.en).sort()).toEqual(keys(messages.lt).sort());
});
