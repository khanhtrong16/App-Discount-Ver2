import type { RunInput, FunctionRunResult } from "../generated/api";
import { DiscountApplicationStrategy } from "../generated/api";

const EMPTY_DISCOUNT: FunctionRunResult = {
  discountApplicationStrategy: DiscountApplicationStrategy.First,
  discounts: [],
};

// type Configuration = {};

export function run(input: RunInput): FunctionRunResult {
  const configuration = JSON.parse(
    input?.discountNode?.metafield?.value ?? "{}",
  );
  if (!configuration.quantity || !configuration.percentage) {
    return EMPTY_DISCOUNT;
  }

  const DiscountList = input.cart.lines
    // Only include cart lines with a quantity of two or more
    .map((line) => {
      if (line.quantity > 5) {
        return { percentage: 10, id: line.id };
      } else if (line.quantity >= 10) {
        return { percentage: 20, id: line.id };
      }
      return null;
    })
    .filter((discount) => discount !== null);
  console.log("DiscountList", DiscountList);

  // if (!DiscountList.length) {
  //   // You can use STDERR for debug logs in your function
  //   console.error("No cart lines qualify for volume discount.");
  //   return EMPTY_DISCOUNT;
  // }

  return {
    discounts: DiscountList.map((discount) => ({
      targets: [{ cartLine: { id: discount.id } }],
      value: {
        percentage: {
          value: discount.percentage.toString(),
        },
      },
    })),
    discountApplicationStrategy: DiscountApplicationStrategy.All,
  };
}
