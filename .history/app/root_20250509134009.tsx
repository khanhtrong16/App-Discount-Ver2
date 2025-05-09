import {
  Links,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
} from "@remix-run/react";

export default function App() {
  return (
    <html>
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width,initial-scale=1" />
        <meta
          httpEquiv="Content-Security-Policy"
          content="frame-ancestors 'self' https://*.myshopify.com https://*.shopify.com https://*.trycloudflare.com; script-src 'self' 'unsafe-inline' 'unsafe-eval' https://*.shopify.com https://*.myshopify.com https://*.trycloudflare.com; connect-src 'self' https://*.shopify.com https://*.myshopify.com https://*.trycloudflare.com;"
        />
        <link rel="preconnect" href="https://cdn.shopify.com/" />
        <link
          rel="stylesheet"
          href="https://cdn.shopify.com/static/fonts/inter/v4/styles.css"
        />
        <Meta />
        <Links />
      </head>
      <body>
        <Outlet />
        <ScrollRestoration />
        <Scripts />
      </body>
    </html>
  );
}
