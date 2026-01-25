import { useState, useEffect } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Button,
  Stack,
  Center,
  Loader,
  Alert,
  Group,
} from "@mantine/core";
import { IconCheck, IconX, IconBuilding } from "@tabler/icons-react";
import { useParams, useNavigate } from "@tanstack/react-router";
import { organizationMethods, useSession } from "../lib/auth-client";
import { showSuccessToast, showErrorToast } from "../lib/notifications";

type InvitationStatus = "loading" | "ready" | "accepting" | "accepted" | "error" | "expired";

interface InvitationData {
  organizationName: string;
  role: string;
  inviterName: string;
  email: string;
}

export function AcceptInvitationPage() {
  // Use strict: false to avoid type errors when route isn't defined in the router
  const params = useParams({ strict: false }) as { invitationId?: string };
  const invitationId = params.invitationId;
  const navigate = useNavigate();
  const { data: session, isPending: isSessionLoading } = useSession();
  
  const [status, setStatus] = useState<InvitationStatus>("loading");
  const [invitation, setInvitation] = useState<InvitationData | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Check if user is logged in
  const isLoggedIn = !!session?.user;

  useEffect(() => {
    // Simulate fetching invitation details
    // In production, this would call an API to get invitation info
    const fetchInvitation = async () => {
      try {
        // For now, set a placeholder - the actual invitation data
        // would come from the Better Auth API
        setInvitation({
          organizationName: "Organization",
          role: "member",
          inviterName: "Team Admin",
          email: session?.user?.email || "",
        });
        setStatus("ready");
      } catch (error) {
        setStatus("error");
        setErrorMessage("Failed to load invitation details");
      }
    };

    if (!isSessionLoading) {
      fetchInvitation();
    }
  }, [invitationId, isSessionLoading, session]);

  const handleAccept = async () => {
    if (!invitationId) return;

    setStatus("accepting");
    try {
      const result = await organizationMethods.acceptInvitation(invitationId);
      if (result.error) {
        setStatus("error");
        setErrorMessage(result.error.message || "Failed to accept invitation");
        showErrorToast("Failed to accept invitation");
      } else {
        setStatus("accepted");
        showSuccessToast("You've joined the organization!");
        // Redirect to dashboard after a short delay
        setTimeout(() => {
          navigate({ to: "/dashboard" });
        }, 2000);
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("An unexpected error occurred");
      showErrorToast("Failed to accept invitation");
    }
  };

  const handleDecline = () => {
    // Simply navigate away - the invitation remains pending
    navigate({ to: "/" });
  };

  const handleLogin = () => {
    // Redirect to login with return URL
    navigate({ to: "/login", search: { redirect: `/accept-invitation/${invitationId}` } });
  };

  if (isSessionLoading || status === "loading") {
    return (
      <Container size="xs" py={100}>
        <Center>
          <Stack align="center" gap="md">
            <Loader size="lg" />
            <Text c="dimmed">Loading invitation...</Text>
          </Stack>
        </Center>
      </Container>
    );
  }

  if (status === "error" || status === "expired") {
    return (
      <Container size="xs" py={100}>
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconX size={48} color="var(--mantine-color-red-6)" />
            <Title order={2}>Invitation Error</Title>
            <Text c="dimmed" ta="center">
              {errorMessage || "This invitation is invalid or has expired."}
            </Text>
            <Button variant="light" onClick={() => navigate({ to: "/" })}>
              Go to Home
            </Button>
          </Stack>
        </Paper>
      </Container>
    );
  }

  if (status === "accepted") {
    return (
      <Container size="xs" py={100}>
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconCheck size={48} color="var(--mantine-color-green-6)" />
            <Title order={2}>Welcome!</Title>
            <Text c="dimmed" ta="center">
              You've successfully joined {invitation?.organizationName}.
              Redirecting to dashboard...
            </Text>
            <Loader size="sm" />
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Not logged in - prompt to login
  if (!isLoggedIn) {
    return (
      <Container size="xs" py={100}>
        <Paper shadow="sm" p="xl" radius="md" withBorder>
          <Stack align="center" gap="md">
            <IconBuilding size={48} color="var(--mantine-color-orange-6)" />
            <Title order={2}>Organization Invitation</Title>
            <Text c="dimmed" ta="center">
              You've been invited to join an organization.
              Please log in or create an account to accept.
            </Text>
            <Group>
              <Button variant="light" onClick={handleDecline}>
                Cancel
              </Button>
              <Button onClick={handleLogin}>
                Log In to Accept
              </Button>
            </Group>
          </Stack>
        </Paper>
      </Container>
    );
  }

  // Ready to accept
  return (
    <Container size="xs" py={100}>
      <Paper shadow="sm" p="xl" radius="md" withBorder>
        <Stack gap="lg">
          <Stack align="center" gap="sm">
            <IconBuilding size={48} color="var(--mantine-color-orange-6)" />
            <Title order={2} ta="center">Join Organization</Title>
          </Stack>

          <Alert color="blue" variant="light">
            <Text size="sm">
              <strong>{invitation?.inviterName}</strong> has invited you to join{" "}
              <strong>{invitation?.organizationName}</strong> as a{" "}
              <strong style={{ textTransform: "capitalize" }}>{invitation?.role}</strong>.
            </Text>
          </Alert>

          <Text c="dimmed" size="sm" ta="center">
            By accepting, you'll have access to the organization's AWS cost data,
            reports, and recommendations.
          </Text>

          <Group justify="center" mt="md">
            <Button variant="light" color="gray" onClick={handleDecline}>
              Decline
            </Button>
            <Button
              onClick={handleAccept}
              loading={status === "accepting"}
            >
              Accept Invitation
            </Button>
          </Group>
        </Stack>
      </Paper>
    </Container>
  );
}
