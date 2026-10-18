import { expect, test } from "@playwright/test";
import { addDays, toDay } from "@opulus/core";

/**
 * Calendar days as "YYYY-MM-DD" strings (opulus-core/src/utils/day.ts), in UTC.
 *
 * Test cases:
 * - toDay is the UTC date of a moment, whatever the machine's time zone
 * - addDays moves within a month, over month ends and year ends
 * - addDays knows leap years
 * - addDays goes backwards with a negative count, and zero is the same day
 */
test.describe("days", () => {
  test("toDay is the UTC date of a moment, whatever the machine's time zone", () => {
    expect(toDay(new Date("2026-10-17T00:00:00Z"))).toBe("2026-10-17");
    expect(toDay(new Date("2026-10-17T23:59:59.999Z"))).toBe("2026-10-17");
    // 22:30 at UTC-5 is the next day in UTC.
    expect(toDay(new Date("2026-10-17T22:30:00-05:00"))).toBe("2026-10-18");
  });

  test("addDays moves within a month, over month ends and year ends", () => {
    expect(addDays("2026-10-17", 1)).toBe("2026-10-18");
    expect(addDays("2026-10-31", 1)).toBe("2026-11-01");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2026-01-31", 30)).toBe("2026-03-02");
  });

  test("addDays knows leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2028-02-29", 1)).toBe("2028-03-01");
    expect(addDays("2026-02-28", 1)).toBe("2026-03-01");
    expect(addDays("2026-01-01", 365)).toBe("2027-01-01");
    expect(addDays("2028-01-01", 366)).toBe("2029-01-01");
  });

  test("addDays goes backwards with a negative count, and zero is the same day", () => {
    expect(addDays("2026-03-01", -1)).toBe("2026-02-28");
    expect(addDays("2027-01-01", -1)).toBe("2026-12-31");
    expect(addDays("2026-10-17", 0)).toBe("2026-10-17");
  });
});
