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

  const productId = ArrayProductId.map((item: any) => item);
  // console.log("productCarts", JSON.stringify(productCarts, null, 2));

  console.log("listID : ", productId);

  // get list product in cart with id match configuration.productId
  const productList = productCarts.filter(
    (line) => line.merchandise.product.id == productId,
  );
  console.log("productList", JSON.stringify(productList, null, 2));

  // get list discount with quantity match configuration.quantity
  // check quantity of product in cart with id match configuration.productId
  const DiscountList = productList
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
