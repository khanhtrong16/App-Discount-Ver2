import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};
function matchProductId(productCartList, productConfigId) {
  return productCartList.filter((line) => {
    if (
      "product" in line.merchandise &&
      line.merchandise &&
      line.merchandise.product &&
      line.merchandise.product.id
    ) {
      const cartProductId = line.merchandise.product.id;
      return productConfigId.includes(cartProductId);
    }
    return false;
  });
}
export function run(input: RunInput): FunctionRunResult {
  // get configuration from metafield
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}",
  );
  if (!configuration.quantity || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }
  const productCarts = input.cart.lines;
  const productConfigId: Array<string> = configuration.productId;

  let productList = null;
  if (productConfigId && productConfigId.length > 0) {
    productList = matchProductId(productCarts, productConfigId);
  } else {
    // Get all products with valid collection
    productList = productCarts.filter((line) => {
      return (
        line.merchandise &&
        line.merchandise.product &&
        line.merchandise.product.inExcludedCollection === true
      );
    });
  }

  const DiscountList = productList
    .map((line) => {
      // Get all tier keys and sort them in descending order
      const tierKeys = Object.keys(configuration.quantity)
        .filter((key) => key.startsWith("tier"))
        .sort((a, b) => {
          // Extract numbers from tier keys (e.g., "tier01" -> 1)
          const numA = parseInt(a.replace("tier", ""));
          const numB = parseInt(b.replace("tier", ""));
          // Sort in descending order (highest tier first)
          return numB - numA;
        });

      // Check each tier starting from the highest
      for (const tierKey of tierKeys) {
        if (line.quantity >= configuration.quantity[tierKey]) {
          return {
            percentage: configuration.percentage[tierKey],
            id: line.id,
          };
        }
      }

      return null;
    })
    .filter((discount) => discount !== null);
  // return list discount with percentage and cartLineId

  return {
    discounts: DiscountList.map((discounts) => ({
      targets: [{ cartLine: { id: discounts.id } }],
      value: {
        percentage: {
          value: discounts.percentage.toString(),
        },
      },
    })),
    discountApplicationStrategy: DiscountApplicationStrategy.All,
  };
}
