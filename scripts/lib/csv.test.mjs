import { test } from "node:test";
import assert from "node:assert/strict";
import { parseCsv, readTable, toCsv } from "./csv.mjs";

test("csv handles quotes, commas, newlines and round-trips", () => {
  const rows = [["a", "b"], ["x, y", 'she said "hi"'], ["line1\nline2", ""]];
  assert.deepEqual(parseCsv(toCsv(rows)), [["a", "b"], ["x, y", 'she said "hi"'], ["line1\nline2", ""]]);
  assert.deepEqual(readTable("﻿id,name\r\n1, Eega \r\n\r\n"), [{ id: "1", name: "Eega" }]);
});
