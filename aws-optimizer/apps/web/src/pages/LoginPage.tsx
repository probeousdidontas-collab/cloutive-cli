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
  Group,
} from "@mantine/core";
import { Link, useSearch, useNavigate } from "@tanstack/react-router";
import { signInWithEmail } from "../lib/auth-client";

/**
 * LoginPage - Email/password login form
 * 
 * US-020 Acceptance Criteria:
 * - Create /login route with email/password form
 * - Integrate with Better Auth endpoints
 * - Redirect to /chat after successful login
 * - Show validation errors appropriately
 */
export function LoginPage() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const navigate = useNavigate();
  
  // Get return URL from search params, default to /chat
  const search = useSearch({ strict: false }) as { returnTo?: string };
  const returnTo = search.returnTo || "/chat";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Basic validation
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

    try {
      const result = await signInWithEmail(email, password, returnTo);
      
      if (result?.error) {
        setError(result.error.message ?? "Invalid email or password");
        setLoading(false);
        return;
      }

      // If no automatic redirect, navigate manually
      navigate({ to: returnTo });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Sign in failed. Please try again."
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
            Welcome back
          </Title>
          <Text c="dimmed" size="sm" ta="center" mb="lg">
            Sign in to access your dashboard
          </Text>

          {error && (
            <Alert color="red" mb="md" variant="light">
              {error}
            </Alert>
          )}

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
              <PasswordInput
                label="Password"
                placeholder="Your password"
                required
                value={password}
                onChange={(e) => setPassword(e.currentTarget.value)}
                disabled={loading}
                autoComplete="current-password"
              />
              
              <Group justify="flex-end">
                <Anchor component={Link} to="/forgot-password" size="sm">
                  Forgot password?
                </Anchor>
              </Group>

              <Button type="submit" fullWidth loading={loading}>
                Sign in
              </Button>
            </Stack>
          </form>

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

export default LoginPage;
