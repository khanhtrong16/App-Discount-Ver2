import { describe, it, expect } from "vitest";
import { run } from "./run";
import { FunctionResult, DiscountApplicationStrategy } from "../generated/api";

/**
 * Helper function to generate input for the run function.
 * Purpose: Easily create test input with custom cart lines and metafield value.
 */
function makeInput({ cartLines = [], metafieldValue = null } = {}) {
  return {
    cart: { lines: cartLines },
    discountNode: {
      metafield: metafieldValue ? { value: metafieldValue } : null,
    },
  };
}
/**
 * Test group: Collection discount
 * Purpose: Test discount application when filtering by collection (excluded collection logic).
 */
describe("Collection discount", () => {
  it("returns discount when product is in the correct collection", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 5,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: { id: "product1", title: "A", inExcludedCollection: true },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: [],
        quantity: { tier01: 1 },
        percentage: { tier01: 10 },
      }),
    });
    const result = run(input);
    expect(result.discounts.length).toBe(1);
    expect(result.discounts[0]?.targets[0]?.cartLine.id).toBe("line1");
  });

  it("returns no discount when product is not in the excluded collection", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 5,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: {
              id: "product1",
              title: "A",
              inExcludedCollection: false,
            },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: [],
        quantity: { tier01: 1 },
        percentage: { tier01: 10 },
      }),
    });
    const result = run(input);
    expect(result.discounts.length).toBe(0);
  });

  it("returns discounts for multiple products in excluded collection", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 5,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: { id: "product1", title: "A", inExcludedCollection: true },
          },
        },
        {
          id: "line2",
          quantity: 3,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant2",
            product: { id: "product2", title: "B", inExcludedCollection: true },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: [],
        quantity: { tier01: 1 },
        percentage: { tier01: 10 },
      }),
    });
    const result = run(input);
    expect(result.discounts.length).toBe(2);
  });
});

/**
 * Test group: Product discount
 * Purpose: Test discount application when filtering by productId.
 */
describe("Product discount", () => {
  it("returns no discount when product is not in productConfigId", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 5,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: {
              id: "product1",
              title: "A",
              inExcludedCollection: false,
            },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: ["product2"],
        quantity: { tier01: 1 },
        percentage: { tier01: 10 },
      }),
    });
    const result = run(input);
    expect(result.discounts.length).toBe(0);
  });

  it("returns discount for only the matching product in productConfigId", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 5,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: {
              id: "product1",
              title: "A",
              inExcludedCollection: false,
            },
          },
        },
        {
          id: "line2",
          quantity: 5,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant2",
            product: {
              id: "product2",
              title: "B",
              inExcludedCollection: false,
            },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: ["product2"],
        quantity: { tier01: 1 },
        percentage: { tier01: 10 },
      }),
    });
    const result = run(input);
    expect(result.discounts.length).toBe(1);
    expect(result.discounts[0]?.targets[0]?.cartLine.id).toBe("line2");
  });
});

/**
 * Test group: Tier discount
 * Purpose: Test discount application based on quantity tiers.
 */
describe("Tier discount", () => {
  it("returns no discount when quantity is less than all tiers", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 1,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: { id: "product1", title: "A", inExcludedCollection: true },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: [],
        quantity: { tier01: 5, tier02: 10 },
        percentage: { tier01: 10, tier02: 20 },
      }),
    });
    const result = run(input);
    expect(result.discounts.length).toBe(0);
  });

  it("applies the highest applicable tier discount", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 12,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: { id: "product1", title: "A", inExcludedCollection: true },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: [],
        quantity: { tier01: 5, tier02: 10 },
        percentage: { tier01: 10, tier02: 20 },
      }),
    });
    const result = run(input);
    expect(result.discounts.length).toBe(1);
    expect(result.discounts[0]?.value.percentage.value).toBe("20");
  });
  // Note: Case where a product belongs to multiple discounts is handled outside the run function,
  // because run only processes one discount configuration at a time.
});
