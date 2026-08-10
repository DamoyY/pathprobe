import assert from "node:assert/strict";
import { test } from "node:test";
import { findExistingPaths, MAX_LEVEL } from "../../dist/index.mjs";

test("rejects a standalone slash at every search level", async () => {
  const inputs = ["/", '"/"', "/:12"];
  const resultsByLevel = await Promise.all(
    Array.from({ length: MAX_LEVEL }, (_, index) =>
      Promise.all(
        inputs.map((text) =>
          findExistingPaths({
            directories: [process.cwd()],
            level: index + 1,
            respectIgnore: false,
            searchHidden: true,
            text,
          }),
        ),
      ),
    ),
  );
  for (const [index, results] of resultsByLevel.entries()) {
    assert.deepEqual(
      results,
      inputs.map(() => []),
      `level ${index + 1}`,
    );
  }
});
