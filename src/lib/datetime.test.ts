import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { adelaideToday, calendarDate } from "./datetime";

describe("adelaideToday", () => {
  it("uses Australia/Adelaide calendar date, not UTC", () => {
    // 21 Sep 2026 00:00 ACST = 20 Sep 2026 14:30 UTC
    assert.equal(
      adelaideToday(new Date("2026-09-20T14:30:00.000Z")),
      "2026-09-21",
    );
    // 20 Sep 2026 23:59 ACST = 20 Sep 2026 14:29 UTC
    assert.equal(
      adelaideToday(new Date("2026-09-20T14:29:00.000Z")),
      "2026-09-20",
    );
  });

  it("still uses Adelaide during daylight time (ACDT, UTC+10:30)", () => {
    // 1 Jan 2027 00:00 ACDT = 31 Dec 2026 13:30 UTC
    assert.equal(
      adelaideToday(new Date("2026-12-31T13:30:00.000Z")),
      "2027-01-01",
    );
    assert.equal(
      adelaideToday(new Date("2026-12-31T13:29:00.000Z")),
      "2026-12-31",
    );
  });
});

describe("calendarDate", () => {
  it("extracts YYYY-MM-DD from date or datetime strings", () => {
    assert.equal(calendarDate("2026-09-21"), "2026-09-21");
    assert.equal(calendarDate("2026-09-21T09:00:00"), "2026-09-21");
    assert.equal(calendarDate(" 2026-03-01T09:00:00+10:30 "), "2026-03-01");
    assert.equal(calendarDate(""), null);
    assert.equal(calendarDate(null), null);
    assert.equal(calendarDate("TBC"), null);
  });
});
