import { useEffect, useMemo, useState } from "react";
import { json } from "@remix-run/node";
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
  Button,
  InlineError,
  Thumbnail,
  InlineStack,
  Grid,
} from "@shopify/polaris";

import shopify from "../shopify.server";

export const action = async ({ params, request }) => {
  const { functionId } = params;
  const { admin } = await shopify.authenticate.admin(request);
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
    productId,
  } = JSON.parse(formData.get("discount"));

  const baseDiscount = {
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
        productId: productId,
      }),
    },
  ];
  console.log("metafields", metafields);
  return null;
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
          mutation CreateCodeDiscount($discount: DiscountCodeAppInput!) {
            discountCreate: discountCodeAppCreate(codeAppDiscount: $discount) {
              codeAppDiscount{
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
          discount: {
            ...baseCodeDiscount,
            metafields,
          },
        },
      },
    );
    const responseJson = await response.json();
    console.log("Đây là responseJson", responseJson);
    const errors = responseJson.data.discountCreate?.userErrors;
    const discount = responseJson.data.discountCreate?.codeAppDiscount;
    return json({ errors, discount: { ...discount, functionId } });
  } else {
    const response = await admin.graphql(
      `#graphql
          mutation CreateAutomaticDiscount($discount: DiscountAutomaticAppInput!) {
            discountCreate: discountAutomaticAppCreate(automaticAppDiscount: $discount) {
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
          discount: {
            ...baseDiscount,
            metafields,
          },
        },
      },
    );

    const responseJson = await response.json();
    const errors = responseJson.data.discountCreate?.userErrors;
    const discount = responseJson.data.discountCreate?.automaticAppDiscount;
    return json({ errors, discount: { ...discount, functionId } });
  }
  return null;
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
  const [formState, setFormState] = useState({});
  // function select product with resource picker
  async function selectProduct() {
    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "add", // customized action verb, either 'select' or 'add',
    });
    console.log(
      "products",
      products?.map((product) => product.id),
    );

    if (products) {
      const { images, id, variants, title, handle } = products[0];

      setFormState({
        productId: id,
        productVariantId: variants[0].id,
        productTitle: title,
        productHandle: handle,
        productAlt: images[0]?.altText,
        productImage: images[0]?.originalSrc,
      });
    }
  }
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
      productId,
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
        quantity: [
          { tier01: useField("1") },
          { tier02: useField("2") },
          { tier03: useField("3") },
        ],
        percentage: [
          { tier01: useField("0") },
          { tier02: useField("0") },
          { tier03: useField("0") },
        ],
      },
      productId: useField(""),
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
          quantity: [
            { tier01: parseInt(form.configuration.quantity.tier01) },
            { tier02: parseInt(form.configuration.quantity.tier02) },
            { tier03: parseInt(form.configuration.quantity.tier03) },
          ],
          percentage: [
            { tier01: parseFloat(form.configuration.percentage.tier01) },
            { tier02: parseFloat(form.configuration.percentage.tier02) },
            { tier03: parseFloat(form.configuration.percentage.tier03) },
          ],
        },
        productId: formState?.productId,
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
      <ui-title-bar title="Create volume discount">
        <button variant="breadcrumb" onClick={returnToDiscounts}>
          Discounts
        </button>
        <button variant="primary" onClick={submit}>
          Save discount
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
              <Card>
                <BlockStack gap="500">
                  {/* Phần tiêu đề và nút thay đổi sản phẩm */}
                  <InlineStack align="space-between">
                    <Text as={"h2"} variant="headingLg">
                      Product
                    </Text>
                    {formState.productId ? (
                      <Button variant="plain" onClick={selectProduct}>
                        Change product
                      </Button>
                    ) : null}
                  </InlineStack>

                  {/* Hiển thị thông tin sản phẩm đã chọn hoặc nút chọn sản phẩm */}
                  {formState.productId ? (
                    <InlineStack blockAlign="center" gap="500">
                      <Thumbnail
                        source={formState.productImage || ImageIcon}
                        alt={formState.productAlt}
                      />
                      <Text as="span" variant="headingMd" fontWeight="semibold">
                        {formState.productTitle}
                      </Text>
                    </InlineStack>
                  ) : (
                    <BlockStack gap="200">
                      <Button onClick={selectProduct} id="select-product">
                        Select product
                      </Button>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
              <Box paddingBlockEnd="300">
                <Card>
                  <BlockStack>
                    <Text variant="headingLg" as="h2">
                      Volume
                    </Text>
                    <Grid>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4 }}>
                        <Text variant="headingMd" as="h1">
                          tier 1
                        </Text>
                        <TextField
                          label="Minimum quantity"
                          autoComplete="on"
                          {...configuration.quantity..tier01)}
                        />
                        <TextField
                          label="Discount percentage"
                          autoComplete="on"
                          {...configuration.percentage.tier01)}
                          suffix="%"
                        />
                      </Grid.Cell>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4 }}>
                        <Text variant="headingMd" as="h2">
                          tier 2
                        </Text>
                        <TextField
                          label="Minimum quantity"
                          autoComplete="on"
                          {...configuration.quantity.tier02}
                        />
                        <TextField
                          label="Discount percentage"
                          autoComplete="on"
                          {...configuration.percentage.tier02}
                          suffix="%"
                        />
                      </Grid.Cell>
                      <Grid.Cell columnSpan={{ xs: 6, sm: 4, md: 4 }}>
                        <Text variant="headingMd" as="h2">
                          tier 3
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
                      </Grid.Cell>
                    </Grid>
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
// updates
