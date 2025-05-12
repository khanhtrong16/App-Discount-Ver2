import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

export function run(input: RunInput): FunctionRunResult {
  // get configuration from metafield
  // console.log("input đây: ", JSON.stringify(input, null, 2));
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}",
  );
  // console.log("configuration đây: ", JSON.stringify(configuration, null, 2));
  if (!configuration.quantity || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }
  const productCarts = input.cart.lines;
  console.log("configuration", JSON.stringify(configuration, null, 2));
  const ArrayProductId = configuration.productId;
  console.log("ArrayProductId", ArrayProductId);

  const productId = ArrayProductId.map((item: any) => item);
  // console.log("productCarts", JSON.stringify(productCarts, null, 2));

  console.log("listID : ", typeof productId);

  // Filter products that match the product IDs in ArrayProductId
  const matchingProducts = productCarts.filter((line) => {
    // Check if the merchandise is a ProductVariant and has product property
    if (
      line.merchandise.__typename === "ProductVariant" &&
      "product" in line.merchandise
    ) {
      const cartProductId = line.merchandise.product.id;
      return ArrayProductId.includes(cartProductId);
    }
    return false;
  });

  // Extract just the IDs from the matching products
  const matchingProductIds = matchingProducts
    .map((line) => {
      if (
        line.merchandise.__typename === "ProductVariant" &&
        "product" in line.merchandise
      ) {
        return line.merchandise.product.id;
      }
      return "";
    })
    .filter((id) => id !== "");

  console.log(
    "Matching Product IDs:",
    JSON.stringify(matchingProductIds, null, 2),
  );

  // get list discount with quantity match configuration.quantity
  // check quantity of product in cart with id match configuration.productId
  const DiscountList = matchingProducts
    .map((line) => {
      if (line.quantity >= configuration.quantity.tier03) {
        return {
          percentage: configuration.percentage.tier03,
          id: line.id,
        };
      } else if (line.quantity >= configuration.quantity.tier02) {
        return {
          percentage: configuration.percentage.tier02,
          id: line.id,
        };
      } else if (line.quantity >= configuration.quantity.tier01) {
        return {
          percentage: configuration.percentage.tier01,
          id: line.id,
        };
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
