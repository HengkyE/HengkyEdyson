import { Redirect } from "expo-router";

/**
 * /portfolios redirects to the portfolio showcase at /
 */
export default function PortfoliosRedirect() {
  return <Redirect href="/" />;
}
