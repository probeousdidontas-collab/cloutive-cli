import { useState } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Stack,
  Alert,
  Center,
  Box,
  TextInput,
  Anchor,
} from "@mantine/core";
import { Link } from "@tanstack/react-router";
import { forgotPassword } from "../lib/auth-client";

/**
 * ForgotPasswordPage - Password reset request form
 * 
 * US-020 Acceptance Criteria:
 * - Create /forgot-password route for password reset
 * - Integrate with Better Auth endpoints
 * - Show validation errors appropriately
 */
export function ForgotPasswordPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [email, setEmail] = useState("");

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(false);
    setLoading(true);

    // Basic validation
    if (!email.trim()) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    try {
      const result = await forgotPassword(email);
      
      if (result?.error) {
        setError(result.error.message ?? "Failed to send reset email. Please try again.");
        setLoading(false);
        return;
      }

      setSuccess(true);
      setLoading(false);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to send reset email. Please try again."
      );
      setLoading(false);
    }
  };

  return (
    <Box
      style={{
        minHeight: "100vh",
        display: "flex",
        alignItems: "center",
        background: "linear-gradient(135deg, #fd7e14 0%, #f76707 100%)",
      }}
    >
      <Container size={420} my={40}>
        <Center mb="xl">
          <Title c="white" order={1}>
            AWS Cost Optimizer
          </Title>
        </Center>

        <Paper withBorder shadow="md" p={30} radius="md">
          <Title order={2} ta="center" mb="md">
            Reset Password
          </Title>
          <Text c="dimmed" size="sm" ta="center" mb="lg">
            Enter your email to receive a password reset link
          </Text>

          {error && (
            <Alert color="red" mb="md" variant="light">
              {error}
            </Alert>
          )}

          {success ? (
            <Stack>
              <Alert color="green" variant="light">
                If an account exists with that email, you will receive a password reset link shortly.
              </Alert>
              <Button component={Link} to="/login" fullWidth variant="light">
                Back to Sign In
              </Button>
            </Stack>
          ) : (
            <form onSubmit={handleSubmit}>
              <Stack>
                <TextInput
                  label="Email"
                  placeholder="your@email.com"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.currentTarget.value)}
                  disabled={loading}
                  type="email"
                  autoComplete="email"
                />

                <Button type="submit" fullWidth loading={loading}>
                  Send Reset Link
                </Button>

                <Button
                  component={Link}
                  to="/login"
                  fullWidth
                  variant="subtle"
                  disabled={loading}
                >
                  Back to Sign In
                </Button>
              </Stack>
            </form>
          )}

          <Text c="dimmed" size="sm" ta="center" mt="md">
            Don&apos;t have an account?{" "}
            <Anchor component={Link} to="/signup" size="sm">
              Sign up
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}

export default ForgotPasswordPage;
