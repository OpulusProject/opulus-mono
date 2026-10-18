import { expect, test } from "@playwright/test";
import { fromUnits, Prisma, SCALE, toAmount, toUnits } from "@opulus/core";

/**
 * Money arithmetic (opulus-core/src/utils/money.ts): amounts are added as whole
 * units of 1/10,000 so sums do not drift the way floats do.
 *
 * Test cases:
 * - toUnits turns an amount into whole units, rounding to the nearest
 * - fromUnits turns whole units back into an amount
 * - adding in whole units is exact where adding floats is not
 * - rounding is to the nearest unit, in both directions of sign
 * - toAmount rounds a Decimal to four places
 */
test.describe("money", () => {
  test("toUnits turns an amount into whole units, rounding to the nearest", () => {
    expect(SCALE).toBe(10_000);
    expect(toUnits(12.5)).toBe(125_000);
    expect(toUnits(0.0001)).toBe(1);
    expect(toUnits(0.00004)).toBe(0);
    expect(toUnits(0.00005)).toBe(1);
    expect(toUnits(0)).toBe(0);
  });

  test("fromUnits turns whole units back into an amount", () => {
    expect(fromUnits(125_000)).toBe(12.5);
    expect(fromUnits(1)).toBe(0.0001);
    expect(fromUnits(toUnits(1234.5678))).toBe(1234.5678);
  });

  test("adding in whole units is exact where adding floats is not", () => {
    expect(0.1 + 0.2).not.toBe(0.3);

    expect(fromUnits(toUnits(0.1) + toUnits(0.2))).toBe(0.3);
    expect(fromUnits([0.1, 0.7, 0.2, 0.01].map(toUnits).reduce((a, b) => a + b))).toBe(1.01);
  });

  test("rounding is to the nearest unit, in both directions of sign", () => {
    expect(toUnits(-12.5)).toBe(-125_000);
    expect(toUnits(1.23456)).toBe(12_346);
    expect(toUnits(-1.23454)).toBe(-12_345);
  });

  test("toAmount rounds a Decimal to four places", () => {
    expect(toAmount(new Prisma.Decimal("1.23456789"))).toBe(1.2346);
    expect(toAmount(new Prisma.Decimal("1.23454"))).toBe(1.2345);
    expect(toAmount(new Prisma.Decimal("-0.00005"))).toBe(-0.0001);
    expect(toAmount(new Prisma.Decimal("100"))).toBe(100);
  });
});
