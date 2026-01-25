/**
 * Convex Auth Configuration for Better Auth JWT Validation
 *
 * Configures Convex to validate JWT tokens issued by Better Auth.
 * The domain must match the SITE_URL environment variable in Convex.
 */

export default {
  providers: [
    {
      // Better Auth Convex plugin uses CONVEX_SITE_URL as the JWT issuer
      // This must match for Convex to validate the tokens
      domain: process.env.CONVEX_SITE_URL,
      applicationID: "convex",
    },
  ],
};
