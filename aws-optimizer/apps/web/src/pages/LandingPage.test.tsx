import { describe, test, expect } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { RouterProvider, createRouter, createRootRoute, createMemoryHistory } from "@tanstack/react-router";
import { LandingPage } from "./LandingPage";

// Create a test router with the LandingPage
function createTestRouter() {
  const rootRoute = createRootRoute({
    component: LandingPage,
  });
  return createRouter({
    routeTree: rootRoute,
    history: createMemoryHistory({ initialEntries: ["/"] }),
  });
}

/**
 * US-041: Landing Page Tests
 *
 * Acceptance Criteria:
 * 1. Create / route with marketing landing page
 * 2. Display product value proposition and features
 * 3. Show pricing tiers: Free, Pro, Enterprise
 * 4. Include call-to-action buttons for signup
 * 5. Add testimonials or social proof section
 */
describe("LandingPage Component", () => {
  test("should be a valid React component", () => {
    expect(LandingPage).toBeDefined();
    expect(typeof LandingPage).toBe("function");
  });

  test("should be exported as default", async () => {
    const module = await import("./LandingPage");
    expect(module.default).toBeDefined();
    expect(typeof module.default).toBe("function");
  });
});

describe("LandingPage Route Integration", () => {
  test("router should have / route configured", async () => {
    const { router } = await import("../router");
    expect(router).toBeDefined();
    expect(router.routeTree).toBeDefined();
    expect(typeof router.navigate).toBe("function");
  });
});

describe("LandingPage Acceptance Criteria", () => {
  const renderLandingPage = async () => {
    const testRouter = createTestRouter();
    render(
      <MantineProvider>
        <RouterProvider router={testRouter} />
      </MantineProvider>
    );
    // Wait for the router to finish loading and render the component
    await waitFor(() => {
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });
  };

  describe("AC1: Create / route with marketing landing page", () => {
    test("should render landing page content", async () => {
      await renderLandingPage();
      expect(screen.getByTestId("landing-page")).toBeInTheDocument();
    });

    test("should display hero section", async () => {
      await renderLandingPage();
      expect(screen.getByTestId("hero-section")).toBeInTheDocument();
    });
  });

  describe("AC2: Display product value proposition and features", () => {
    test("should display main value proposition headline", async () => {
      await renderLandingPage();
      expect(
        screen.getByRole("heading", { level: 1 })
      ).toBeInTheDocument();
    });

    test("should display features section", async () => {
      await renderLandingPage();
      expect(screen.getByTestId("features-section")).toBeInTheDocument();
    });

    test("should display at least 3 feature items", async () => {
      await renderLandingPage();
      const featureCards = screen.getAllByTestId(/^feature-card-/);
      expect(featureCards.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("AC3: Show pricing tiers: Free, Pro, Enterprise", () => {
    test("should display pricing section", async () => {
      await renderLandingPage();
      expect(screen.getByTestId("pricing-section")).toBeInTheDocument();
    });

    test("should display Free tier", async () => {
      await renderLandingPage();
      const freeCard = screen.getByTestId("pricing-free");
      expect(freeCard).toBeInTheDocument();
      expect(freeCard.textContent).toMatch(/free/i);
    });

    test("should display Pro tier", async () => {
      await renderLandingPage();
      const proCard = screen.getByTestId("pricing-pro");
      expect(proCard).toBeInTheDocument();
      expect(proCard.textContent).toMatch(/pro/i);
    });

    test("should display Enterprise tier", async () => {
      await renderLandingPage();
      const enterpriseCard = screen.getByTestId("pricing-enterprise");
      expect(enterpriseCard).toBeInTheDocument();
      expect(enterpriseCard.textContent).toMatch(/enterprise/i);
    });

    test("should display pricing amounts", async () => {
      await renderLandingPage();
      // Free should show $0
      expect(screen.getByText(/\$0/)).toBeInTheDocument();
      // Pro should show a price
      expect(screen.getByText(/\$49/)).toBeInTheDocument();
    });
  });

  describe("AC4: Include call-to-action buttons for signup", () => {
    test("should display primary CTA button in hero", async () => {
      await renderLandingPage();
      const ctaButtons = screen.getAllByRole("link", { name: /get started|sign up|start free/i });
      expect(ctaButtons.length).toBeGreaterThanOrEqual(1);
    });

    test("should have CTA buttons that link to signup", async () => {
      await renderLandingPage();
      const signupLinks = screen.getAllByRole("link", { name: /get started|sign up|start free/i });
      const hasSignupLink = signupLinks.some(
        (link) => link.getAttribute("href") === "/signup"
      );
      expect(hasSignupLink).toBe(true);
    });

    test("should display CTA buttons in pricing cards", async () => {
      await renderLandingPage();
      const pricingCTAs = screen.getAllByTestId(/^pricing-cta-/);
      expect(pricingCTAs.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe("AC5: Add testimonials or social proof section", () => {
    test("should display testimonials section", async () => {
      await renderLandingPage();
      expect(screen.getByTestId("testimonials-section")).toBeInTheDocument();
    });

    test("should display at least 2 testimonials", async () => {
      await renderLandingPage();
      const testimonials = screen.getAllByTestId(/^testimonial-/);
      expect(testimonials.length).toBeGreaterThanOrEqual(2);
    });

    test("should display testimonial quotes and attribution", async () => {
      await renderLandingPage();
      // Should have quotes with text
      const testimonials = screen.getAllByTestId(/^testimonial-/);
      testimonials.forEach((testimonial) => {
        expect(testimonial.textContent).toBeTruthy();
      });
    });
  });
});
