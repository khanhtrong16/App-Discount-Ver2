import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

export function run(input: RunInput): FunctionRunResult {
  // get configuration from metafield
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}",
  );
  // console.log("configuration đây: ", JSON.stringify(configuration, null, 2));
  if (!configuration.quantity || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }
  const productCarts = input.cart.lines;
  // console.log("configuration", JSON.stringify(configuration, null, 2));
  const productConfigId = configuration.productId;
  const collectionConfigId = configuration.collectionId;
  console.log("productConfigId", productConfigId);

  // console.log("ArrayProductId", JSON.stringify(productConfigId, null, 2));
  //** Check product in cart */
  // get list product in cart with id match configuration.productId
  // let matchingProducts = productCarts.filter((line) => {
  //   if ("product" in line.merchandise) {
  //     const cartProductId = line.merchandise.product.id;
  //     return productConfigId.includes(cartProductId);
  //   }
  //   return false;
  // });

  //** Check collection in cart */
  const matchingCollection = productCarts.filter((line) => {
    if ("product" in line.merchandise) {
      const cartProductId = line.merchandise.product.id;
      return collectionConfigId.includes(cartProductId);
    }
    return false;
  });
  // console.log("c", JSON.stringify(matchingProducts, null, 2));

  // get list discount with quantity match configuration.quantity
  // check quantity of product in cart with id match configuration.productId
  const DiscountList = matchingCollection
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
  // console.log("DiscountList", JSON.stringify(DiscountList, null, 2));

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
