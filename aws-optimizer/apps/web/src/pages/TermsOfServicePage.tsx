import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Anchor,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";

export function TermsOfServicePage() {
  return (
    <Container size="md" py="xl">
      <Paper withBorder p="xl">
        <Stack gap="lg">
          <Title order={1}>Terms of Service</Title>
          
          <Text c="dimmed" size="sm">
            Last updated: {new Date().toLocaleDateString()}
          </Text>

          <Stack gap="md">
            <Title order={2} size="h4">1. Acceptance of Terms</Title>
            <Text>
              By accessing or using AWS Cost Optimizer, you agree to be bound by these
              Terms of Service. If you do not agree to these terms, please do not use
              our services.
            </Text>

            <Title order={2} size="h4">2. Description of Service</Title>
            <Text>
              AWS Cost Optimizer provides cloud cost analysis and optimization recommendations
              for Amazon Web Services. We help you identify savings opportunities and manage
              your cloud spending more effectively.
            </Text>

            <Title order={2} size="h4">3. Account Responsibilities</Title>
            <Text>
              You are responsible for maintaining the confidentiality of your account
              credentials and for all activities that occur under your account. You must
              notify us immediately of any unauthorized use of your account.
            </Text>

            <Title order={2} size="h4">4. AWS Credentials</Title>
            <Text>
              By connecting your AWS accounts, you authorize us to access your AWS cost
              and usage data for the purpose of providing our services. We will only
              request the minimum permissions necessary to deliver our services.
            </Text>

            <Title order={2} size="h4">5. Limitation of Liability</Title>
            <Text>
              Our recommendations are provided for informational purposes only. We are not
              liable for any decisions you make based on our recommendations or any resulting
              changes to your AWS infrastructure or costs.
            </Text>

            <Title order={2} size="h4">6. Modifications to Service</Title>
            <Text>
              We reserve the right to modify or discontinue our service at any time,
              with or without notice. We will not be liable to you or any third party
              for any modification, suspension, or discontinuance of the service.
            </Text>

            <Title order={2} size="h4">7. Contact</Title>
            <Text>
              For questions about these Terms of Service, please contact us at
              legal@awscostoptimizer.com.
            </Text>
          </Stack>

          <Anchor component={Link} to="/">
            ← Back to Home
          </Anchor>
        </Stack>
      </Paper>
    </Container>
  );
}

export default TermsOfServicePage;
