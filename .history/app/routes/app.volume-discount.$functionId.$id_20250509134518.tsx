import { useEffect, useMemo } from "react";
import { ActionFunction, LoaderFunction, json } from "@remix-run/node";
import { useForm, useField } from "@shopify/react-form";
import { CurrencyCode } from "@shopify/react-i18n";
import {
  Form,
  useActionData,
  useNavigation,
  useSubmit,
  useLoaderData,
  useParams,
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

import shopify from "../shopify.server";

// Type for discount data returned by loader
interface DiscountData {
  id: string;
  functionId: string;
  title: string;
  method: DiscountMethod;
  code?: string;
  usageLimit?: number | null;
  appliesOncePerCustomer?: boolean;
  startsAt: string;
  endsAt: string | null;
  status: string;
  combinesWith: {
    orderDiscounts: boolean;
    productDiscounts: boolean;
    shippingDiscounts: boolean;
  };
  configuration: {
    quantity: number;
    percentage: number;
  };
}

export const loader: LoaderFunction = async ({ params, request }) => {
  const { id, functionId } = params;
  
  if (!id || !functionId) {
    return json({ discount: null, error: "Missing discount ID or function ID" });
  }
  
  const { admin } = await shopify.authenticate.admin(request);

  // Determine if this is a code discount or automatic discount
  const discountType = id.startsWith("gid://shopify/DiscountCodeApp/")
    ? "code"
    : "automatic";

  // Query the discount data
  if (discountType === "code") {
    const response = await admin.graphql(
      `#graphql
      query GetCodeDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          codeDiscount {
            ... on DiscountCodeApp {
              title
              summary
              startsAt
              endsAt
              status
              codes(first: 1) {
                nodes {
                  code
                }
              }
              usageLimit
              appliesOncePerCustomer
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
            }
          }
          metafield(namespace: "$app:volume-discount", key: "function-configuration") {
            value
          }
        }
      }`,
      {
        variables: { id },
      }
    );

    const responseJson = await response.json();
    const discountNode = responseJson.data?.discountNode;
    
    if (!discountNode) {
      return json({ discount: null, error: "Discount not found" });
    }

    const codeDiscount = discountNode.codeDiscount;
    const metafieldValue = discountNode.metafield?.value
      ? JSON.parse(discountNode.metafield.value)
      : { quantity: 1, percentage: 0 };

    return json({
      discount: {
        id: discountNode.id,
        functionId,
        title: codeDiscount.title,
        method: DiscountMethod.Code,
        code: codeDiscount.codes?.nodes[0]?.code || "",
        usageLimit: codeDiscount.usageLimit,
        appliesOncePerCustomer: codeDiscount.appliesOncePerCustomer,
        startsAt: codeDiscount.startsAt,
        endsAt: codeDiscount.endsAt,
        status: codeDiscount.status,
        combinesWith: codeDiscount.combinesWith || {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
        configuration: metafieldValue,
      },
    });
  } else {
    const response = await admin.graphql(
      `#graphql
      query GetAutomaticDiscount($id: ID!) {
        discountNode(id: $id) {
          id
          automaticDiscount {
            ... on DiscountAutomaticApp {
              title
              startsAt
              endsAt
              status
              combinesWith {
                orderDiscounts
                productDiscounts
                shippingDiscounts
              }
            }
          }
          metafield(namespace: "$app:volume-discount", key: "function-configuration") {
            value
          }
        }
      }`,
      {
        variables: { id },
      }
    );

    const responseJson = await response.json();
    const discountNode = responseJson.data?.discountNode;
    
    if (!discountNode) {
      return json({ discount: null, error: "Discount not found" });
    }

    const automaticDiscount = discountNode.automaticDiscount;
    const metafieldValue = discountNode.metafield?.value
      ? JSON.parse(discountNode.metafield.value)
      : { quantity: 1, percentage: 0 };

    return json({
      discount: {
        id: discountNode.id,
        functionId,
        title: automaticDiscount.title,
        method: DiscountMethod.Automatic,
        startsAt: automaticDiscount.startsAt,
        endsAt: automaticDiscount.endsAt,
        status: automaticDiscount.status,
        combinesWith: automaticDiscount.combinesWith || {
          orderDiscounts: false,
          productDiscounts: false,
          shippingDiscounts: false,
        },
        configuration: metafieldValue,
      },
    });
  }
};

export const action: ActionFunction = async ({ params, request }) => {
  const { id, functionId } = params;
  
  if (!id || !functionId) {
    return json({ errors: [{ message: "Missing discount ID or function ID", field: ["params"] }] });
  }
  
  const { admin } = await shopify.authenticate.admin(request);
  const formData = await request.formData();
  const discountJson = formData.get("discount");
  
  if (!discountJson || typeof discountJson !== "string") {
    return json({ 
      errors: [{ 
        message: "Missing or invalid discount data", 
        field: ["discount"] 
      }] 
    });
  }
  
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
  } = JSON.parse(discountJson);

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

  // Determine if this is a code discount or automatic discount based on the ID
  const discountType = id.startsWith("gid://shopify/DiscountCodeApp/")
    ? "code"
    : "automatic";

  if (discountType === "code") {
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
          id,
          discount: {
            title: code, // For code discounts, title must match code
            functionId,
            combinesWith,
            startsAt: new Date(startsAt),
            endsAt: endsAt && new Date(endsAt),
            code,
            usageLimit: usageLimit == null ? null : parseInt(usageLimit),
            appliesOncePerCustomer,
            metafields,
          },
        },
      }
    );

    const responseJson = await response.json();
    const errors = responseJson.data?.discountUpdate?.userErrors || [];
    const discount = responseJson.data?.discountUpdate?.codeAppDiscount;
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
          id,
          discount: {
            title,
            functionId,
            combinesWith,
            startsAt: new Date(startsAt),
            endsAt: endsAt && new Date(endsAt),
            metafields,
          },
        },
      }
    );

    const responseJson = await response.json();
    const errors = responseJson.data?.discountUpdate?.userErrors || [];
    const discount = responseJson.data?.discountUpdate?.automaticAppDiscount;
    return json({ errors, discount: { ...discount, functionId } });
  }
};

export default function VolumeEdit() {
  const submitForm = useSubmit();
  const actionData = useActionData<{ errors: any[]; discount: any }>();
  const loaderData = useLoaderData<{ discount: DiscountData | null; error?: string }>();
  const navigation = useNavigation();
  const todaysDate = useMemo(() => new Date(), []);

  const isLoading = navigation.state === "submitting";
  const currencyCode = CurrencyCode.Cad;
  const submitErrors = actionData?.errors || [];
  const returnToDiscounts = () => open("shopify://admin/discounts", "_top");
  
  const discountData = loaderData.discount;
  const isEditing = Boolean(discountData);

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
      discountTitle: useField(discountData?.title || ""),
      discountMethod: useField(discountData?.method || DiscountMethod.Code),
      discountCode: useField(discountData?.code || ""),
      combinesWith: useField(discountData?.combinesWith || {
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: false,
      }),
      requirementType: useField(RequirementType.None),
      requirementSubtotal: useField("0"),
      requirementQuantity: useField("0"),
      usageLimit: useField(discountData?.usageLimit === undefined ? null : String(discountData?.usageLimit)),
      appliesOncePerCustomer: useField(discountData?.appliesOncePerCustomer || false),
      startDate: useField(discountData?.startsAt ? new Date(discountData.startsAt) : todaysDate),
      endDate: useField(discountData?.endsAt ? new Date(discountData.endsAt) : null),
      configuration: {
        quantity: useField(String(discountData?.configuration?.quantity || 1)),
        percentage: useField(String(discountData?.configuration?.percentage || 0)),
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
            {submitErrors.map(({ message, field }: { message: string; field: string[] }, index: number) => {
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

  // Display error if discount not found
  if (loaderData.error) {
    return (
      <Page>
        <Layout>
          <Layout.Section>
            <Banner tone="critical">
              <p>{loaderData.error}</p>
            </Banner>
            <div style={{ marginTop: "1rem" }}>
              <button onClick={returnToDiscounts}>Return to Discounts</button>
            </div>
          </Layout.Section>
        </Layout>
      </Page>
    );
  }

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
                startDate={startDate}
                endDate={endDate}
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
              discountStatus: discountData?.status || DiscountStatus.Scheduled,
            }}
            performance={{
              status: discountData?.status || DiscountStatus.Scheduled,
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
              startDate: startDate.value,
              endDate: endDate.value,
            }}
          />
        </Layout.Section>
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Save discount",
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

            }}
            usageLimits={{
              oncePerCustomer: appliesOncePerCustomer.value,
              totalUsageLimit: usageLimit.value,
            }}
            activeDates={{
              startDate: startDate.value,
              endDate: endDate.value,
            }}
          />
        </Layout.Section>
        <Layout.Section>
          <PageActions
            primaryAction={{
              content: "Save discount",
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
