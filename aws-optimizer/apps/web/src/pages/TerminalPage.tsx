import { useState, useCallback, useMemo } from "react";
import {
  Container,
  Paper,
  Title,
  Text,
  Group,
  Stack,
  Button,
  TextInput,
  Select,
  Switch,
  Alert,
  Badge,
  Code,
  ScrollArea,
  Box,
  Tooltip,
  Divider,
  Loader,
} from "@mantine/core";
import {
  IconTerminal2,
  IconPlayerPlay,
  IconHistory,
  IconAlertTriangle,
  IconCheck,
  IconX,
  IconClock,
  IconShieldLock,
  IconShieldOff,
} from "@tabler/icons-react";
import { useQuery, useAction } from "convex/react";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  connectionType: string;
  status: string;
}

interface CommandResult {
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number;
  executionTime: number;
}

interface HistoryEntry {
  id: string;
  command: string;
  accountId: string;
  accountName: string;
  result: CommandResult;
  timestamp: number;
}

// List of AWS CLI commands that modify resources (write operations)
const WRITE_COMMAND_PATTERNS = [
  // EC2
  /\brun-instances\b/,
  /\bterminate-instances\b/,
  /\bstop-instances\b/,
  /\bstart-instances\b/,
  /\breboot-instances\b/,
  /\bcreate-/,
  /\bdelete-/,
  /\bmodify-/,
  /\bupdate-/,
  /\bput-/,
  /\bremove-/,
  /\battach-/,
  /\bdetach-/,
  /\bassociate-/,
  /\bdisassociate-/,
  /\benable-/,
  /\bdisable-/,
  /\bregister-/,
  /\bderegister-/,
  /\bauthorize-/,
  /\brevoke-/,
  /\brelease-/,
  /\ballocate-/,
  // S3
  /\brm\b/,
  /\bmv\b/,
  /\bcp\b.*--delete/,
  /\bsync\b.*--delete/,
  /\brb\b/,
  /\bmb\b/,
  // IAM
  /\bcreate-user\b/,
  /\bdelete-user\b/,
  /\bcreate-role\b/,
  /\bdelete-role\b/,
  /\bcreate-policy\b/,
  /\bdelete-policy\b/,
  // Lambda
  /\binvoke\b/,
  // General dangerous patterns
  /--force\b/,
  /--yes\b/,
];

function isWriteCommand(command: string): boolean {
  const lowerCommand = command.toLowerCase();
  return WRITE_COMMAND_PATTERNS.some((pattern) => pattern.test(lowerCommand));
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString();
}

export function TerminalPage() {
  // State
  const [command, setCommand] = useState("");
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(null);
  const [isReadOnlyMode, setIsReadOnlyMode] = useState(true);
  const [isExecuting, setIsExecuting] = useState(false);
  const [currentResult, setCurrentResult] = useState<CommandResult | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);

  // Fetch accounts
  // Fetch data - these APIs work without arguments, they get org from auth context
  const accountsData = useQuery(api.awsAccounts.listByOrganization);
  const accounts = accountsData as AwsAccount[] | undefined;
  const executeCommand = useAction(api.sandbox.executeCommand);

  // Filter to only active accounts
  const activeAccounts = useMemo(() => {
    if (!accounts) return [];
    return accounts.filter((a) => a.status === "active");
  }, [accounts]);

  // Account options for select
  const accountOptions = useMemo(() => {
    return activeAccounts.map((a) => ({
      value: a._id,
      label: `${a.name} (${a.accountNumber})`,
    }));
  }, [activeAccounts]);

  // Get selected account name
  const selectedAccountName = useMemo(() => {
    const account = activeAccounts.find((a) => a._id === selectedAccountId);
    return account?.name || "";
  }, [activeAccounts, selectedAccountId]);

  // Check if current command is a write command
  const isCurrentCommandWrite = useMemo(() => {
    return isWriteCommand(command);
  }, [command]);

  // Determine if command can be executed
  const canExecute = useMemo(() => {
    if (!selectedAccountId) return false;
    if (!command.trim()) return false;
    if (isReadOnlyMode && isCurrentCommandWrite) return false;
    return true;
  }, [selectedAccountId, command, isReadOnlyMode, isCurrentCommandWrite]);

  // Handle command execution
  const handleExecute = useCallback(async () => {
    if (!canExecute || !selectedAccountId) return;

    const trimmedCommand = command.trim();
    if (!trimmedCommand) return;

    // Validate it's an AWS command
    if (!trimmedCommand.startsWith("aws ")) {
      setCurrentResult({
        success: false,
        stdout: "",
        stderr: "Error: Only AWS CLI commands are allowed. Command must start with 'aws '.",
        exitCode: 1,
        executionTime: 0,
      });
      return;
    }

    setIsExecuting(true);
    setCurrentResult(null);

    try {
      const result = await executeCommand({
        awsAccountId: selectedAccountId as Id<"awsAccounts">,
        command: trimmedCommand,
      });

      setCurrentResult(result);

      // Add to history
      const historyEntry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
        command: trimmedCommand,
        accountId: selectedAccountId,
        accountName: selectedAccountName,
        result,
        timestamp: Date.now(),
      };

      setHistory((prev) => [historyEntry, ...prev]);
      setCommand("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
      setCurrentResult({
        success: false,
        stdout: "",
        stderr: `Error: ${errorMessage}`,
        exitCode: 1,
        executionTime: 0,
      });
    } finally {
      setIsExecuting(false);
    }
  }, [canExecute, selectedAccountId, command, executeCommand, selectedAccountName]);

  // Handle Enter key press
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleExecute();
      }
    },
    [handleExecute]
  );

  // Handle history item click
  const handleHistoryClick = useCallback((entry: HistoryEntry) => {
    setCommand(entry.command);
  }, []);

  // Handle read-only toggle
  const handleReadOnlyToggle = useCallback(() => {
    setIsReadOnlyMode((prev) => !prev);
  }, []);

  return (
    <Container data-testid="terminal-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>Terminal</Title>
            <Text c="dimmed" size="sm">
              Execute AWS CLI commands directly for debugging and exploration
            </Text>
          </Stack>
          <Badge
            variant="light"
            color="violet"
            size="lg"
            leftSection={<IconTerminal2 size={14} />}
          >
            Power User
          </Badge>
        </Group>

        {/* Read-only mode warning when disabled */}
        {!isReadOnlyMode && (
          <Alert
            color="orange"
            icon={<IconAlertTriangle size={16} />}
            title="Write Commands Enabled"
          >
            <Text size="sm">
              Caution: Read-only mode is disabled. Write commands that modify AWS resources are now
              allowed. Use with care.
            </Text>
          </Alert>
        )}

        {/* Command Input Section */}
        <Paper withBorder p="md">
          <Stack gap="md">
            {/* Account Selector and Read-only Toggle */}
            <Group grow align="flex-end">
              <Box data-testid="account-selector">
                <Select
                  label="AWS Account"
                  placeholder="Select an account"
                  data={accountOptions}
                  value={selectedAccountId}
                  onChange={setSelectedAccountId}
                  searchable
                  clearable
                  leftSection={<IconShieldLock size={16} />}
                />
              </Box>
              <Group gap="md" align="center" style={{ paddingBottom: 2 }}>
                <Tooltip label={isReadOnlyMode ? "Only read commands allowed" : "Write commands allowed"}>
                  <Group gap="xs">
                    <Switch
                      data-testid="read-only-toggle"
                      checked={isReadOnlyMode}
                      onChange={handleReadOnlyToggle}
                      label="Read-only mode"
                      thumbIcon={
                        isReadOnlyMode ? (
                          <IconShieldLock size={12} />
                        ) : (
                          <IconShieldOff size={12} />
                        )
                      }
                    />
                  </Group>
                </Tooltip>
              </Group>
            </Group>

            {/* Command Input */}
            <Group gap="sm" align="flex-end">
              <TextInput
                data-testid="command-input"
                placeholder="aws s3 ls"
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isExecuting}
                style={{ flex: 1 }}
                size="md"
                leftSection={<Text size="sm" c="dimmed">$</Text>}
                styles={{
                  input: {
                    fontFamily: "monospace",
                  },
                }}
              />
              <Button
                leftSection={isExecuting ? <Loader size={16} /> : <IconPlayerPlay size={16} />}
                onClick={handleExecute}
                disabled={!canExecute || isExecuting}
                size="md"
                aria-label="Run command"
              >
                Run
              </Button>
            </Group>

            {/* Write command warning in read-only mode */}
            {isReadOnlyMode && isCurrentCommandWrite && command.trim() && (
              <Alert color="red" icon={<IconAlertTriangle size={16} />}>
                <Text size="sm">
                  This command appears to be a write operation and is blocked in read-only mode.
                  Disable read-only mode to execute write commands.
                </Text>
              </Alert>
            )}
          </Stack>
        </Paper>

        {/* Output Section */}
        <Paper data-testid="command-output" withBorder p="md">
          <Stack gap="sm">
            <Group justify="space-between" align="center">
              <Text fw={500}>Output</Text>
              {currentResult && (
                <Group gap="xs">
                  <Badge
                    color={currentResult.exitCode === 0 ? "green" : "red"}
                    variant="light"
                    leftSection={
                      currentResult.exitCode === 0 ? (
                        <IconCheck size={12} />
                      ) : (
                        <IconX size={12} />
                      )
                    }
                  >
                    Exit: {currentResult.exitCode}
                  </Badge>
                  <Badge variant="light" color="gray" leftSection={<IconClock size={12} />}>
                    {currentResult.executionTime} ms
                  </Badge>
                </Group>
              )}
            </Group>

            <ScrollArea h={300} type="auto">
              {isExecuting ? (
                <Group justify="center" py="xl">
                  <Loader size="sm" />
                  <Text size="sm" c="dimmed">
                    Executing command...
                  </Text>
                </Group>
              ) : currentResult ? (
                <Stack gap="xs">
                  {currentResult.stdout && (
                    <Code
                      block
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        backgroundColor: "var(--mantine-color-dark-8)",
                        color: "var(--mantine-color-green-4)",
                      }}
                    >
                      {currentResult.stdout}
                    </Code>
                  )}
                  {currentResult.stderr && (
                    <Code
                      block
                      style={{
                        whiteSpace: "pre-wrap",
                        wordBreak: "break-word",
                        backgroundColor: "var(--mantine-color-dark-8)",
                        color: "var(--mantine-color-red-4)",
                      }}
                    >
                      {currentResult.stderr}
                    </Code>
                  )}
                  {!currentResult.stdout && !currentResult.stderr && (
                    <Text size="sm" c="dimmed" ta="center" py="md">
                      Command completed with no output
                    </Text>
                  )}
                </Stack>
              ) : (
                <Text size="sm" c="dimmed" ta="center" py="xl">
                  Run a command to see output here
                </Text>
              )}
            </ScrollArea>
          </Stack>
        </Paper>

        {/* Command History Section */}
        <Paper data-testid="command-history" withBorder p="md">
          <Stack gap="sm">
            <Group gap="xs">
              <IconHistory size={16} />
              <Text fw={500}>Command History</Text>
              <Badge variant="light" size="sm">
                {history.length} command{history.length !== 1 ? "s" : ""}
              </Badge>
            </Group>

            <Divider />

            <ScrollArea h={200} type="auto">
              {history.length === 0 ? (
                <Text size="sm" c="dimmed" ta="center" py="md">
                  No commands executed yet this session
                </Text>
              ) : (
                <Stack gap="xs">
                  {history.map((entry, index) => (
                    <Paper
                      key={entry.id}
                      data-testid={`history-item-${index}`}
                      p="xs"
                      withBorder
                      style={{ cursor: "pointer" }}
                      onClick={() => handleHistoryClick(entry)}
                    >
                      <Group justify="space-between" wrap="nowrap">
                        <Group gap="xs" style={{ flex: 1, minWidth: 0 }}>
                          <Code
                            style={{
                              fontFamily: "monospace",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {entry.command}
                          </Code>
                        </Group>
                        <Group gap="xs" wrap="nowrap">
                          <Tooltip label={entry.accountName}>
                            <Badge size="xs" variant="outline">
                              {entry.accountName.substring(0, 10)}
                              {entry.accountName.length > 10 ? "..." : ""}
                            </Badge>
                          </Tooltip>
                          <Badge
                            size="xs"
                            color={entry.result.exitCode === 0 ? "green" : "red"}
                            variant="light"
                          >
                            {entry.result.exitCode === 0 ? "OK" : "ERR"}
                          </Badge>
                          <Text size="xs" c="dimmed">
                            {formatTimestamp(entry.timestamp)}
                          </Text>
                        </Group>
                      </Group>
                    </Paper>
                  ))}
                </Stack>
              )}
            </ScrollArea>
          </Stack>
        </Paper>
      </Stack>
    </Container>
  );
}

export default TerminalPage;
