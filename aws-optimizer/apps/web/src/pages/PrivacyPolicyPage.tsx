import {
  Container,
  Paper,
  Title,
  Text,
  Stack,
  Anchor,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";

export function PrivacyPolicyPage() {
  return (
    <Container size="md" py="xl">
      <Paper withBorder p="xl">
        <Stack gap="lg">
          <Title order={1}>Privacy Policy</Title>
          
          <Text c="dimmed" size="sm">
            Last updated: {new Date().toLocaleDateString()}
          </Text>

          <Stack gap="md">
            <Title order={2} size="h4">1. Information We Collect</Title>
            <Text>
              We collect information you provide directly to us, such as when you create an account,
              connect AWS accounts, or contact us for support. This includes your name, email address,
              and AWS account information necessary to provide our cost optimization services.
            </Text>

            <Title order={2} size="h4">2. How We Use Your Information</Title>
            <Text>
              We use the information we collect to provide, maintain, and improve our services,
              including analyzing your AWS costs and providing optimization recommendations.
              We do not sell your personal information to third parties.
            </Text>

            <Title order={2} size="h4">3. Data Security</Title>
            <Text>
              We implement appropriate security measures to protect your personal information.
              AWS credentials are encrypted at rest and in transit. We use industry-standard
              encryption protocols to secure all data transmissions.
            </Text>

            <Title order={2} size="h4">4. Data Retention</Title>
            <Text>
              We retain your information for as long as your account is active or as needed
              to provide you services. You can request deletion of your data at any time
              by contacting our support team.
            </Text>

            <Title order={2} size="h4">5. Your Rights</Title>
            <Text>
              You have the right to access, correct, or delete your personal information.
              You can also opt out of certain data collection practices. Contact us to
              exercise any of these rights.
            </Text>

            <Title order={2} size="h4">6. Contact Us</Title>
            <Text>
              If you have any questions about this Privacy Policy, please contact us at
              privacy@awscostoptimizer.com.
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

export default PrivacyPolicyPage;
