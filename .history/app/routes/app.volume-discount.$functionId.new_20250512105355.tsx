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
  // get form data from request
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

  console.log("productId", productId);

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
  // check method is code or automatic
  if (method === DiscountMethod.Code) {
    const baseCodeDiscount = {
      ...baseDiscount,
      title: code,
      code,
      usageLimit,
      appliesOncePerCustomer,
    };
    // graphql create code discount
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
    // graphql create automatic discount
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
  const [formState, setFormState] = useState([]);
  const returnToDiscounts = () => open("shopify://admin/discounts", "_top");
  const [tier, setTier] = useState([1]);
  // function select product with resource picker
  async function selectProduct() {
    const products = await window.shopify.resourcePicker({
      type: "product",
      action: "add", // customized action verb, either 'select' or 'add',
      multiple: true,
    });
    console.log(
      "products",
      products?.map((product) => product),
    );

    if (products) {
      const productList: any = products.map((item) => {
        return {
          productId: item.id,
          productVariantId: item.variants[0].id,
          productTitle: item.title,
          productHandle: item.handle,
          productAlt: item.images[0]?.altText,
          productImage: item.images[0]?.originalSrc,
        };
      });
      // const { images, id, variants, title, handle } = products[0];
      console.log("productList", productList);

      setFormState(productList);
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
    // set value for form with useField
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
        quantity: tier.map((item) => {
          return {
            [`tier${item}`]: useField(item.toString()),
          };
        }),
        percentage: tier.map((item) => {
          return {
            [`tier${item}`]: useField(item.toString()),
          };
        }),
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
          quantity: {
            tier01: parseInt(form.configuration.quantity.tier01),
            tier02: parseInt(form.configuration.quantity.tier02),
            tier03: parseInt(form.configuration.quantity.tier03),
          },
          percentage: {},
        },
        productId: formState?.map((item) => item.productId),
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
                {/* box select product via resource picker */}
                <BlockStack gap="500">
                  <InlineStack align="space-between">
                    <Text as={"h2"} variant="headingLg">
                      Product
                    </Text>
                    {formState.length > 0 ? (
                      <Button variant="plain" onClick={selectProduct}>
                        Change product
                      </Button>
                    ) : null}
                  </InlineStack>
                  {/*  Show product selection or selected product. */}
                  {formState.length > 0 ? (
                    formState.map((product, index) => (
                      <InlineStack blockAlign="center" gap="500" key={index}>
                        <Thumbnail
                          source={product.productImage || ImageIcon}
                          alt={product.productAlt}
                        />
                        <Text
                          as="span"
                          variant="headingMd"
                          fontWeight="semibold"
                        >
                          {product.productTitle}
                        </Text>
                      </InlineStack>
                    ))
                  ) : (
                    <BlockStack gap="200">
                      <Button onClick={selectProduct} id="select-product">
                        Select product
                      </Button>
                    </BlockStack>
                  )}
                </BlockStack>
              </Card>
              {/*  show form volume discount with tier 1, 2, 3 */}
              <Box paddingBlockEnd="300">
                <Card>
                  <BlockStack>
                    <InlineStack align="space-between">
                      <Text variant="headingLg" as="h2">
                        Volume
                      </Text>{" "}
                      <div className="d-flex gap-2">
                        <Button
                          variant="plain"
                          onClick={() => {
                            if (tier.length < 6) {
                              setTier([...tier, tier.length + 1]);
                            }
                          }}
                        >
                          Add tier
                        </Button>
                        <Button
                          variant="plain"
                          onClick={() => {
                            if (tier.length > 1) {
                              setTier(tier.slice(0, tier.length - 1));
                            }
                          }}
                        >
                          Remove tier
                        </Button>
                      </div>
                    </InlineStack>

                    <Grid>
                      {/* Form volume discount with tier 1, 2, 3 */}
                      {tier.map((item, index) => {
                        return (
                          <Grid.Cell
                            columnSpan={{ xs: 6, sm: 4, md: 4 }}
                            key={index}
                          >
                            <Text variant="headingMd" as="h1">
                              tier {item}
                            </Text>
                            <TextField
                              label="Minimum quantity"
                              autoComplete="on"
                              {...configuration.quantity.map(item => item)]}
                            />
                            <TextField
                              label="Discount percentage"
                              autoComplete="on"
                              {...configuration.percentage[`tier${item}`]}
                              suffix="%"
                            />
                          </Grid.Cell>
                        );
                      })}
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
