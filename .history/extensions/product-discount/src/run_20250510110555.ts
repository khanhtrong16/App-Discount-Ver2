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
  let discountPrencentage = 0;

  const targets = input.cart.lines
    // Only include cart lines with a quantity of two or more
    .filter((line) => {
      if (line.quantity > 5) {
        return discounts;
      }
    })
    .map((line) => {
      return /** @type {Target} */ {
        // Use the cart line ID to create a discount target
        cartLine: {
          id: line.id,
        },
      };
    });
  console.log("targets", targets);

  if (!targets.length) {
    // You can use STDERR for debug logs in your function
    console.error("No cart lines qualify for volume discount.");
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: [
      {
        // Apply the discount to the collected targets
        targets,
        // Define a percentage-based discount
        value: {
          percentage: {
            value: configuration.percentage.toString(),
          },
        },
      },
    ],
    discountApplicationStrategy: DiscountApplicationStrategy.First,
  };
}
