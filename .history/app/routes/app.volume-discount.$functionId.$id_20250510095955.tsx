import { useEffect, useMemo } from "react";
import {
  ActionFunction,
  json,
  LoaderFunction,
  redirect,
} from "@remix-run/node";
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
import { log } from "console";

/**
 * TypeScript interface for data returned from the loader function
 * Defines the structure of discount and metafield data from Shopify
 */
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
    id: string;
    namespace: string;
    key: string;
    type: string;
    value: string;
  } | null;
};

/**
 * Loader function to fetch discount data and associated metafields
 *
 * This function:
 * 1. Gets discount ID from URL parameters
 * 2. Authenticates with Shopify Admin API
 * 3. Fetches discount details and metafields using GraphQL
 * 4. Returns structured data for the component
 */
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
            id
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

/**
 * Action function to handle form submission and update discount
 *
 * This function:
 * 1. Parses form data containing discount information
 * 2. Fetches existing metafield ID
 * 3. Updates the discount via GraphQL mutation
 * 4. Updates the metafield separately using metafieldsSet mutation
 * 5. Returns success or error response
 */
export const action: ActionFunction = async ({ request, params }) => {
  // Extract params and authenticate with Shopify Admin API
  const { functionId, id } = params;
  const { admin } = await authenticate.admin(request);

  // Parse form data submitted from the client
  const formData = await request.formData();

  const { isDelete, discountMethod } = Object.fromEntries(formData);
  let deleteDiscountResponse;
  if (isDelete) {
    console.log("method", discountMethod);

    if (discountMethod === DiscountMethod.Code) {
      deleteDiscountResponse = await admin.graphql(
        `#graphql
        mutation deleteCodeDiscount($id: ID!) {
          discountCodeDelete(id: $id) {
            deletedCodeDiscountId
            userErrors {
              field
              code
              message
            }
          }
        }`,
        {
          variables: {
            id: `gid://shopify/DiscountCodeNode/${id}`,
          },
        },
      );
      console.log("deleteDiscountResponse", deleteDiscountResponse);
      return () => open("shopify://admin/discounts", "_top");
    } else {
      console.log("delete automatic discount");
      deleteDiscountResponse = await admin.graphql(
        `#graphql
        mutation discountAutomaticDelete($id: ID!) {
          discountAutomaticDelete(id: $id) {
            deletedAutomaticDiscountId
            userErrors {
              field
              code
              message
            }
          }
        }`,
        {
          variables: {
            id: `gid://shopify/DiscountAutomaticNode/${id}`,
          },
        },
      );
      console.log("deleteDiscountResponse-automatic", deleteDiscountResponse);
      return open("shopify://admin/discounts", "_top");
    }
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
  } = JSON.parse(formData.get("discount") as string);
  // Fetch the existing metafield ID for the discount

  // This is needed for proper metafield updating
  const getDiscountResponse = await admin.graphql(
    `#graphql
    query GetDiscount($id: ID!) {
      discountNode(id: $id) {
        metafields(namespace: "$app:volume-discount", first: 1) {
          edges {
            node {
              id
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

  const getDiscountData = await getDiscountResponse.json();
  const metafieldId =
    getDiscountData.data.discountNode.metafields.edges[0]?.node?.id;

  // Prepare base discount data for both code and automatic discounts
  const baseDiscount = {
    functionId,
    title,
    combinesWith,
    startsAt: new Date(startsAt),
    endsAt: endsAt && new Date(endsAt),
  };

  // Variables to store response data
  let discountUpdateResponse;
  let errors;
  let discount;

  // Different update logic based on discount method (code vs automatic)
  if (method === DiscountMethod.Code) {
    // For code-based discounts, add code-specific properties
    const baseCodeDiscount = {
      ...baseDiscount,
      title: code,
      code,
      usageLimit,
      appliesOncePerCustomer,
    };

    // Update code discount using GraphQL mutation
    discountUpdateResponse = await admin.graphql(
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
          discount: baseCodeDiscount, // Don't include metafields in the discount update
        },
      },
    );

    const responseJson = await discountUpdateResponse.json();
    errors = responseJson.data.discountUpdate?.userErrors;
    discount = responseJson.data.discountUpdate?.codeAppDiscount;
  } else {
    // For automatic discounts, use the appropriate mutation
    discountUpdateResponse = await admin.graphql(
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
          discount: baseDiscount, // Don't include metafields in the discount update
        },
      },
    );

    const responseJson = await discountUpdateResponse.json();
    errors = responseJson.data.discountUpdate?.userErrors;
    discount = responseJson.data.discountUpdate?.automaticAppDiscount;
  }

  // If there are errors in discount update, return them immediately
  if (errors && errors.length > 0) {
    return json({ errors });
  }

  // Update metafields separately using metafieldsSet mutation
  // This avoids the "key must be unique" error that occurs when trying to
  // create a new metafield with the same namespace/key
  if (metafieldId) {
    const metafieldUpdateResponse = await admin.graphql(
      `#graphql
      mutation MetafieldsSet($metafields: [MetafieldsSetInput!]!) {
        metafieldsSet(metafields: $metafields) {
          metafields {
            id
          }
          userErrors {
            field
            message
          }
        }
      }`,
      {
        variables: {
          metafields: [
            {
              ownerId: `gid://shopify/DiscountNode/${id}`,
              namespace: "$app:volume-discount",
              key: "function-configuration",
              type: "json",
              value: JSON.stringify({
                quantity: configuration.quantity,
                percentage: configuration.percentage,
              }),
            },
          ],
        },
      },
    );

    const metafieldResponseJson = await metafieldUpdateResponse.json();
    const metafieldErrors =
      metafieldResponseJson.data.metafieldsSet?.userErrors;

    // If there are errors updating metafields, return them
    if (metafieldErrors && metafieldErrors.length > 0) {
      return json({ errors: metafieldErrors });
    }
  }

  // Return success response with updated discount data
  return json({ errors: [], discount: { ...discount, functionId } });
};

/**
 * VolumeEdit component - Main component for the discount edit page
 *
 * This component:
 * 1. Fetches discount data from the loader
 * 2. Initializes form with existing discount values
 * 3. Renders UI components for editing discount properties
 * 4. Handles form submission and validation
 */
export default function VolumeEdit() {
  const submitForm = useSubmit();
  const actionData = useActionData<{
    errors?: Array<{ message: string; field: string[] }>;
    discount?: any;
  }>();
  const navigation = useNavigation();
  const todaysDate = useMemo(() => new Date().toISOString(), []);
  const { discount, metafield } = useLoaderData<LoaderData>();

  // Parse the metafield JSON value to get discount configuration
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

  // UI state tracking
  const isLoading = navigation.state === "submitting";
  const currencyCode = CurrencyCode.Cad;
  const submitErrors = actionData?.errors || [];
  const returnToDiscounts = () => open("shopify://admin/discounts", "_top");
  const handleDelete = async () => {
    submitForm(
      { isDelete: true, discountMethod: discountMethod.value },
      { method: "post" },
    );
  };
  // Redirect to discounts list after successful update
  useEffect(() => {
    if (actionData?.errors?.length === 0 && actionData?.discount) {
      returnToDiscounts();
    }
  }, [actionData]);

  // Initialize form with existing discount data
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
      // Initialize form fields with values from the existing discount
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
      // Initialize volume discount configuration from metafields
      configuration: {
        quantity: useField(metafieldConfig?.quantity?.toString() || "1"),
        percentage: useField(metafieldConfig?.percentage?.toString() || "0"),
      },
    },

    onSubmit: async (form) => {
      // Prepare discount object for submission
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

      // Submit form data to the action function
      submitForm({ discount: JSON.stringify(discount) }, { method: "post" });

      return { status: "success" };
    },
  });

  // Display error banner if there are submission errors
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

  // Render the discount edit form UI
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
              {/* Discount method selection (code vs automatic) */}
              <MethodCard
                title="Volume"
                discountTitle={discountTitle}
                discountClass={DiscountClass.Product}
                discountCode={discountCode}
                discountMethod={discountMethod}
              />
              {/* Volume discount configuration */}
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
              {/* Usage limits for code discounts */}
              {discountMethod.value === DiscountMethod.Code && (
                <UsageLimitsCard
                  totalUsageLimit={usageLimit}
                  oncePerCustomer={appliesOncePerCustomer}
                />
              )}
              {/* Discount combination settings */}
              <CombinationCard
                combinableDiscountTypes={combinesWith}
                discountClass={DiscountClass.Product}
                discountDescriptor={"Discount"}
              />
              {/* Active dates for the discount */}
              <ActiveDatesCard
                startDate={startDate as any}
                endDate={endDate as any}
                timezoneAbbreviation="EST"
              />
            </BlockStack>
          </Form>
        </Layout.Section>
        {/* Summary card showing discount details */}
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
        {/* Form actions (submit/cancel) */}
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
              {
                content: "Delete",
                destructive: true,
                onAction: handleDelete,
              },
            ]}
          />
        </Layout.Section>
      </Layout>
    </Page>
  );
}
