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

  const discountList = input.cart.lines
    .map((line) => {
      // Sử dụng giá trị từ cấu hình cài đặt
      if (line.quantity >= 5) {
        // Nếu số lượng ≥ 5, tăng thêm 5% so với cấu hình gốc
        return {
          percentage: parseFloat(configuration.percentage) + 50,
          id: line.id,
        };
      } else if (line.quantity >= configuration.quantity) {
        // Nếu số lượng đạt ngưỡng cấu hình (2 sản phẩm), áp dụng % từ cấu hình
        return {
          percentage: parseFloat(configuration.percentage),
          id: line.id,
        };
      }
      return null; // Không đủ số lượng tối thiểu
    })
    .filter((discount) => discount !== null);

  console.log("DiscountList", discountList);

  if (!discountList.length) {
    console.error("No cart lines qualify for volume discount.");
    return EMPTY_DISCOUNT;
  }

  return {
    discounts: discountList.map((discount) => ({
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
