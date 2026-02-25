import {
  Container,
  Title,
  Text,
  Button,
  Stack,
  Group,
  Card,
  SimpleGrid,
  Badge,
  ThemeIcon,
  Box,
  Paper,
  Avatar,
  Anchor,
  List,
  rem,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import {
  IconCloud,
  IconChartBar,
  IconRobot,
  IconShieldCheck,
  IconClock,
  IconCheck,
  IconArrowRight,
  IconQuote,
} from "@tabler/icons-react";

/**
 * LandingPage - Marketing landing page
 *
 * US-041 Acceptance Criteria:
 * - Create / route with marketing landing page
 * - Display product value proposition and features
 * - Show pricing tiers: Free, Pro, Enterprise
 * - Include call-to-action buttons for signup
 * - Add testimonials or social proof section
 */

const FEATURES = [
  {
    id: "ai-analysis",
    icon: IconRobot,
    title: "AI-Powered Analysis",
    description:
      "Our intelligent AI analyzes your AWS infrastructure to identify cost-saving opportunities automatically.",
  },
  {
    id: "real-time",
    icon: IconClock,
    title: "Real-Time Monitoring",
    description:
      "Get instant alerts when costs spike or unusual spending patterns are detected.",
  },
  {
    id: "multi-account",
    icon: IconCloud,
    title: "Multi-Account Support",
    description:
      "Connect and manage multiple AWS accounts from a single dashboard with unified reporting.",
  },
  {
    id: "reporting",
    icon: IconChartBar,
    title: "Detailed Reports",
    description:
      "Generate comprehensive cost reports with actionable recommendations for your team.",
  },
  {
    id: "security",
    icon: IconShieldCheck,
    title: "Enterprise Security",
    description:
      "Bank-grade security with SOC 2 compliance and encrypted data storage.",
  },
];

const PRICING_TIERS = [
  {
    id: "free",
    name: "Free",
    price: 0,
    description: "Perfect for getting started",
    features: [
      "1 AWS account",
      "5 analysis runs/month",
      "Basic recommendations",
      "7-day data retention",
      "Community support",
    ],
    cta: "Start Free",
    highlighted: false,
  },
  {
    id: "pro",
    name: "Pro",
    price: 49,
    description: "For growing teams",
    features: [
      "10 AWS accounts",
      "Unlimited analysis runs",
      "Advanced AI recommendations",
      "90-day data retention",
      "Priority email support",
      "Custom alerts",
      "Team collaboration",
    ],
    cta: "Start Free Trial",
    highlighted: true,
  },
  {
    id: "enterprise",
    name: "Enterprise",
    price: null,
    description: "For large organizations",
    features: [
      "Unlimited AWS accounts",
      "Unlimited analysis runs",
      "Custom AI models",
      "Unlimited data retention",
      "Dedicated support",
      "SSO & SAML",
      "Custom integrations",
      "SLA guarantees",
    ],
    cta: "Contact Sales",
    highlighted: false,
  },
];

const TESTIMONIALS = [
  {
    id: "1",
    quote:
      "AWS Cost Optimizer helped us reduce our monthly AWS bill by 40%. The AI recommendations were spot-on and easy to implement.",
    author: "Sarah Chen",
    role: "CTO",
    company: "TechStartup Inc",
  },
  {
    id: "2",
    quote:
      "Finally, a tool that gives us visibility across all our AWS accounts. The real-time alerts have saved us from several costly mistakes.",
    author: "Michael Rodriguez",
    role: "DevOps Lead",
    company: "ScaleUp Systems",
  },
  {
    id: "3",
    quote:
      "The enterprise features and security compliance made it easy to get approval from our security team. Highly recommended!",
    author: "Emily Watson",
    role: "Cloud Architect",
    company: "Enterprise Corp",
  },
];

function HeroSection() {
  return (
    <Box
      data-testid="hero-section"
      style={{
        background: "linear-gradient(135deg, #fd7e14 0%, #f76707 100%)",
        padding: "80px 0",
      }}
    >
      <Container size="lg">
        <Stack align="center" gap="xl">
          <Badge size="lg" variant="white" color="orange">
            AI-Powered AWS Cost Optimization
          </Badge>
          <Title
            order={1}
            c="white"
            ta="center"
            style={{ fontSize: rem(48), maxWidth: 800 }}
          >
            Cut Your AWS Costs by Up to 40% with AI
          </Title>
          <Text
            size="xl"
            c="white"
            ta="center"
            maw={600}
            style={{ opacity: 0.9 }}
          >
            Our intelligent platform analyzes your AWS infrastructure and
            provides actionable recommendations to optimize spending without
            sacrificing performance.
          </Text>
          <Group gap="md" mt="md">
            <Button
              component={Link}
              to="/signup"
              size="xl"
              variant="white"
              color="orange"
              rightSection={<IconArrowRight size={20} />}
            >
              Get Started Free
            </Button>
            <Button
              component={Link}
              to="/login"
              size="xl"
              variant="outline"
              color="white"
              styles={{
                root: {
                  borderColor: "white",
                  "&:hover": {
                    backgroundColor: "rgba(255,255,255,0.1)",
                  },
                },
              }}
            >
              Sign In
            </Button>
          </Group>
          <Text size="sm" c="white" style={{ opacity: 0.8 }}>
            No credit card required • Free tier available
          </Text>
        </Stack>
      </Container>
    </Box>
  );
}

function FeaturesSection() {
  return (
    <Box data-testid="features-section" py={80} bg="var(--mantine-color-default-hover)">
      <Container size="lg">
        <Stack align="center" gap="xl">
          <Badge size="lg" variant="light" color="orange">
            Features
          </Badge>
          <Title order={2} ta="center">
            Everything You Need to Optimize AWS Costs
          </Title>
          <Text c="dimmed" ta="center" maw={600}>
            Powerful tools and intelligent insights to help you understand,
            monitor, and reduce your AWS spending.
          </Text>

          <SimpleGrid cols={{ base: 1, sm: 2, md: 3 }} spacing="lg" mt="xl">
            {FEATURES.map((feature) => (
              <Card
                key={feature.id}
                data-testid={`feature-card-${feature.id}`}
                shadow="sm"
                padding="lg"
                radius="md"
                withBorder
              >
                <ThemeIcon
                  size={50}
                  radius="md"
                  variant="light"
                  color="orange"
                  mb="md"
                >
                  <feature.icon size={26} />
                </ThemeIcon>
                <Text fw={600} size="lg" mb="xs">
                  {feature.title}
                </Text>
                <Text size="sm" c="dimmed">
                  {feature.description}
                </Text>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

function PricingSection() {
  return (
    <Box data-testid="pricing-section" py={80}>
      <Container size="lg">
        <Stack align="center" gap="xl">
          <Badge size="lg" variant="light" color="orange">
            Pricing
          </Badge>
          <Title order={2} ta="center">
            Simple, Transparent Pricing
          </Title>
          <Text c="dimmed" ta="center" maw={600}>
            Choose the plan that fits your needs. All plans include our core
            cost optimization features.
          </Text>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="xl" w="100%">
            {PRICING_TIERS.map((tier) => (
              <Card
                key={tier.id}
                data-testid={`pricing-${tier.id}`}
                shadow={tier.highlighted ? "lg" : "sm"}
                padding="xl"
                radius="md"
                withBorder
                style={{
                  borderColor: tier.highlighted ? "#fd7e14" : undefined,
                  borderWidth: tier.highlighted ? 2 : 1,
                  transform: tier.highlighted ? "scale(1.02)" : undefined,
                }}
              >
                <Stack gap="md">
                  {tier.highlighted && (
                    <Badge color="orange" variant="filled" size="sm">
                      Most Popular
                    </Badge>
                  )}
                  <Text fw={700} size="xl">
                    {tier.name}
                  </Text>
                  <Text c="dimmed" size="sm">
                    {tier.description}
                  </Text>
                  <Group align="baseline" gap={4}>
                    <Text fw={700} style={{ fontSize: rem(40) }}>
                      {tier.price !== null ? `$${tier.price}` : "Custom"}
                    </Text>
                    {tier.price !== null && (
                      <Text c="dimmed" size="sm">
                        /month
                      </Text>
                    )}
                  </Group>

                  <List
                    spacing="sm"
                    size="sm"
                    center
                    icon={
                      <ThemeIcon
                        color="green"
                        size={20}
                        radius="xl"
                        variant="light"
                      >
                        <IconCheck size={12} />
                      </ThemeIcon>
                    }
                  >
                    {tier.features.map((feature, index) => (
                      <List.Item key={index}>{feature}</List.Item>
                    ))}
                  </List>

                  <Button
                    component={Link}
                    to="/signup"
                    data-testid={`pricing-cta-${tier.id}`}
                    variant={tier.highlighted ? "filled" : "outline"}
                    color="orange"
                    fullWidth
                    mt="md"
                  >
                    {tier.cta}
                  </Button>
                </Stack>
              </Card>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

function TestimonialsSection() {
  return (
    <Box data-testid="testimonials-section" py={80} bg="var(--mantine-color-default-hover)">
      <Container size="lg">
        <Stack align="center" gap="xl">
          <Badge size="lg" variant="light" color="orange">
            Testimonials
          </Badge>
          <Title order={2} ta="center">
            Trusted by Cloud Teams Worldwide
          </Title>
          <Text c="dimmed" ta="center" maw={600}>
            See what our customers have to say about their experience with AWS
            Cost Optimizer.
          </Text>

          <SimpleGrid cols={{ base: 1, md: 3 }} spacing="lg" mt="xl">
            {TESTIMONIALS.map((testimonial) => (
              <Paper
                key={testimonial.id}
                data-testid={`testimonial-${testimonial.id}`}
                shadow="sm"
                p="xl"
                radius="md"
                withBorder
              >
                <Stack gap="md">
                  <ThemeIcon
                    size={32}
                    radius="xl"
                    variant="light"
                    color="orange"
                  >
                    <IconQuote size={18} />
                  </ThemeIcon>
                  <Text size="sm" style={{ fontStyle: "italic" }}>
                    "{testimonial.quote}"
                  </Text>
                  <Group gap="sm">
                    <Avatar color="orange" radius="xl">
                      {testimonial.author
                        .split(" ")
                        .map((n) => n[0])
                        .join("")}
                    </Avatar>
                    <Stack gap={0}>
                      <Text fw={600} size="sm">
                        {testimonial.author}
                      </Text>
                      <Text c="dimmed" size="xs">
                        {testimonial.role} at {testimonial.company}
                      </Text>
                    </Stack>
                  </Group>
                </Stack>
              </Paper>
            ))}
          </SimpleGrid>
        </Stack>
      </Container>
    </Box>
  );
}

function CTASection() {
  return (
    <Box
      py={80}
      style={{
        background: "linear-gradient(135deg, #fd7e14 0%, #f76707 100%)",
      }}
    >
      <Container size="lg">
        <Stack align="center" gap="xl">
          <Title order={2} c="white" ta="center">
            Ready to Optimize Your AWS Costs?
          </Title>
          <Text c="white" ta="center" maw={600} style={{ opacity: 0.9 }}>
            Join thousands of teams who are saving money on their AWS bills.
            Get started for free today.
          </Text>
          <Group gap="md">
            <Button
              component={Link}
              to="/signup"
              size="xl"
              variant="white"
              color="orange"
              rightSection={<IconArrowRight size={20} />}
            >
              Start Free Trial
            </Button>
          </Group>
        </Stack>
      </Container>
    </Box>
  );
}

function Footer() {
  return (
    <Box py={40} bg="dark.9">
      <Container size="lg">
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Text c="white" fw={700}>
              AWS Cost Optimizer
            </Text>
            <Text c="dimmed" size="sm">
              © {new Date().getFullYear()} All rights reserved.
            </Text>
          </Stack>
          <Group gap="lg">
            <Anchor component={Link} to="/login" c="dimmed" size="sm">
              Sign In
            </Anchor>
            <Anchor component={Link} to="/signup" c="dimmed" size="sm">
              Sign Up
            </Anchor>
          </Group>
        </Group>
      </Container>
    </Box>
  );
}

export function LandingPage() {
  return (
    <Box data-testid="landing-page">
      <HeroSection />
      <FeaturesSection />
      <PricingSection />
      <TestimonialsSection />
      <CTASection />
      <Footer />
    </Box>
  );
}

export default LandingPage;
