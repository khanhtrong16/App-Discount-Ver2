import { describe, it, expect } from "vitest";
import { run } from "./run";
import { FunctionResult, DiscountApplicationStrategy } from "../generated/api";

// describe("product discounts function", () => {
//   it("returns no discounts without configuration", () => {
//     const result = run({
//       discountNode: {
//         metafield: null,
//       },
//     });
//     const expected: FunctionResult = {
//       discounts: [],
//       discountApplicationStrategy: DiscountApplicationStrategy.First,
//     };
//     expect(result).toEqual(expected);
//   });
// });
describe("product discount function", () => {
  it("returns no discounts without configuration", () => {
    const result = run({
      cart: {
        lines: [
          {
            quantity: 10,
            merchandise: {
              __typename: "ProductVariant",
              id: "gid://shopify/ProductVariant/123456789",
            },
          },
        ],
      },
      discountNode: {
        metafield: null,
      },
    });

    expect(result.discounts.length).toBe(0);
  });
});
