import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

// type Configuration = {};

export function run(input: RunInput): FunctionRunResult {
  // console.log("input đây:", JSON.stringify(input, null, 2));

  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}",
  );
  console.log("configuration", configuration.productId);

  if (!configuration.quantity || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }
  console.log("configuration", configuration);
  console.log("lines", input.cart.lines);
  const productCart = input.cart.lines;
  const productCartList = productCart.filter(
    (line) => line.merchandise.product.id == configuration.productId,
  );
  console.log("productCart", JSON.stringify(productCart, null, 2));
  console.log("productCartList", JSON.stringify(productCartList, null, 2));

  const DiscountList = productCartList
    .map((line) => {
      if (line.quantity >= 10) {
        return { percentage: 100, id: line.id };
      } else if (line.quantity > 5) {
        return { percentage: 60, id: line.id };
      } else if (line.quantity >= configuration.quantity) {
        return { percentage: configuration.percentage, id: line.id };
      }
      return null;
    })
    .filter((discount) => discount !== null);
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
