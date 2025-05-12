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
  console.log("ArrayProductId", JSON.stringify(ArrayProductId, null, 2));
  // get list product in cart with id match configuration.productId
  let productCartId = "";

  // const productList = productCarts.map((line) => {
  //   productCartId = line.merchandise.product.id;
  //   ArrayProductId.filter((item: any) => item == productCartId);
  //   // line.merchandise.product.id == productId,
  // });
  let matchingProducts = productCarts.filter((line) => {
    if (
      // line.merchandise.__typename === "ProductVariant" &&
      "product" in line.merchandise
    ) {
      const cartProductId = line.merchandise.product.id;
      return ArrayProductId.includes(cartProductId);
    }
    return false;
  });

  console.log("c", JSON.stringify(matchingProducts, null, 2));

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
