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

  const targets = input.cart.lines
    // Only include cart lines with a quantity of two or more
    .filter((line) => {
      let discounts = null;
      if (line.quantity > 5) {
        return (discounts = { percentage: 10, id: line.id });
      } else if (line.quantity >= 10) {
        return (discounts = { percentage: 20, id: line.id });
      }
      return discounts;
    })
    .filter((line) => line !== null);
  console.log("targets", targets);

  // if (!targets.length) {
  //   // You can use STDERR for debug logs in your function
  //   console.error("No cart lines qualify for volume discount.");
  //   return EMPTY_DISCOUNT;
  // }

  return {
    discounts: targets.map((discount) => ({
      targets: [{ cartLine: { id: discount.lineId } }],
      value: {
        percentage: {
          value: discount.percentage.toString(),
        },
      },
    })),
    discountApplicationStrategy: DiscountApplicationStrategy.All,
  };
}
