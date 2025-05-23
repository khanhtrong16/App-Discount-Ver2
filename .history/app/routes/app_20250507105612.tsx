import { json } from "@remix-run/node";
import { Link, Outlet, useLoaderData, useRouteError } from "@remix-run/react";
import polarisStyles from "@shopify/polaris/build/esm/styles.css?url";
import { AppProvider as DiscountProvider } from "@shopify/discount-app-components";
import { boundary } from "@shopify/shopify-app-remix/server";
import { AppProvider } from "@shopify/shopify-app-remix/react";

import { authenticate } from "../shopify.server";

export const links = () => [{ rel: "stylesheet", href: polarisStyles }];

export async function loader({ request }) {
  await authenticate.admin(request);

  return json({
    apiKey: process.env.SHOPIFY_API_KEY,
  });
}

export default function App() {
  const { apiKey } = useLoaderData<typeof loader>();

  return (
    <AppProvider isEmbeddedApp apiKey={apiKey}>
      <DiscountProvider locale="en-US" ianaTimezone="America/Toronto">
        <ui-nav-menu>
          <Link to="/app" rel="home">
            Home
          </Link>
          <Link
            to={`app.volume-discount.9e014130-9553-4545-a1f9-14bd5949af8b.new`}
          >
            Additional page
          </Link>
        </ui-nav-menu>
        <Outlet />
      </DiscountProvider>
    </AppProvider>
  );
}

// Shopify needs Remix to catch some thrown responses, so that their headers are included in the response.
export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};
