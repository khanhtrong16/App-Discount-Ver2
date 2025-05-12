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

// Helper để tạo input cho run
function makeInput({ cartLines = [], metafieldValue = null } = {}) {
  return {
    cart: { lines: cartLines },
    discountNode: {
      metafield: metafieldValue ? { value: metafieldValue } : null,
    },
  };
}

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
    expect(result.discounts[0].targets[0].cartLine.id).toBe("line1");
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
    expect(result.discounts[0].targets[0].cartLine.id).toBe("line2");
  });
});

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
    expect(result.discounts[0].value.percentage.value).toBe("20");
  });

  it("applies correct discount when tier01 quantity is higher than tier02", () => {
    const input = makeInput({
      cartLines: [
        {
          id: "line1",
          quantity: 7,
          merchandise: {
            __typename: "ProductVariant",
            id: "variant1",
            product: { id: "product1", title: "A", inExcludedCollection: true },
          },
        },
      ],
      metafieldValue: JSON.stringify({
        productId: [],
        quantity: { tier01: 10, tier02: 5 },
        percentage: { tier01: 10, tier02: 20 },
      }),
    });
    const result = run(input);
    // tier02 sẽ được áp dụng vì quantity >= 5 (tier02) nhưng < 10 (tier01)
    expect(result.discounts.length).toBe(1);
    expect(result.discounts[0].value.percentage.value).toBe("20");
  });

  // Trường hợp một sản phẩm thuộc nhiều discount khác nhau sẽ phụ thuộc vào logic ngoài hàm run,
  // vì hàm run chỉ xử lý 1 cấu hình discount tại một thời điểm.
});
