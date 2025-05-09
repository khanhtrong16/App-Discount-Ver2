import { useEffect, useMemo } from "react";
import { ActionFunction, json } from "@remix-run/node";
import { useForm, useField } from "@shopify/react-form";
import { CurrencyCode } from "@shopify/react-i18n";
import {
  Form,
  useActionData,
  useNavigation,
  useSubmit,
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

import shopify, { authenticate } from "../shopify.server";
export const loader: LoaderFunction = async ({ request, params }) => {
  const { functionId, id } = params;
  const { admin } = await authenticate.admin(request);

  const discount = await admin.graphql(
    `#graphql
  query GetCodeDiscount($id: ID!) {
    codeDiscountNode(id: $id) {
      id
      codeDiscount {
        ... on DiscountCodeApp {
          title
          summary
          codes(first: 1) {
            nodes {
              code
              id
            }
          }
          startsAt
          endsAt
          status
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
        id
        namespace
        key
        value
      }
    }
  }`,
    {
      variables: { id },
    },
  );

  const responseData = await discount.json();
  console.log("Đây là discount", responseData);

  // Trích xuất dữ liệu
  const discountNode = responseData.data?.codeDiscountNode;
  if (!discountNode) {
    return json({ discount: null, error: "Discount not found" });
  }

  const discountData = discountNode.codeDiscount;
  const metafieldValue = discountNode.metafield?.value
    ? JSON.parse(discountNode.metafield.value)
    : { quantity: 1, percentage: 0 };

  console.log("Configuration:", metafieldValue);

  // Trả về dữ liệu cho frontend
  return json({
    discount: {
      id: discountNode.id,
      functionId,
      title: discountData.title,
      method: DiscountMethod.Code,
      code: discountData.codes?.nodes[0]?.code || "",
      usageLimit: discountData.usageLimit,
      appliesOncePerCustomer: discountData.appliesOncePerCustomer,
      startsAt: discountData.startsAt,
      endsAt: discountData.endsAt,
      status: discountData.status,
      combinesWith: discountData.combinesWith || {
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: false,
      },
      configuration: metafieldValue,
    },
  });
};
export const action: ActionFunction = async ({ request }) => {
  console.log(request);
  const formData = await request.formData();
  console.log(formData);
};

export default function VolumeNew() {
  const submitForm = useSubmit();
  const actionData = useActionData();
  const navigation = useNavigation();
  const todaysDate = useMemo(() => new Date(), []);

  const isLoading = navigation.state === "submitting";
  const currencyCode = CurrencyCode.Cad;
  const submitErrors = actionData?.errors || [];
  const returnToDiscounts = () => open("shopify://admin/discounts", "_top");

  useEffect(() => {
    if (actionData?.errors.length === 0 && actionData?.discount) {
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
      discountTitle: useField(""),
      discountMethod: useField(DiscountMethod.Code),
      discountCode: useField(""),
      combinesWith: useField({
        orderDiscounts: false,
        productDiscounts: false,
        shippingDiscounts: false,
      }),
      requirementType: useField(RequirementType.None),
      requirementSubtotal: useField("0"),
      requirementQuantity: useField("0"),
      usageLimit: useField(null),
      appliesOncePerCustomer: useField(false),
      startDate: useField(todaysDate),
      endDate: useField(null),
      configuration: {
        quantity: useField("1"),
        percentage: useField("0"),
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
              isEditing: false,
            }}
            performance={{
              status: DiscountStatus.Scheduled,
              usageCount: 0,
              isEditing: false,
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
