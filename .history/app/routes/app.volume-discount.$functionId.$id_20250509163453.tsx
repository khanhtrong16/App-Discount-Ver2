import { useEffect, useMemo } from "react";
import { ActionFunction, json, LoaderFunction } from "@remix-run/node";
import { useForm, useField } from "@shopify/react-form";
import { CurrencyCode } from "@shopify/react-i18n";
import {
  Form,
  useActionData,
  useNavigation,
  useSubmit,
  useLoaderData,
} from "@remix-run/react";
import {
  ActiveDatesCard,
  CombinationCard,
  DiscountClass,
  DiscountMethod,
  MethodCard,
  DiscountStatus,
  RequirementType,
  SummaryCard,
  UsageLimitsCard,
} from "@shopify/discount-app-components";
import {
  Banner,
  Card,
  Text,
  Layout,
  Page,
  PageActions,
  TextField,
  BlockStack,
  Box,
} from "@shopify/polaris";

import { authenticate } from "../shopify.server";

type LoaderData = {
  discount: {
    title: string;
    status: string;
    usageLimit: number | null;
    appliesOncePerCustomer: boolean;
    startsAt: string;
    endsAt: string | null;
    combinesWith: {
      orderDiscounts: boolean;
      productDiscounts: boolean;
      shippingDiscounts: boolean;
    };
    appDiscountType: {
      title: string;
    };
    codes?: {
      nodes: Array<{ code: string }>;
    };
  };
  metafield: {
    namespace: string;
    key: string;
    type: string;
    value: string;
  } | null;
};

export const loader: LoaderFunction = async ({ request, params }) => {
  const { id } = params;
  const { admin } = await authenticate.admin(request);
  const response = await admin.graphql(
    `#graphql
   query GetDiscount($id: ID!) {
    discountNode(id: $id) {
      id
      discount {
        ... on DiscountCodeApp {
          title
          status
          usageLimit
          appliesOncePerCustomer
          startsAt
          endsAt
          combinesWith {
            orderDiscounts
            productDiscounts
            shippingDiscounts
          }
          appDiscountType {
            title
          }
          codes(first: 1) {
            nodes {
              code
            }
          }
        }
        ... on DiscountAutomaticApp {
          title
          status
          startsAt
          endsAt
          combinesWith {
            orderDiscounts
            productDiscounts
            shippingDiscounts
          }
          appDiscountType {
            title
          }
        }
      }
      metafields(namespace: "$app:volume-discount", first: 1) {
        edges {
          node {
            namespace
            key
            type
            value
          }
        }
      }
    }
  }`,
    {
      variables: {
        id: `gid://shopify/DiscountNode/${id}`,
      },
    },
  );

  const text = await response.text();
  const responseJson = JSON.parse(text);
  const discountNode = responseJson.data.discountNode;
  const metafield = discountNode.metafields.edges[0]?.node;
  const discount = discountNode.discount;

  return json({
    discount,
    metafield,
  });
};

export const action: ActionFunction = async ({ request, params }) => {
  // TODO: Implement the update functionality by:
  // 1. Parse the form data
  // 2. Create GraphQL mutation to update the discount
  // 3. Update the discount metafields with the new configuration
  // 4. Return success or error response

  const { functionId, id } = params; // cần truyền thêm discountId từ route
  const { admin } = await authenticate.admin(request);
  const formData = await request.formData();
  const {
    title,
    method,
    code,
    combinesWith,
    usageLimit,
    appliesOncePerCustomer,
    startsAt,
    endsAt,
    configuration,
  } = JSON.parse(formData.get("discount") as string);

  const baseDiscount = {
    // id: `gid://shopify/DiscountNode/${id}`, // thêm id để cập nhật
    functionId,
    title,
    combinesWith,
    startsAt: new Date(startsAt),
    endsAt: endsAt && new Date(endsAt),
  };

  const metafields = [
    {
      namespace: "$app:volume-discount",
      key: "function-configuration",
      type: "json",
      value: JSON.stringify({
        quantity: configuration.quantity,
        percentage: configuration.percentage,
      }),
    },
  ];

  if (method === DiscountMethod.Code) {
    const baseCodeDiscount = {
      ...baseDiscount,
      title: code,
      code,
      usageLimit,
      appliesOncePerCustomer,
    };

    const response = await admin.graphql(
      `#graphql
      mutation UpdateCodeDiscount($id: ID!, $discount: DiscountCodeAppInput!) {
        discountUpdate: discountCodeAppUpdate(id: $id, codeAppDiscount: $discount) {
          codeAppDiscount {
            discountId
          }
          userErrors {
            code
            message
            field
          }
        }
      }`,
      {
        variables: {
          id: `gid://shopify/DiscountCodeNode/${id}`,
          discount: {
            ...baseCodeDiscount,
            metafields,
          },
        },
      },
    );

    const responseJson = await response.json();
    const errors = responseJson.data.discountUpdate?.userErrors;
    const discount = responseJson.data.discountUpdate?.codeAppDiscount;
    return json({ errors, discount: { ...discount, functionId } });
  } else {
    const response = await admin.graphql(
      `#graphql
      mutation UpdateAutomaticDiscount($id: ID!, $discount: DiscountAutomaticAppInput!) {
        discountUpdate: discountAutomaticAppUpdate(id: $id, automaticAppDiscount: $discount) {
          automaticAppDiscount {
            discountId
          }
          userErrors {
            code
            message
            field
          }
        }
      }`,
      {
        variables: {
          id: `gid://shopify/DiscountAutomaticNode/${id}`,
          discount: {
            ...baseDiscount,
            metafields,
          },
        },
      },
    );

    const responseJson = await response.json();
    const errors = responseJson.data.discountUpdate?.userErrors;
    return json({ errors });
  }
};

export default function VolumeEdit() {
  const submitForm = useSubmit();
  const actionData = useActionData<{
    errors?: Array<{ message: string; field: string[] }>;
    discount?: any;
  }>();
  const navigation = useNavigation();
  const todaysDate = useMemo(() => new Date().toISOString(), []);
  const { discount, metafield } = useLoaderData<LoaderData>();

  // Parse the metafield JSON value
  const metafieldConfig = useMemo(() => {
    if (metafield && metafield.value) {
      try {
        return JSON.parse(metafield.value);
      } catch (error) {
        console.error("Failed to parse metafield value:", error);
        return null;
      }
    }
    return null;
  }, [metafield]);

  const isLoading = navigation.state === "submitting";
  const currencyCode = CurrencyCode.Cad;
  const submitErrors = actionData?.errors || [];
  const returnToDiscounts = () => open("shopify://admin/discounts", "_top");

  useEffect(() => {
    if (actionData?.errors?.length === 0 && actionData?.discount) {
      returnToDiscounts();
    }
  }, [actionData]);

  const {
    fields: {
      discountTitle,
      discountCode,
      discountMethod,
      combinesWith,
      requirementType,
      requirementSubtotal,
      requirementQuantity,
      usageLimit,
      appliesOncePerCustomer,
      startDate,
      endDate,
      configuration,
    },
    submit,
  } = useForm({
    fields: {
      discountTitle: useField(discount?.title || ""),
      discountMethod: useField(
        discount?.codes ? DiscountMethod.Code : DiscountMethod.Automatic,
      ),
      discountCode: useField(discount?.codes?.nodes?.[0]?.code || ""),
      combinesWith: useField({
        orderDiscounts: discount?.combinesWith?.orderDiscounts || false,
        productDiscounts: discount?.combinesWith?.productDiscounts || false,
        shippingDiscounts: discount?.combinesWith?.shippingDiscounts || false,
      }),
      requirementType: useField(RequirementType.None),
      requirementSubtotal: useField("0"),
      requirementQuantity: useField("0"),
      usageLimit: useField(discount?.usageLimit?.toString() || null),
      appliesOncePerCustomer: useField(
        discount?.appliesOncePerCustomer || false,
      ),
      startDate: useField(discount?.startsAt || todaysDate),
      endDate: useField(discount?.endsAt || null),
      configuration: {
        quantity: useField(metafieldConfig?.quantity?.toString() || "1"),
        percentage: useField(metafieldConfig?.percentage?.toString() || "0"),
      },
    },
    onSubmit: async (form) => {
      const discount = {
        title: form.discountTitle,
        method: form.discountMethod,
        code: form.discountCode,
        combinesWith: form.combinesWith,
        usageLimit: form.usageLimit == null ? null : parseInt(form.usageLimit),
        appliesOncePerCustomer: form.appliesOncePerCustomer,
        startsAt: form.startDate,
        endsAt: form.endDate,
        configuration: {
          quantity: parseInt(form.configuration.quantity),
          percentage: parseFloat(form.configuration.percentage),
        },
      };

      submitForm({ discount: JSON.stringify(discount) }, { method: "post" });

      return { status: "success" };
    },
  });

  const errorBanner =
    submitErrors.length > 0 ? (
      <Layout.Section>
        <Banner tone="critical">
          <p>There were some issues with your form submission:</p>
          <ul>
            {submitErrors.map(({ message, field }, index) => {
              return (
                <li key={`${message}${index}`}>
                  {field.join(".")} {message}
                </li>
              );
            })}
          </ul>
        </Banner>
      </Layout.Section>
    ) : null;

  return (
    <Page>
      <ui-title-bar title="Update volume discount">
        <button variant="breadcrumb" onClick={returnToDiscounts}>
          Discounts
        </button>
        <button variant="primary" onClick={submit}>
          Update discount
        </button>
      </ui-title-bar>
      <Layout>
        {errorBanner}
        <Layout.Section>
          <Form method="post">
            <BlockStack align="space-around" gap="200">
              <MethodCard
                title="Volume"
                discountTitle={discountTitle}
                discountClass={DiscountClass.Product}
                discountCode={discountCode}
                discountMethod={discountMethod}
              />
              <Box paddingBlockEnd="300">
                <Card>
                  <BlockStack>
                    <Text variant="headingMd" as="h2">
                      Volume
                    </Text>
                    <TextField
                      label="Minimum quantity"
                      autoComplete="on"
                      {...configuration.quantity}
                    />
                    <TextField
                      label="Discount percentage"
                      autoComplete="on"
                      {...configuration.percentage}
                      suffix="%"
                    />
                  </BlockStack>
                </Card>
              </Box>
              {discountMethod.value === DiscountMethod.Code && (
                <UsageLimitsCard
                  totalUsageLimit={usageLimit}
                  oncePerCustomer={appliesOncePerCustomer}
                />
              )}
              <CombinationCard
                combinableDiscountTypes={combinesWith}
                discountClass={DiscountClass.Product}
                discountDescriptor={"Discount"}
              />
              <ActiveDatesCard
                startDate={startDate as any}
                endDate={endDate as any}
                timezoneAbbreviation="EST"
              />
            </BlockStack>
          </Form>
        </Layout.Section>
        <Layout.Section variant="oneThird">
          <SummaryCard
            header={{
              discountMethod: discountMethod.value,
              discountDescriptor:
                discountMethod.value === DiscountMethod.Automatic
                  ? discountTitle.value
                  : discountCode.value,
              appDiscountType: "Volume",
              isEditing: true,
              discountStatus: DiscountStatus.Scheduled,
            }}
            performance={{
              status: DiscountStatus.Scheduled,
              usageCount: 0,
            }}
            minimumRequirements={{
              requirementType: requirementType.value,
              subtotal: requirementSubtotal.value,
              quantity: requirementQuantity.value,
              currencyCode: currencyCode,
            }}
            usageLimits={{
              oncePerCustomer: appliesOncePerCustomer.value,
              totalUsageLimit: usageLimit.value,
            }}
            activeDates={{
              startDate: startDate.value as any,
              endDate: endDate.value as any,
            }}
          />
        </Layout.Section>
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Update discount",
              onAction: submit,
              loading: isLoading,
            }}
            secondaryActions={[
              {
                content: "Discard",
                onAction: returnToDiscounts,
              },
            ]}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
