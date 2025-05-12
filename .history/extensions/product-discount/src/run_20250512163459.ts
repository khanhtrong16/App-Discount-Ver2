import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

export function run(input: RunInput): FunctionRunResult {
  console.log("input đây:", JSON.stringify(input, null, 2));

  // get configuration from metafield
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}",
  );
  if (!configuration.quantity || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }
  const productCarts = input.cart.lines;
  const productConfigId: Array<string> = configuration.productId;
  console.log("productConfigId", productConfigId);

  let productList = null;
  if (parseInt(productConfigId.length) > 0) {
    console.log("productConfigId.length", productConfigId.length);

    console.log("a");

    productList = productCarts.filter((line) => {
      if ("product" in line.merchandise) {
        const cartProductId = line.merchandise.product.id;
        return productConfigId.includes(cartProductId);
      }
      return false;
    });
  } else {
    console.log("n");

    productList = productCarts.filter((line) => {
      return line.merchandise.product.inExcludedCollection == true;
    });
  }
  //** Check product in cart */
  // get list product in cart with id match configuration.productId

  // console.log("matchingProducts", JSON.stringify(matchingProducts, null, 2));

  //** Check collection in cart */
  // const matchingCollection = productCarts.filter((line) => {
  //   return line.merchandise.product.inExcludedCollection == true;
  // });
  // console.log(
  //   "matchingCollection",
  //   JSON.stringify(matchingCollection, null, 2),
  // );
  // get list discount with quantity match configuration.quantity
  // check quantity of product in cart with id match configuration.productId
  console.log("productList", JSON.stringify(productList, null, 2));

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
