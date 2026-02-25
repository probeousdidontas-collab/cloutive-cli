import { useState, useRef, useEffect } from "react";
import {
  Box,
  Group,
  Stack,
  TextInput,
  ActionIcon,
  Paper,
  Text,
  ScrollArea,
  Avatar,
  Loader,
  NavLink,
  Button,
  Divider,
  Tooltip,
  Center,
} from "@mantine/core";
import {
  IconSend,
  IconPlus,
  IconMessageCircle,
  IconRobot,
  IconUser,
  IconTrash,
} from "@tabler/icons-react";
import { useQuery, useMutation } from "convex/react";
import { showErrorToast } from "../lib/notifications";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import { useSession } from "../lib/auth-client";

interface Message {
  _id: string;
  role: "user" | "assistant";
  message: { type: string; text: string } | string;
  _creationTime: number;
}

interface Thread {
  id: string;
  title: string;
  createdAt?: number;
  status?: string;
  _id?: string;
  _creationTime?: number;
}

function getMessageText(message: Message["message"]): string {
  if (typeof message === "string") {
    return message;
  }
  if (message && typeof message === "object" && "text" in message) {
    return message.text;
  }
  return "";
}

export function ChatPage() {
  const { data: session, isPending: isSessionPending } = useSession();
  const [inputValue, setInputValue] = useState("");
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

  // Wait for authentication before executing queries
  const isAuthenticated = !isSessionPending && session !== null;

  // Convex queries and mutations - skip until authenticated
  const threads = useQuery(
    api.ai.threads.list,
    isAuthenticated ? { paginationOpts: { numItems: 50, cursor: null } } : "skip"
  );
  const messages = useQuery(
    api.ai.chat.listThreadMessages,
    isAuthenticated && selectedThreadId
      ? { threadId: selectedThreadId, paginationOpts: { numItems: 100, cursor: null } }
      : "skip"
  );
  const sendMessage = useMutation(api.ai.chat.sendMessage);
  const createThread = useMutation(api.ai.threads.create);
  const removeThread = useMutation(api.ai.threads.remove);

  // Auto-select first thread if none selected
  useEffect(() => {
    if (!selectedThreadId && threads?.page && threads.page.length > 0) {
      setSelectedThreadId(threads.page[0].id);
    }
  }, [threads, selectedThreadId]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    if (scrollAreaRef.current && typeof scrollAreaRef.current.scrollTo === "function") {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: "smooth" });
    }
  }, [messages]);

  const handleSend = async () => {
    if (!inputValue.trim() || !selectedThreadId) return;

    const messageText = inputValue.trim();
    setInputValue("");
    setIsLoading(true);

    try {
      await sendMessage({ threadId: selectedThreadId, prompt: messageText });
    } catch {
      showErrorToast("Failed to send message. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleNewThread = async () => {
    try {
      const result = await createThread({ title: "New conversation" });
      if (result?.threadId) {
        setSelectedThreadId(result.threadId);
      }
    } catch {
      showErrorToast("Failed to create conversation. Please try again.");
    }
  };

  const handleDeleteThread = async (threadId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await removeThread({ threadId });
      if (selectedThreadId === threadId) {
        setSelectedThreadId(null);
      }
    } catch {
      showErrorToast("Failed to delete conversation. Please try again.");
    }
  };

  // Cast messages to Message[] type - the agent library returns messages with role field
  // Use unknown intermediate cast since the types don't overlap sufficiently
  const messageList = (messages?.page || []) as unknown as Message[];
  // Map threads to ensure consistent interface
  const threadList: Thread[] = (threads?.page || []).map((t: { id?: string; _id?: string; title?: string; createdAt?: number; _creationTime?: number; status?: string }) => ({
    id: t.id || t._id || "",
    title: t.title || "Untitled",
    createdAt: t.createdAt || t._creationTime,
    status: t.status,
  }));

  // Show loading state while waiting for authentication
  if (isSessionPending) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="chat-page-loading">
        <Stack align="center" gap="md">
          <Loader size="lg" />
          <Text c="dimmed">Loading...</Text>
        </Stack>
      </Center>
    );
  }

  // Show message if not authenticated
  if (!isAuthenticated) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="chat-page-unauthenticated">
        <Paper p="xl" ta="center" withBorder>
          <IconUser size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            Please sign in to continue
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be signed in to use the AI chat assistant.
          </Text>
          <Button component="a" href="/login" mt="md">
            Sign In
          </Button>
        </Paper>
      </Center>
    );
  }

  return (
    <Box data-testid="chat-page" h="calc(100vh - 120px)" style={{ display: "flex" }}>
      {/* Thread Sidebar */}
      <Paper
        data-testid="thread-list"
        w={280}
        p="md"
        withBorder
        style={{ borderRight: "1px solid var(--mantine-color-default-border)", flexShrink: 0 }}
      >
        <Stack gap="sm" h="100%">
          <Button
            leftSection={<IconPlus size={16} />}
            variant="light"
            fullWidth
            onClick={handleNewThread}
            aria-label="New conversation"
          >
            New Chat
          </Button>

          <Divider label="Conversations" labelPosition="center" />

          <ScrollArea style={{ flex: 1 }}>
            <Stack gap={4}>
              {threadList.map((thread) => (
                <NavLink
                  key={thread.id}
                  label={thread.title}
                  leftSection={<IconMessageCircle size={16} />}
                  active={selectedThreadId === thread.id}
                  onClick={() => setSelectedThreadId(thread.id)}
                  rightSection={
                    <Tooltip label="Delete thread">
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        color="red"
                        onClick={(e) => handleDeleteThread(thread.id, e)}
                        aria-label="Delete thread"
                      >
                        <IconTrash size={14} />
                      </ActionIcon>
                    </Tooltip>
                  }
                />
              ))}
              {threadList.length === 0 && (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  No conversations yet
                </Text>
              )}
            </Stack>
          </ScrollArea>
        </Stack>
      </Paper>

      {/* Chat Area */}
      <Box style={{ flex: 1, display: "flex", flexDirection: "column" }}>
        {/* Message Area */}
        <ScrollArea
          data-testid="message-area"
          style={{ flex: 1 }}
          viewportRef={scrollAreaRef}
          p="md"
        >
          <Stack gap="md" maw={800} mx="auto">
            {messageList.length === 0 && selectedThreadId && (
              <Paper p="xl" ta="center" c="dimmed">
                <IconRobot size={48} style={{ opacity: 0.5 }} />
                <Text size="lg" mt="md">
                  Start a conversation
                </Text>
                <Text size="sm" mt="xs">
                  Ask me anything about your AWS costs and I'll help you optimize them.
                </Text>
              </Paper>
            )}

            {!selectedThreadId && (
              <Paper p="xl" ta="center" c="dimmed">
                <IconMessageCircle size={48} style={{ opacity: 0.5 }} />
                <Text size="lg" mt="md">
                  Select or create a conversation
                </Text>
                <Text size="sm" mt="xs">
                  Click "New Chat" to start a new conversation with the AI assistant.
                </Text>
              </Paper>
            )}

            {messageList.map((msg) => (
              <MessageBubble
                key={msg._id}
                role={msg.role}
                content={getMessageText(msg.message)}
                userName={session?.user?.name || "User"}
              />
            ))}

            {isLoading && (
              <Group gap="sm" p="md">
                <Avatar size="sm" radius="xl" color="blue">
                  <IconRobot size={16} />
                </Avatar>
                <Loader size="sm" type="dots" />
              </Group>
            )}
          </Stack>
        </ScrollArea>

        {/* Chat Input */}
        <Paper p="md" withBorder style={{ borderTop: "1px solid var(--mantine-color-default-border)" }}>
          <Group gap="sm" maw={800} mx="auto">
            <TextInput
              data-testid="chat-input"
              placeholder="Ask about your AWS costs..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={!selectedThreadId || isLoading}
              style={{ flex: 1 }}
              size="md"
            />
            <ActionIcon
              size="lg"
              variant="filled"
              color="blue"
              onClick={handleSend}
              disabled={!inputValue.trim() || !selectedThreadId || isLoading}
              aria-label="Send message"
            >
              <IconSend size={18} />
            </ActionIcon>
          </Group>
        </Paper>
      </Box>
    </Box>
  );
}

interface MessageBubbleProps {
  role: "user" | "assistant";
  content: string;
  userName: string;
}

function MessageBubble({ role, content, userName }: MessageBubbleProps) {
  const isUser = role === "user";

  return (
    <Group
      align="flex-start"
      gap="sm"
      data-message-role={role}
      style={{ flexDirection: isUser ? "row-reverse" : "row" }}
    >
      <Avatar size="sm" radius="xl" color={isUser ? "orange" : "blue"}>
        {isUser ? <IconUser size={16} /> : <IconRobot size={16} />}
      </Avatar>
      <Paper
        p="sm"
        radius="md"
        maw="70%"
        bg={isUser ? "blue.0" : "gray.0"}
        style={{
          borderTopRightRadius: isUser ? 0 : undefined,
          borderTopLeftRadius: isUser ? undefined : 0,
        }}
      >
        <Text size="xs" c="dimmed" mb={4}>
          {isUser ? userName : "AWS Cost Assistant"}
        </Text>
        <Text size="sm" style={{ whiteSpace: "pre-wrap" }}>
          {content}
        </Text>
      </Paper>
    </Group>
  );
}
