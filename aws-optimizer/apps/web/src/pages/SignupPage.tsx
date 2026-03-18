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
  PasswordInput,
  Anchor,
} from "@mantine/core";
import { Link, useNavigate } from "@tanstack/react-router";
import { signUpWithEmail } from "../lib/auth-client";

/**
 * SignupPage - User registration form
 * 
 * US-020 Acceptance Criteria:
 * - Create /signup route with registration form
 * - Integrate with Better Auth endpoints
 * - Redirect to /chat after successful signup
 * - Show validation errors appropriately
 */
export function SignupPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Basic validation
    if (!name.trim()) {
      setError("Name is required");
      setLoading(false);
      return;
    }

    if (!email.trim()) {
      setError("Email is required");
      setLoading(false);
      return;
    }

    if (!password) {
      setError("Password is required");
      setLoading(false);
      return;
    }

    if (password.length < 8) {
      setError("Password must be at least 8 characters");
      setLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setLoading(false);
      return;
    }

    try {
      const result = await signUpWithEmail(email, password, name, "/chat");
      
      if (result?.error) {
        setError(result.error.message ?? "Registration failed. Please try again.");
        setLoading(false);
        return;
      }

      // If no automatic redirect, navigate manually
      navigate({ to: "/chat" });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Registration failed. Please try again."
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
            AWS Manager
          </Title>
        </Center>

        <Paper withBorder shadow="md" p={30} radius="md">
          <Title order={2} ta="center" mb="md">
            Create an account
          </Title>
          <Text c="dimmed" size="sm" ta="center" mb="lg">
            Get started with AWS cost optimization
          </Text>

          {error && (
            <Alert color="red" mb="md" variant="light">
              {error}
            </Alert>
          )}

          <form onSubmit={handleSubmit}>
            <Stack>
              <TextInput
                label="Full Name"
                placeholder="John Doe"
                required
                value={name}
                onChange={(e) => setName(e.currentTarget.value)}
                disabled={loading}
                autoComplete="name"
              />
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
              <PasswordInput
                label="Password"
                placeholder="Create a password"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                disabled={loading}
                autoComplete="new-password"
                description="Must be at least 8 characters"
              />
              <PasswordInput
                label="Confirm Password"
                placeholder="Confirm your password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.currentTarget.value)}
                disabled={loading}
                autoComplete="new-password"
              />

              <Button type="submit" fullWidth loading={loading}>
                Create account
              </Button>
            </Stack>
          </form>

          <Text c="dimmed" size="sm" ta="center" mt="md">
            Already have an account?{" "}
            <Anchor component={Link} to="/login" size="sm">
              Sign in
            </Anchor>
          </Text>
        </Paper>
      </Container>
    </Box>
  );
}

export default SignupPage;
