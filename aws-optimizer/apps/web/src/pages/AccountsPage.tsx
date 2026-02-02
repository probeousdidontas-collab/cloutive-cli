import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  Group,
  Stack,
  Title,
  Text,
  Button,
  Paper,
  Badge,
  Table,
  Modal,
  TextInput,
  Tabs,
  Alert,
  ActionIcon,
  Tooltip,
  Code,
  CopyButton,
  Divider,
  Container,
  Select,
  Box,
  rem,
  useMantineTheme,
  Checkbox,
  Progress,
  Stepper,
  ScrollArea,
  Center,
  Loader,
} from "@mantine/core";
import { useDisclosure } from "@mantine/hooks";
import {
  IconPlus,
  IconCloud,
  IconKey,
  IconTrash,
  IconCheck,
  IconAlertCircle,
  IconClock,
  IconDownload,
  IconCopy,
  IconRefresh,
  IconUpload,
  IconFile,
  IconX,
  IconBuildingSkyscraper,
  IconSearch,
  IconArrowRight,
  IconCheckbox,
  IconUser,
} from "@tabler/icons-react";
import { useQuery, useMutation, useAction } from "convex/react";
import { observer } from "mobx-react-lite";
import { useSession, IS_TEST_MODE } from "../lib/auth-client";
import { useOrganization } from "../hooks/useOrganization";
import { showSuccessToast, showErrorToast, showWarningToast } from "../lib/notifications";
import { api } from "@aws-optimizer/convex/convex/_generated/api";
import {
  parseCredentialsFile,
  getFormatDisplayName,
  isTemporaryCredentials,
  isCredentialExpired,
  getCredentialExpiryStatus,
  formatExpiryTime,
  type ParsedCredential,
  type ParseResult,
} from "../lib/credentials-parser";
import type { Id } from "@aws-optimizer/convex/convex/_generated/dataModel";

type AwsAccountStatus = "active" | "inactive" | "pending" | "error";
type ConnectionType = "iam_role" | "access_key" | "credentials_file" | "sso" | "oidc";
type DiscoveryStatus = "pending" | "discovering" | "discovered" | "deploying" | "completed" | "failed";
type DiscoveredAccountStatus = "discovered" | "selected" | "connecting" | "connected" | "skipped" | "failed";

interface AwsAccount {
  _id: string;
  name: string;
  accountNumber: string;
  connectionType: ConnectionType;
  status: AwsAccountStatus;
  description?: string;
  region?: string;
  lastVerifiedAt?: number;
  createdAt: number;
  updatedAt: number;
}

interface DiscoverySession {
  _id: string;
  organizationId: string;
  managementAccountNumber: string;
  status: DiscoveryStatus;
  statusMessage?: string;
  totalAccountsFound?: number;
  accountsSelected?: number;
  accountsConnected?: number;
  startedAt: number;
  completedAt?: number;
}

interface DiscoveredAccount {
  _id: string;
  discoveryId: string;
  accountNumber: string;
  accountName: string;
  email: string;
  awsStatus: string;
  joinedMethod: string;
  joinedTimestamp: number;
  status: DiscoveredAccountStatus;
  statusMessage?: string;
}

function getStatusColor(status: AwsAccountStatus): string {
  switch (status) {
    case "active":
      return "green";
    case "pending":
      return "yellow";
    case "error":
      return "red";
    case "inactive":
      return "gray";
    default:
      return "gray";
  }
}

function getStatusIcon(status: AwsAccountStatus) {
  switch (status) {
    case "active":
      return <IconCheck size={14} />;
    case "pending":
      return <IconClock size={14} />;
    case "error":
      return <IconAlertCircle size={14} />;
    default:
      return null;
  }
}

function formatConnectionType(type: ConnectionType): string {
  switch (type) {
    case "iam_role":
      return "IAM Role";
    case "access_key":
      return "Access Key";
    case "credentials_file":
      return "Credentials File";
    case "sso":
      return "SSO";
    case "oidc":
      return "OIDC";
    default:
      return type;
  }
}

function formatRelativeTime(timestamp: number): string {
  const now = Date.now();
  const diff = now - timestamp;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  if (hours < 24) return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export const AccountsPage = observer(function AccountsPage() {
  const { data: session, isPending: isSessionPending } = useSession();

  // Wait for authentication before executing queries
  const isAuthenticated = !isSessionPending && session !== null;

  // Use organization state from MobX store
  const {
    activeOrganization,
    convexOrgId,
    isLoading: isLoadingOrg,
    isReady: isOrgReady,
  } = useOrganization();

  // Use the resolved Convex organization ID from the store
  const organizationId = convexOrgId;
  const theme = useMantineTheme();
  const [connectModalOpened, { open: openConnectModal, close: closeConnectModal }] = useDisclosure(false);
  const [disconnectModalOpened, { open: openDisconnectModal, close: closeDisconnectModal }] = useDisclosure(false);
  const [selectedAccount, setSelectedAccount] = useState<AwsAccount | null>(null);
  const [activeTab, setActiveTab] = useState<string | null>("iam_role");
  const [isLoading, setIsLoading] = useState(false);

  // Credentials file upload state
  const [isDragging, setIsDragging] = useState(false);
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [selectedProfile, setSelectedProfile] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Form state for IAM Role
  const [iamFormData, setIamFormData] = useState({
    name: "",
    accountNumber: "",
    roleArn: "",
    externalId: "",
    description: "",
    region: "",
  });

  // Form state for Access Key
  const [keyFormData, setKeyFormData] = useState({
    name: "",
    accountNumber: "",
    accessKeyId: "",
    secretAccessKey: "",
    description: "",
    region: "",
  });

  // Form state for Credentials File
  const [fileFormData, setFileFormData] = useState({
    name: "",
    accountNumber: "",
    description: "",
    region: "",
  });

  // Form state for AWS Organizations
  const [orgFormData, setOrgFormData] = useState({
    managementAccountNumber: "",
    accessKeyId: "",
    secretAccessKey: "",
    sessionToken: "",
    region: "us-east-1",
    externalId: "",
  });

  // Organizations discovery state
  const [orgDiscoveryStep, setOrgDiscoveryStep] = useState(0);
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

  // Account detection state (for Access Key tab)
  const [keyDetectionLoading, setKeyDetectionLoading] = useState(false);
  const [keyDetectedAccount, setKeyDetectedAccount] = useState<{
    account: string;
    arn: string;
    userId: string;
  } | null>(null);
  const [keyDetectionError, setKeyDetectionError] = useState<string | null>(null);

  // Account detection state (for Upload File tab)
  const [fileDetectionLoading, setFileDetectionLoading] = useState(false);
  const [fileDetectedAccount, setFileDetectedAccount] = useState<{
    account: string;
    arn: string;
    userId: string;
  } | null>(null);
  const [fileDetectionError, setFileDetectionError] = useState<string | null>(null);

  // Generate a unique external ID for new connections
  const generatedExternalId = useMemo(() => {
    return `costopt-${Date.now()}-${Math.random().toString(36).substring(2, 11)}`;
  }, []);

  // Convex queries and mutations
  // Fetch data - pass organizationId to get accounts for the current org
  const accountsData = useQuery(
    api.awsAccounts.listByOrganization,
    convexOrgId ? { organizationId: convexOrgId } : "skip"
  );
  const accounts = accountsData as AwsAccount[] | undefined;
  const cfTemplate = useQuery(api.awsAccounts.generateCloudFormationTemplate, {
    externalId: iamFormData.externalId || generatedExternalId,
  }) as { template: string } | undefined;

  const connectWithRole = useMutation(api.awsAccounts.connectWithRole);
  const connectWithKeys = useMutation(api.awsAccounts.connectWithKeys);
  const connectWithCredentialsFile = useMutation(api.awsAccounts.connectWithCredentialsFile);
  const updateAccountNumber = useMutation(api.awsAccounts.updateAccountNumber);
  const disconnect = useMutation(api.awsAccounts.disconnect);
  const validateCredentials = useAction(api.awsAccounts.validateAwsCredentials);
  const detectAccount = useAction(api.awsAccounts.detectAccountFromCredentials);

  // AWS Organizations discovery
  const startDiscovery = useMutation(api.awsOrganizations.startDiscovery);
  const discoverMemberAccounts = useAction(api.awsOrganizations.discoverMemberAccounts);
  const updateAccountSelections = useMutation(api.awsOrganizations.updateAccountSelections);
  const connectSelectedAccounts = useAction(api.awsOrganizations.connectSelectedAccounts);
  const currentDiscovery = useQuery(api.awsOrganizations.getCurrentDiscovery) as DiscoverySession | null | undefined;
  const discoveredAccounts = useQuery(
    api.awsOrganizations.listDiscoveredAccounts,
    currentDiscovery?._id ? { discoveryId: currentDiscovery._id as Id<"awsOrgDiscoveries"> } : "skip"
  ) as DiscoveredAccount[] | undefined;
  const stackSetTemplate = useQuery(api.awsOrganizations.generateStackSetTemplate, {
    externalId: orgFormData.externalId || generatedExternalId,
  }) as { template: string } | undefined;

  // Sync local selection state with backend state when discoveredAccounts changes
  useEffect(() => {
    if (discoveredAccounts) {
      const selectedFromBackend = discoveredAccounts
        .filter((a) => a.status === "selected")
        .map((a) => a._id);
      setSelectedAccountIds(new Set(selectedFromBackend));
    }
  }, [discoveredAccounts]);

  // Set default external ID when modal opens
  const handleOpenConnectModal = () => {
    setIamFormData((prev) => ({
      ...prev,
      externalId: generatedExternalId,
    }));
    setOrgFormData((prev) => ({
      ...prev,
      externalId: generatedExternalId,
    }));
    setOrgDiscoveryStep(0);
    setSelectedAccountIds(new Set());
    openConnectModal();
  };

  const handleDisconnectClick = (account: AwsAccount) => {
    setSelectedAccount(account);
    openDisconnectModal();
  };

  const handleVerifyCredentials = async (account: AwsAccount) => {
    setIsLoading(true);
    try {
      const validation = await validateCredentials({
        awsAccountId: account._id as Id<"awsAccounts">,
        checkCostExplorer: true,
      });

      if (validation.success) {
        showSuccessToast(`Credentials verified for ${account.name}`);
        if (validation.permissions.some((p: { granted: boolean; permission: string }) => !p.granted)) {
          const missing = validation.permissions
            .filter((p: { granted: boolean; permission: string }) => !p.granted)
            .map((p: { granted: boolean; permission: string }) => p.permission)
            .join(", ");
          showWarningToast(`Missing permissions: ${missing}`);
        }
      } else {
        showErrorToast(validation.errorMessage || "Credential validation failed");
      }
    } catch {
      showErrorToast("Failed to verify credentials");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirmDisconnect = async () => {
    if (!selectedAccount) return;

    setIsLoading(true);
    try {
      await disconnect({
        awsAccountId: selectedAccount._id as Id<"awsAccounts">,
      });
      closeDisconnectModal();
      setSelectedAccount(null);
      showSuccessToast("Account disconnected successfully");
    } catch {
      showErrorToast("Failed to disconnect account. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectWithRole = async () => {
    setIsLoading(true);
    try {
      // In test mode, show mock success since we can't call the backend with test IDs
      if (IS_TEST_MODE) {
        showSuccessToast("[Test Mode] AWS account would be connected via IAM Role");
        showWarningToast("Test mode: No actual connection made. Use real authentication to connect accounts.");
        closeConnectModal();
        resetForms();
        setIsLoading(false);
        return;
      }

      if (!organizationId) {
        showErrorToast("Organization not found. Please try again.");
        return;
      }
      await connectWithRole({
        organizationId,
        name: iamFormData.name,
        accountNumber: iamFormData.accountNumber,
        roleArn: iamFormData.roleArn,
        externalId: iamFormData.externalId,
        description: iamFormData.description || undefined,
        region: iamFormData.region || undefined,
      });
      closeConnectModal();
      resetForms();
      showSuccessToast("AWS account connected successfully");
    } catch {
      showErrorToast("Failed to connect account. Please verify your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle detecting account from access keys
  const handleDetectAccountFromKeys = async () => {
    if (!keyFormData.accessKeyId || !keyFormData.secretAccessKey) {
      showErrorToast("Please enter both Access Key ID and Secret Access Key");
      return;
    }

    setKeyDetectionLoading(true);
    setKeyDetectionError(null);
    setKeyDetectedAccount(null);

    try {
      const result = await detectAccount({
        accessKeyId: keyFormData.accessKeyId,
        secretAccessKey: keyFormData.secretAccessKey,
        region: keyFormData.region || undefined,
      });

      if (result.valid && result.identity) {
        setKeyDetectedAccount(result.identity);
        // Auto-fill the account number
        setKeyFormData((prev) => ({
          ...prev,
          accountNumber: result.identity!.account,
        }));
        showSuccessToast(`Detected AWS account: ${result.identity.account}`);
      } else {
        setKeyDetectionError(result.errorMessage || "Failed to detect account");
        showErrorToast(result.errorMessage || "Failed to detect account");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to detect account";
      setKeyDetectionError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setKeyDetectionLoading(false);
    }
  };

  const handleConnectWithKeys = async () => {
    setIsLoading(true);
    try {
      // In test mode, show mock success since we can't call the backend with test IDs
      if (IS_TEST_MODE) {
        showSuccessToast(
          keyDetectedAccount
            ? `[Test Mode] AWS account ${keyDetectedAccount.account} would be connected`
            : "[Test Mode] AWS account would be connected"
        );
        showWarningToast("Test mode: No actual connection made. Use real authentication to connect accounts.");
        closeConnectModal();
        resetForms();
        setIsLoading(false);
        return;
      }

      if (!organizationId) {
        showErrorToast("Organization not found. Please try again.");
        return;
      }

      // Account number is now optional - pass undefined if empty
      const accountNumberToUse = keyFormData.accountNumber.trim() || undefined;

      const result = await connectWithKeys({
        organizationId,
        name: keyFormData.name,
        accountNumber: accountNumberToUse,
        accessKeyId: keyFormData.accessKeyId,
        secretAccessKey: keyFormData.secretAccessKey,
        description: keyFormData.description || undefined,
        region: keyFormData.region || undefined,
      });

      // Validate credentials after connecting - this also auto-detects account number
      try {
        const validation = await validateCredentials({
          awsAccountId: result.awsAccountId,
          checkCostExplorer: true,
        });

        if (validation.success) {
          // If account number was auto-detected, update it
          if (result.needsAccountDetection && validation.identity?.account) {
            await updateAccountNumber({
              awsAccountId: result.awsAccountId,
              accountNumber: validation.identity.account,
            });
          }
          showSuccessToast(
            result.needsAccountDetection && validation.identity?.account
              ? `AWS account ${validation.identity.account} connected and verified successfully`
              : "AWS account connected and verified successfully"
          );
          if (validation.permissions.some((p: { granted: boolean; permission: string }) => !p.granted)) {
            showWarningToast(
              "Credentials valid but some permissions are missing. Cost analysis may be limited."
            );
          }
        } else {
          showWarningToast(
            validation.errorMessage || "Account connected but credential validation failed"
          );
        }
      } catch {
        showWarningToast("Account connected but validation could not be completed");
      }

      closeConnectModal();
      resetForms();
    } catch {
      showErrorToast("Failed to connect account. Please verify your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  // Handle file drop
  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = e.dataTransfer.files;
    if (files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }, []);

  const handleFileInput = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (files && files.length > 0) {
      processFile(files[0]);
    }
  }, []);

  const processFile = async (file: File) => {
    setUploadedFile(file);
    setSelectedProfile(null);

    try {
      const content = await file.text();
      const result = parseCredentialsFile(content);
      setParseResult(result);

      if (result.success && result.profiles.length === 1) {
        // Auto-select if only one profile
        setSelectedProfile(result.profiles[0].profileName);
      } else if (result.success && result.profiles.length > 1) {
        // Default to "default" profile if available
        const defaultProfile = result.profiles.find((p) => p.profileName === "default");
        if (defaultProfile) {
          setSelectedProfile(defaultProfile.profileName);
        }
      }
    } catch {
      setParseResult({
        success: false,
        profiles: [],
        format: "unknown",
        error: "Failed to read file",
      });
    }
  };

  const clearUploadedFile = () => {
    setUploadedFile(null);
    setParseResult(null);
    setSelectedProfile(null);
    // Clear file detection states
    setFileDetectedAccount(null);
    setFileDetectionError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const getSelectedCredential = (): ParsedCredential | null => {
    if (!parseResult?.success || !selectedProfile) return null;
    return parseResult.profiles.find((p) => p.profileName === selectedProfile) || null;
  };

  // Check if selected credential is expired
  const isSelectedCredentialExpired = (): boolean => {
    const cred = getSelectedCredential();
    if (!cred) return false;
    return isCredentialExpired(cred);
  };

  // Handle detecting account from uploaded credentials file
  const handleDetectAccountFromFile = async () => {
    const credential = getSelectedCredential();
    if (!credential) {
      showErrorToast("Please select a credential profile first");
      return;
    }

    // Check if credentials are expired
    if (isCredentialExpired(credential)) {
      showErrorToast("These credentials have expired. Please use fresh credentials.");
      return;
    }

    setFileDetectionLoading(true);
    setFileDetectionError(null);
    setFileDetectedAccount(null);

    try {
      const result = await detectAccount({
        accessKeyId: credential.accessKeyId,
        secretAccessKey: credential.secretAccessKey,
        sessionToken: credential.sessionToken,
        region: fileFormData.region || credential.region || undefined,
      });

      if (result.valid && result.identity) {
        setFileDetectedAccount(result.identity);
        // Auto-fill the account number
        setFileFormData((prev) => ({
          ...prev,
          accountNumber: result.identity!.account,
        }));
        showSuccessToast(`Detected AWS account: ${result.identity.account}`);
      } else {
        setFileDetectionError(result.errorMessage || "Failed to detect account");
        showErrorToast(result.errorMessage || "Failed to detect account");
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to detect account";
      setFileDetectionError(errorMessage);
      showErrorToast(errorMessage);
    } finally {
      setFileDetectionLoading(false);
    }
  };

  const handleConnectWithCredentialsFile = async () => {
    const credential = getSelectedCredential();
    if (!credential) {
      showErrorToast("Please select a credential profile");
      return;
    }

    setIsLoading(true);
    try {
      // In test mode, show mock success since we can't call the backend with test IDs
      if (IS_TEST_MODE) {
        showSuccessToast(
          fileDetectedAccount
            ? `[Test Mode] AWS account ${fileDetectedAccount.account} would be connected`
            : "[Test Mode] AWS account would be connected"
        );
        showWarningToast("Test mode: No actual connection made. Use real authentication to connect accounts.");
        closeConnectModal();
        resetForms();
        setIsLoading(false);
        return;
      }

      if (!organizationId) {
        showErrorToast("Organization not found. Please try again.");
        return;
      }

      // Account number is now optional - pass undefined if empty
      const accountNumberToUse = fileFormData.accountNumber.trim() || undefined;

      const result = await connectWithCredentialsFile({
        organizationId,
        name: fileFormData.name,
        accountNumber: accountNumberToUse,
        accessKeyId: credential.accessKeyId,
        secretAccessKey: credential.secretAccessKey,
        sessionToken: credential.sessionToken,
        sourceProfile: credential.profileName,
        sourceFormat: parseResult?.format || "unknown",
        description: fileFormData.description || undefined,
        region: fileFormData.region || credential.region || undefined,
        expiresAt: credential.expiresAt,
      });

      // Validate credentials after connecting - this also auto-detects account number
      try {
        const validation = await validateCredentials({
          awsAccountId: result.awsAccountId,
          checkCostExplorer: true,
        });

        if (validation.success) {
          // If account number was auto-detected, update it
          if (result.needsAccountDetection && validation.identity?.account) {
            await updateAccountNumber({
              awsAccountId: result.awsAccountId,
              accountNumber: validation.identity.account,
            });
          }
          showSuccessToast(
            result.needsAccountDetection && validation.identity?.account
              ? `AWS account ${validation.identity.account} connected and verified successfully`
              : "AWS account connected and verified successfully"
          );
          if (validation.permissions.some((p: { granted: boolean; permission: string }) => !p.granted)) {
            showWarningToast(
              "Credentials valid but some permissions are missing. Cost analysis may be limited."
            );
          }
        } else {
          showWarningToast(
            validation.errorMessage || "Account connected but credential validation failed"
          );
        }
      } catch {
        showWarningToast("Account connected but validation could not be completed");
      }

      closeConnectModal();
      resetForms();

      if (result.warning) {
        showWarningToast(result.warning);
      }
    } catch {
      showErrorToast("Failed to connect account. Please verify your credentials and try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetForms = () => {
    setIamFormData({
      name: "",
      accountNumber: "",
      roleArn: "",
      externalId: "",
      description: "",
      region: "",
    });
    setKeyFormData({
      name: "",
      accountNumber: "",
      accessKeyId: "",
      secretAccessKey: "",
      description: "",
      region: "",
    });
    setFileFormData({
      name: "",
      accountNumber: "",
      description: "",
      region: "",
    });
    setOrgFormData({
      managementAccountNumber: "",
      accessKeyId: "",
      secretAccessKey: "",
      sessionToken: "",
      region: "us-east-1",
      externalId: "",
    });
    setOrgDiscoveryStep(0);
    setSelectedAccountIds(new Set());
    clearUploadedFile();
    // Reset detection states
    setKeyDetectedAccount(null);
    setKeyDetectionError(null);
    setFileDetectedAccount(null);
    setFileDetectionError(null);
  };

  // AWS Organizations discovery handlers
  const handleStartDiscovery = async () => {
    if (!organizationId) {
      showErrorToast("Organization not found. Please try again.");
      return;
    }
    setIsLoading(true);
    try {
      const result = await startDiscovery({
        organizationId,
        managementAccountNumber: orgFormData.managementAccountNumber,
        accessKeyId: orgFormData.accessKeyId,
        secretAccessKey: orgFormData.secretAccessKey,
        sessionToken: orgFormData.sessionToken || undefined,
        region: orgFormData.region || undefined,
      });

      // Start the discovery process
      const discoveryResult = await discoverMemberAccounts({
        discoveryId: result.discoveryId,
      });

      if (discoveryResult.success) {
        showSuccessToast(`Discovered ${discoveryResult.accountCount} member accounts`);
        setOrgDiscoveryStep(1);
      } else {
        showErrorToast(discoveryResult.errorMessage || "Failed to discover accounts");
      }
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to start discovery");
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleAccountSelection = (accountId: string) => {
    setSelectedAccountIds((prev) => {
      const next = new Set(prev);
      if (next.has(accountId)) {
        next.delete(accountId);
      } else {
        next.add(accountId);
      }
      return next;
    });
  };

  const handleSelectAllAccounts = () => {
    if (!discoveredAccounts) return;
    const selectableAccounts = discoveredAccounts.filter(
      (a) => a.status === "discovered" || a.status === "selected"
    );
    const allSelected = selectableAccounts.every((a) => selectedAccountIds.has(a._id));

    if (allSelected) {
      setSelectedAccountIds(new Set());
    } else {
      setSelectedAccountIds(new Set(selectableAccounts.map((a) => a._id)));
    }
  };

  const handleSaveSelections = async () => {
    if (!currentDiscovery) return;
    setIsLoading(true);
    try {
      const selections = (discoveredAccounts || []).map((account) => ({
        accountId: account._id as Id<"discoveredAwsAccounts">,
        selected: selectedAccountIds.has(account._id),
      }));

      await updateAccountSelections({
        discoveryId: currentDiscovery._id as Id<"awsOrgDiscoveries">,
        selections,
      });

      showSuccessToast(`${selectedAccountIds.size} accounts selected for connection`);
      setOrgDiscoveryStep(2);
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to save selections");
    } finally {
      setIsLoading(false);
    }
  };

  const handleConnectSelectedAccounts = async () => {
    if (!currentDiscovery) return;
    setIsLoading(true);
    try {
      const result = await connectSelectedAccounts({
        discoveryId: currentDiscovery._id as Id<"awsOrgDiscoveries">,
        externalId: orgFormData.externalId || generatedExternalId,
      });

      if (result.success) {
        showSuccessToast(`Connected ${result.connectedCount} accounts`);
        if (result.failedCount > 0) {
          showWarningToast(`${result.failedCount} accounts failed to connect`);
        }
        closeConnectModal();
        resetForms();
      } else {
        showErrorToast(result.errorMessage || "Failed to connect accounts");
      }
    } catch (error) {
      showErrorToast(error instanceof Error ? error.message : "Failed to connect accounts");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownloadStackSetTemplate = () => {
    if (!stackSetTemplate?.template) return;

    const blob = new Blob([stackSetTemplate.template], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aws-cost-optimizer-stackset-template.yaml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  // Get discovery step info for stepper
  const getDiscoveryStepperActive = () => {
    if (!currentDiscovery) return orgDiscoveryStep;
    switch (currentDiscovery.status) {
      case "pending":
      case "discovering":
        return 0;
      case "discovered":
        return 1;
      case "deploying":
        return 2;
      case "completed":
        return 3;
      case "failed":
        return orgDiscoveryStep;
      default:
        return orgDiscoveryStep;
    }
  };

  const handleDownloadTemplate = () => {
    if (!cfTemplate?.template) return;

    const blob = new Blob([cfTemplate.template], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "aws-cost-optimizer-role.yaml";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const accountList = accounts || [];

  // Show loading state while waiting for authentication, organization, or org resolution
  if (isSessionPending || (isAuthenticated && !isOrgReady)) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="accounts-page-loading">
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
      <Center h="calc(100vh - 120px)" data-testid="accounts-page-unauthenticated">
        <Paper p="xl" ta="center" withBorder>
          <IconUser size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            Please sign in to continue
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be signed in to manage AWS accounts.
          </Text>
          <Button component="a" href="/login" mt="md">
            Sign In
          </Button>
        </Paper>
      </Center>
    );
  }

  // Show message if user has no organization (skip in test mode)
  if (!IS_TEST_MODE && !isLoadingOrg && !activeOrganization) {
    return (
      <Center h="calc(100vh - 120px)" data-testid="accounts-page-no-org">
        <Paper p="xl" ta="center" withBorder>
          <IconCloud size={48} style={{ opacity: 0.5 }} />
          <Text size="lg" mt="md">
            No Organization Found
          </Text>
          <Text size="sm" c="dimmed" mt="xs">
            You need to be a member of an organization to manage AWS accounts.
          </Text>
        </Paper>
      </Center>
    );
  }

  return (
    <Container data-testid="accounts-page" size="xl" py="xl">
      <Stack gap="lg">
        {/* Header */}
        <Group justify="space-between" align="center">
          <Stack gap={4}>
            <Title order={2}>AWS Accounts</Title>
            <Text c="dimmed" size="sm">
              Manage your connected AWS accounts for cost analysis
            </Text>
          </Stack>
          <Button
            leftSection={<IconPlus size={16} />}
            onClick={handleOpenConnectModal}
          >
            Connect Account
          </Button>
        </Group>

        {/* Accounts List */}
        <Paper data-testid="accounts-list" withBorder p="md">
          {accountList.length === 0 ? (
            <Stack align="center" py="xl" gap="md">
              <IconCloud size={48} style={{ opacity: 0.5 }} />
              <Text c="dimmed" ta="center">
                No AWS accounts connected yet.
                <br />
                Click "Connect Account" to get started.
              </Text>
            </Stack>
          ) : (
            <Table highlightOnHover>
              <Table.Thead>
                <Table.Tr>
                  <Table.Th>Name</Table.Th>
                  <Table.Th>Account Number</Table.Th>
                  <Table.Th>Connection Type</Table.Th>
                  <Table.Th>Status</Table.Th>
                  <Table.Th>Last Synced</Table.Th>
                  <Table.Th>Actions</Table.Th>
                </Table.Tr>
              </Table.Thead>
              <Table.Tbody>
                {accountList.map((account) => (
                  <Table.Tr key={account._id}>
                    <Table.Td>
                      <Text fw={500}>{account.name}</Text>
                      {account.description && (
                        <Text size="xs" c="dimmed">
                          {account.description}
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Code>{account.accountNumber}</Code>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        variant="light"
                        leftSection={
                          account.connectionType === "iam_role" ? (
                            <IconCloud size={12} />
                          ) : account.connectionType === "credentials_file" ? (
                            <IconFile size={12} />
                          ) : (
                            <IconKey size={12} />
                          )
                        }
                      >
                        {formatConnectionType(account.connectionType)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      <Badge
                        data-testid={`status-badge-${account.status}`}
                        color={getStatusColor(account.status)}
                        variant="filled"
                        leftSection={getStatusIcon(account.status)}
                      >
                        {account.status.charAt(0).toUpperCase() + account.status.slice(1)}
                      </Badge>
                    </Table.Td>
                    <Table.Td>
                      {account.lastVerifiedAt ? (
                        <Text size="sm">Last synced {formatRelativeTime(account.lastVerifiedAt)}</Text>
                      ) : (
                        <Text size="sm" c="dimmed">
                          Never synced
                        </Text>
                      )}
                    </Table.Td>
                    <Table.Td>
                      <Group gap="xs">
                        <Tooltip label="Verify connection">
                          <ActionIcon
                            variant="light"
                            color="blue"
                            onClick={() => handleVerifyCredentials(account)}
                            loading={isLoading}
                          >
                            <IconRefresh size={16} />
                          </ActionIcon>
                        </Tooltip>
                        <Tooltip label="Disconnect account">
                          <ActionIcon
                            variant="light"
                            color="red"
                            onClick={() => handleDisconnectClick(account)}
                            aria-label="Disconnect"
                          >
                            <IconTrash size={16} />
                          </ActionIcon>
                        </Tooltip>
                      </Group>
                    </Table.Td>
                  </Table.Tr>
                ))}
              </Table.Tbody>
            </Table>
          )}
        </Paper>
      </Stack>

      {/* Connect Account Modal */}
      <Modal
        data-testid="connect-modal"
        opened={connectModalOpened}
        onClose={closeConnectModal}
        title="Connect AWS Account"
        size="lg"
      >
        <Tabs value={activeTab} onChange={setActiveTab}>
          <Tabs.List>
            <Tabs.Tab value="iam_role" leftSection={<IconCloud size={14} />}>
              IAM Role
            </Tabs.Tab>
            <Tabs.Tab value="organizations" leftSection={<IconBuildingSkyscraper size={14} />}>
              AWS Organizations
            </Tabs.Tab>
            <Tabs.Tab value="credentials_file" leftSection={<IconUpload size={14} />}>
              Upload File
            </Tabs.Tab>
            <Tabs.Tab value="access_key" leftSection={<IconKey size={14} />}>
              Access Key
            </Tabs.Tab>
          </Tabs.List>

          <Tabs.Panel value="iam_role" pt="md">
            <Stack gap="md">
              <Alert color="blue" icon={<IconCloud size={16} />}>
                <Text size="sm">
                  IAM Role is the recommended and most secure connection method. Deploy our
                  CloudFormation template to create the required IAM role in your AWS account.
                </Text>
              </Alert>

              <Divider label="Step 1: Deploy CloudFormation Template" labelPosition="left" />

              <Stack gap="xs">
                <Text size="sm">
                  Download and deploy this CloudFormation template in your AWS account to create the
                  required IAM role:
                </Text>
                <Group>
                  <Button
                    leftSection={<IconDownload size={16} />}
                    variant="light"
                    onClick={handleDownloadTemplate}
                  >
                    Download CloudFormation Template
                  </Button>
                </Group>
                <Group gap="xs">
                  <Text size="sm" c="dimmed">
                    Your External ID:
                  </Text>
                  <Code>{iamFormData.externalId || generatedExternalId}</Code>
                  <CopyButton value={iamFormData.externalId || generatedExternalId}>
                    {({ copied, copy }) => (
                      <ActionIcon
                        size="sm"
                        variant="subtle"
                        onClick={copy}
                        color={copied ? "green" : "gray"}
                      >
                        {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                      </ActionIcon>
                    )}
                  </CopyButton>
                </Group>
              </Stack>

              <Divider label="Step 2: Enter Connection Details" labelPosition="left" />

              <TextInput
                label="Account Name"
                placeholder="e.g., Production, Development"
                required
                value={iamFormData.name}
                onChange={(e) => setIamFormData({ ...iamFormData, name: e.target.value })}
              />

              <TextInput
                label="Account Number"
                placeholder="123456789012"
                required
                maxLength={12}
                value={iamFormData.accountNumber}
                onChange={(e) =>
                  setIamFormData({ ...iamFormData, accountNumber: e.target.value.replace(/\D/g, "") })
                }
              />

              <TextInput
                label="Role ARN"
                placeholder="arn:aws:iam::123456789012:role/AWSCostOptimizerRole"
                required
                value={iamFormData.roleArn}
                onChange={(e) => setIamFormData({ ...iamFormData, roleArn: e.target.value })}
              />

              <TextInput
                label="External ID"
                placeholder="Auto-generated"
                required
                value={iamFormData.externalId}
                onChange={(e) => setIamFormData({ ...iamFormData, externalId: e.target.value })}
              />

              <TextInput
                label="Region (optional)"
                placeholder="us-east-1"
                value={iamFormData.region}
                onChange={(e) => setIamFormData({ ...iamFormData, region: e.target.value })}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeConnectModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectWithRole}
                  loading={isLoading}
                  disabled={
                    !iamFormData.name ||
                    !iamFormData.accountNumber ||
                    !iamFormData.roleArn ||
                    !iamFormData.externalId
                  }
                >
                  Connect
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="organizations" pt="md">
            <Stack gap="md">
              <Alert color="blue" icon={<IconBuildingSkyscraper size={16} />}>
                <Text size="sm">
                  Import multiple AWS accounts from your AWS Organization. Provide management
                  account credentials to discover all member accounts and connect them in bulk.
                </Text>
              </Alert>

              <Stepper active={getDiscoveryStepperActive()} size="sm">
                <Stepper.Step label="Discover" description="Find member accounts">
                  <Stack gap="md" mt="md">
                    <TextInput
                      label="Management Account Number"
                      placeholder="123456789012"
                      required
                      maxLength={12}
                      value={orgFormData.managementAccountNumber}
                      onChange={(e) =>
                        setOrgFormData({
                          ...orgFormData,
                          managementAccountNumber: e.target.value.replace(/\D/g, ""),
                        })
                      }
                    />

                    <TextInput
                      label="Access Key ID"
                      placeholder="AKIAIOSFODNN7EXAMPLE"
                      required
                      value={orgFormData.accessKeyId}
                      onChange={(e) =>
                        setOrgFormData({ ...orgFormData, accessKeyId: e.target.value })
                      }
                    />

                    <TextInput
                      label="Secret Access Key"
                      placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                      required
                      type="password"
                      value={orgFormData.secretAccessKey}
                      onChange={(e) =>
                        setOrgFormData({ ...orgFormData, secretAccessKey: e.target.value })
                      }
                    />

                    <TextInput
                      label="Session Token (optional)"
                      placeholder="For temporary credentials"
                      value={orgFormData.sessionToken}
                      onChange={(e) =>
                        setOrgFormData({ ...orgFormData, sessionToken: e.target.value })
                      }
                    />

                    <Select
                      label="Region"
                      placeholder="Select region"
                      data={[
                        { value: "us-east-1", label: "US East (N. Virginia)" },
                        { value: "us-east-2", label: "US East (Ohio)" },
                        { value: "us-west-1", label: "US West (N. California)" },
                        { value: "us-west-2", label: "US West (Oregon)" },
                        { value: "eu-west-1", label: "EU (Ireland)" },
                        { value: "eu-central-1", label: "EU (Frankfurt)" },
                        { value: "ap-southeast-1", label: "Asia Pacific (Singapore)" },
                        { value: "ap-northeast-1", label: "Asia Pacific (Tokyo)" },
                      ]}
                      value={orgFormData.region}
                      onChange={(value) =>
                        setOrgFormData({ ...orgFormData, region: value || "us-east-1" })
                      }
                    />

                    <Alert color="yellow" variant="light" icon={<IconAlertCircle size={14} />}>
                      <Text size="xs">
                        Requires <Code>organizations:ListAccounts</Code> permission on the management account.
                        Note: AWS Organizations API only works in us-east-1 region.
                      </Text>
                    </Alert>

                    <Group justify="flex-end">
                      <Button variant="default" onClick={closeConnectModal}>
                        Cancel
                      </Button>
                      <Button
                        onClick={handleStartDiscovery}
                        loading={isLoading}
                        disabled={
                          !orgFormData.managementAccountNumber ||
                          !orgFormData.accessKeyId ||
                          !orgFormData.secretAccessKey
                        }
                        leftSection={<IconSearch size={16} />}
                      >
                        Discover Accounts
                      </Button>
                    </Group>
                  </Stack>
                </Stepper.Step>

                <Stepper.Step label="Select" description="Choose accounts to connect">
                  <Stack gap="md" mt="md">
                    {currentDiscovery?.status === "discovering" ? (
                      <Stack align="center" py="xl">
                        <Progress value={100} animated style={{ width: "100%" }} />
                        <Text c="dimmed">Discovering member accounts...</Text>
                      </Stack>
                    ) : (
                      <>
                        <Group justify="space-between">
                          <Text fw={500}>
                            Found {currentDiscovery?.totalAccountsFound || 0} member accounts
                          </Text>
                          <Button
                            variant="subtle"
                            size="xs"
                            onClick={handleSelectAllAccounts}
                            leftSection={<IconCheckbox size={14} />}
                          >
                            {discoveredAccounts?.filter(
                              (a) => a.status === "discovered" || a.status === "selected"
                            ).every((a) => selectedAccountIds.has(a._id))
                              ? "Deselect All"
                              : "Select All"}
                          </Button>
                        </Group>

                        <ScrollArea h={300}>
                          <Stack gap="xs">
                            {discoveredAccounts?.map((account) => {
                              const isSelectable =
                                account.status === "discovered" || account.status === "selected";
                              const isSelected = selectedAccountIds.has(account._id);

                              return (
                                <Paper
                                  key={account._id}
                                  withBorder
                                  p="sm"
                                  style={{
                                    opacity: isSelectable ? 1 : 0.6,
                                    cursor: isSelectable ? "pointer" : "default",
                                  }}
                                  onClick={() =>
                                    isSelectable && handleToggleAccountSelection(account._id)
                                  }
                                >
                                  <Group justify="space-between">
                                    <Group>
                                      <Checkbox
                                        checked={isSelected}
                                        disabled={!isSelectable}
                                        onChange={(e) => {
                                          e.stopPropagation();
                                          if (isSelectable) {
                                            handleToggleAccountSelection(account._id);
                                          }
                                        }}
                                      />
                                      <Stack gap={2}>
                                        <Text fw={500} size="sm">
                                          {account.accountName}
                                        </Text>
                                        <Group gap="xs">
                                          <Code>{account.accountNumber}</Code>
                                          <Text size="xs" c="dimmed">
                                            {account.email}
                                          </Text>
                                        </Group>
                                      </Stack>
                                    </Group>
                                    <Badge
                                      size="sm"
                                      color={
                                        account.status === "connected"
                                          ? "green"
                                          : account.status === "failed"
                                            ? "red"
                                            : account.awsStatus === "ACTIVE"
                                              ? "blue"
                                              : "gray"
                                      }
                                    >
                                      {account.status === "connected"
                                        ? "Already Connected"
                                        : account.status === "failed"
                                          ? "Failed"
                                          : account.awsStatus}
                                    </Badge>
                                  </Group>
                                </Paper>
                              );
                            })}
                          </Stack>
                        </ScrollArea>

                        <Group justify="space-between">
                          <Text size="sm" c="dimmed">
                            {selectedAccountIds.size} account(s) selected
                          </Text>
                          <Group>
                            <Button variant="default" onClick={() => setOrgDiscoveryStep(0)}>
                              Back
                            </Button>
                            <Button
                              onClick={handleSaveSelections}
                              loading={isLoading}
                              disabled={selectedAccountIds.size === 0}
                              rightSection={<IconArrowRight size={16} />}
                            >
                              Continue
                            </Button>
                          </Group>
                        </Group>
                      </>
                    )}
                  </Stack>
                </Stepper.Step>

                <Stepper.Step label="Deploy" description="Set up IAM roles">
                  <Stack gap="md" mt="md">
                    <Alert color="blue" icon={<IconCloud size={16} />}>
                      <Text size="sm">
                        Deploy IAM roles to the selected member accounts. You can either:
                      </Text>
                      <Text size="sm" mt="xs">
                        <strong>Option 1:</strong> Use CloudFormation StackSets (recommended for many accounts)
                      </Text>
                      <Text size="sm">
                        <strong>Option 2:</strong> Connect directly (assumes roles already exist)
                      </Text>
                    </Alert>

                    <Divider label="Option 1: StackSets Deployment" labelPosition="left" />

                    <Stack gap="xs">
                      <Text size="sm">
                        Download the StackSet template and deploy it to your member accounts:
                      </Text>
                      <Group>
                        <Button
                          leftSection={<IconDownload size={16} />}
                          variant="light"
                          onClick={handleDownloadStackSetTemplate}
                        >
                          Download StackSet Template
                        </Button>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" c="dimmed">
                          External ID:
                        </Text>
                        <Code>{orgFormData.externalId || generatedExternalId}</Code>
                        <CopyButton value={orgFormData.externalId || generatedExternalId}>
                          {({ copied, copy }) => (
                            <ActionIcon
                              size="sm"
                              variant="subtle"
                              onClick={copy}
                              color={copied ? "green" : "gray"}
                            >
                              {copied ? <IconCheck size={14} /> : <IconCopy size={14} />}
                            </ActionIcon>
                          )}
                        </CopyButton>
                      </Group>
                    </Stack>

                    <Divider label="Option 2: Direct Connection" labelPosition="left" />

                    <Text size="sm" c="dimmed">
                      If IAM roles are already deployed (with role name{" "}
                      <Code>AWSCostOptimizerRole</Code> and the external ID above), click Connect to
                      add all selected accounts.
                    </Text>

                    <Group justify="space-between">
                      <Button variant="default" onClick={() => setOrgDiscoveryStep(1)}>
                        Back
                      </Button>
                      <Button
                        onClick={handleConnectSelectedAccounts}
                        loading={isLoading}
                        color="green"
                      >
                        Connect {selectedAccountIds.size} Account(s)
                      </Button>
                    </Group>
                  </Stack>
                </Stepper.Step>

                <Stepper.Completed>
                  <Stack align="center" py="xl" gap="md">
                    <IconCheck size={48} color="var(--mantine-color-green-6)" />
                    <Text fw={500}>Discovery Complete!</Text>
                    <Text c="dimmed" ta="center">
                      {currentDiscovery?.accountsConnected || 0} accounts have been connected.
                    </Text>
                    <Button onClick={closeConnectModal}>Close</Button>
                  </Stack>
                </Stepper.Completed>
              </Stepper>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="credentials_file" pt="md">
            <Stack gap="md">
              <Alert color="blue" icon={<IconUpload size={16} />}>
                <Text size="sm">
                  Upload your AWS credentials file or paste credentials in JSON/ENV/CSV format.
                  Supports ~/.aws/credentials (INI), JSON exports, .env files, and CSV exports from AWS Console.
                </Text>
              </Alert>

              {/* Hidden file input */}
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileInput}
                accept=".txt,.ini,.json,.env,.csv,text/plain,application/json,text/csv"
                style={{ display: "none" }}
              />

              {/* Drop zone */}
              {!uploadedFile ? (
                <Box
                  onDrop={handleDrop}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
                  onClick={() => fileInputRef.current?.click()}
                  style={{
                    border: `2px dashed ${isDragging ? theme.colors.blue[5] : theme.colors.gray[4]}`,
                    borderRadius: theme.radius.md,
                    padding: rem(40),
                    textAlign: "center",
                    cursor: "pointer",
                    backgroundColor: isDragging ? theme.colors.blue[0] : "transparent",
                    transition: "all 0.2s ease",
                  }}
                >
                  <Stack align="center" gap="sm">
                    <IconUpload size={48} style={{ opacity: 0.5 }} />
                    <Text size="lg" fw={500}>
                      Drop your credentials file here
                    </Text>
                    <Text size="sm" c="dimmed">
                      or click to browse
                    </Text>
                    <Text size="xs" c="dimmed">
                      Supports: credentials, .json, .env, .csv files
                    </Text>
                  </Stack>
                </Box>
              ) : (
                <Paper withBorder p="md">
                  <Group justify="space-between" align="flex-start">
                    <Group gap="sm">
                      <IconFile size={24} />
                      <Stack gap={4}>
                        <Text fw={500}>{uploadedFile.name}</Text>
                        <Text size="xs" c="dimmed">
                          {parseResult?.success
                            ? `${getFormatDisplayName(parseResult.format)} - ${parseResult.profiles.length} profile(s) found`
                            : parseResult?.error || "Parsing..."}
                        </Text>
                      </Stack>
                    </Group>
                    <ActionIcon variant="subtle" color="red" onClick={clearUploadedFile}>
                      <IconX size={16} />
                    </ActionIcon>
                  </Group>
                </Paper>
              )}

              {/* Parse error */}
              {parseResult && !parseResult.success && (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {parseResult.error}
                </Alert>
              )}

              {/* Profile selection */}
              {parseResult?.success && parseResult.profiles.length > 0 && (
                <>
                  <Divider label="Select Profile" labelPosition="left" />

                  <Select
                    label="Credential Profile"
                    placeholder="Select a profile"
                    data={parseResult.profiles.map((p) => ({
                      value: p.profileName,
                      label: `${p.profileName}${isTemporaryCredentials(p) ? " (temporary)" : ""}`,
                    }))}
                    value={selectedProfile}
                    onChange={(value) => {
                      setSelectedProfile(value);
                      // Clear detection when profile changes
                      if (fileDetectedAccount) {
                        setFileDetectedAccount(null);
                        setFileDetectionError(null);
                        setFileFormData((prev) => ({ ...prev, accountNumber: "" }));
                      }
                    }}
                    required
                  />

                  {/* Show selected credential info */}
                  {selectedProfile && (() => {
                    const cred = getSelectedCredential();
                    if (!cred) return null;

                    const expiryStatus = getCredentialExpiryStatus(cred);

                    return (
                      <Paper withBorder p="sm">
                        <Stack gap="xs">
                          <Group justify="space-between">
                            <Text size="sm" c="dimmed">Access Key ID:</Text>
                            <Code>{cred.accessKeyId.substring(0, 8)}...{cred.accessKeyId.substring(cred.accessKeyId.length - 4)}</Code>
                          </Group>
                          {cred.region && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">Region:</Text>
                              <Code>{cred.region}</Code>
                            </Group>
                          )}
                          {isTemporaryCredentials(cred) && expiryStatus.status !== "expired" && expiryStatus.status !== "expiring_soon" && (
                            <Alert color="yellow" variant="light" icon={<IconClock size={14} />} p="xs">
                              <Text size="xs">These are temporary credentials with a session token.</Text>
                            </Alert>
                          )}
                          {/* Expiry warnings */}
                          {expiryStatus.status === "expired" && (
                            <Alert color="red" variant="filled" icon={<IconAlertCircle size={14} />} p="xs">
                              <Text size="xs" fw={500}>
                                These credentials have expired ({formatExpiryTime(expiryStatus.expiresAt)}). 
                                You cannot connect with expired credentials.
                              </Text>
                            </Alert>
                          )}
                          {expiryStatus.status === "expiring_soon" && (
                            <Alert color="orange" variant="light" icon={<IconClock size={14} />} p="xs">
                              <Text size="xs" fw={500}>
                                Warning: {formatExpiryTime(expiryStatus.expiresAt)}. 
                                Consider refreshing your credentials before connecting.
                              </Text>
                            </Alert>
                          )}
                          {expiryStatus.status === "valid" && cred.expiresAt && (
                            <Group justify="space-between">
                              <Text size="sm" c="dimmed">Expires:</Text>
                              <Text size="sm">{new Date(cred.expiresAt).toLocaleString()}</Text>
                            </Group>
                          )}
                        </Stack>
                      </Paper>
                    );
                  })()}

                  {/* Detect Account Button - only show if credentials aren't expired */}
                  {selectedProfile && !isSelectedCredentialExpired() && (
                    <>
                      <Divider label="Verify Credentials" labelPosition="left" />

                      <Group align="flex-start">
                        <Button
                          variant="light"
                          leftSection={<IconSearch size={16} />}
                          onClick={handleDetectAccountFromFile}
                          loading={fileDetectionLoading}
                        >
                          Detect Account
                        </Button>
                        <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                          Validates your credentials and detects the AWS account number
                        </Text>
                      </Group>

                      {/* Detection Error */}
                      {fileDetectionError && (
                        <Alert color="red" icon={<IconAlertCircle size={16} />}>
                          {fileDetectionError}
                        </Alert>
                      )}

                      {/* Detected Account Info */}
                      {fileDetectedAccount && (
                        <Paper withBorder p="sm" bg="green.0">
                          <Group gap="sm">
                            <IconCheck size={20} color="var(--mantine-color-green-6)" />
                            <Stack gap={4} style={{ flex: 1 }}>
                              <Text size="sm" fw={500} c="green.8">
                                Credentials verified successfully!
                              </Text>
                              <Group gap="xs">
                                <Text size="sm" c="dimmed">Account:</Text>
                                <Code>{fileDetectedAccount.account}</Code>
                              </Group>
                              <Group gap="xs">
                                <Text size="sm" c="dimmed">ARN:</Text>
                                <Code style={{ fontSize: "0.75rem" }}>{fileDetectedAccount.arn}</Code>
                              </Group>
                            </Stack>
                          </Group>
                        </Paper>
                      )}
                    </>
                  )}

                  <Divider label="Account Details" labelPosition="left" />

                  <TextInput
                    label="Account Name"
                    placeholder="e.g., Production, Development"
                    required
                    value={fileFormData.name}
                    onChange={(e) => setFileFormData({ ...fileFormData, name: e.target.value })}
                  />

                  {/* Account Number Field - shown as read-only when detected */}
                  <TextInput
                    label="Account Number"
                    placeholder={fileDetectedAccount ? "Detected from credentials" : "Auto-detected from credentials"}
                    description={fileDetectedAccount 
                      ? "Automatically detected from your credentials" 
                      : "Click 'Detect Account' to auto-fill, or enter manually"
                    }
                    maxLength={12}
                    value={fileFormData.accountNumber}
                    onChange={(e) =>
                      setFileFormData({ ...fileFormData, accountNumber: e.target.value.replace(/\D/g, "") })
                    }
                    rightSection={fileDetectedAccount && <IconCheck size={16} color="var(--mantine-color-green-6)" />}
                  />

                  <TextInput
                    label="Region (optional)"
                    placeholder="us-east-1"
                    value={fileFormData.region}
                    onChange={(e) => setFileFormData({ ...fileFormData, region: e.target.value })}
                  />
                </>
              )}

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeConnectModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectWithCredentialsFile}
                  loading={isLoading}
                  disabled={
                    !parseResult?.success ||
                    !selectedProfile ||
                    !fileFormData.name ||
                    isSelectedCredentialExpired()
                  }
                >
                  Connect
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>

          <Tabs.Panel value="access_key" pt="md">
            <Stack gap="md">
              <Alert color="yellow" icon={<IconAlertCircle size={16} />}>
                <Text size="sm">
                  Access keys are less secure than IAM roles. We recommend using IAM role-based
                  access. If you must use access keys, ensure you rotate them regularly and use
                  least-privilege permissions.
                </Text>
              </Alert>

              <TextInput
                label="Account Name"
                placeholder="e.g., Production, Development"
                required
                value={keyFormData.name}
                onChange={(e) => setKeyFormData({ ...keyFormData, name: e.target.value })}
              />

              <TextInput
                label="Access Key ID"
                placeholder="AKIAIOSFODNN7EXAMPLE"
                required
                value={keyFormData.accessKeyId}
                onChange={(e) => {
                  setKeyFormData({ ...keyFormData, accessKeyId: e.target.value });
                  // Clear detection when credentials change
                  if (keyDetectedAccount) {
                    setKeyDetectedAccount(null);
                    setKeyDetectionError(null);
                  }
                }}
              />

              <TextInput
                label="Secret Access Key"
                placeholder="wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
                required
                type="password"
                value={keyFormData.secretAccessKey}
                onChange={(e) => {
                  setKeyFormData({ ...keyFormData, secretAccessKey: e.target.value });
                  // Clear detection when credentials change
                  if (keyDetectedAccount) {
                    setKeyDetectedAccount(null);
                    setKeyDetectionError(null);
                  }
                }}
              />

              <TextInput
                label="Region (optional)"
                placeholder="us-east-1"
                value={keyFormData.region}
                onChange={(e) => setKeyFormData({ ...keyFormData, region: e.target.value })}
              />

              {/* Detect Account Button */}
              <Divider label="Verify Credentials" labelPosition="left" />

              <Group align="flex-start">
                <Button
                  variant="light"
                  leftSection={<IconSearch size={16} />}
                  onClick={handleDetectAccountFromKeys}
                  loading={keyDetectionLoading}
                  disabled={!keyFormData.accessKeyId || !keyFormData.secretAccessKey}
                >
                  Detect Account
                </Button>
                <Text size="xs" c="dimmed" style={{ flex: 1 }}>
                  Validates your credentials and detects the AWS account number
                </Text>
              </Group>

              {/* Detection Error */}
              {keyDetectionError && (
                <Alert color="red" icon={<IconAlertCircle size={16} />}>
                  {keyDetectionError}
                </Alert>
              )}

              {/* Detected Account Info */}
              {keyDetectedAccount && (
                <Paper withBorder p="sm" bg="green.0">
                  <Group gap="sm">
                    <IconCheck size={20} color="var(--mantine-color-green-6)" />
                    <Stack gap={4} style={{ flex: 1 }}>
                      <Text size="sm" fw={500} c="green.8">
                        Credentials verified successfully!
                      </Text>
                      <Group gap="xs">
                        <Text size="sm" c="dimmed">Account:</Text>
                        <Code>{keyDetectedAccount.account}</Code>
                      </Group>
                      <Group gap="xs">
                        <Text size="sm" c="dimmed">ARN:</Text>
                        <Code style={{ fontSize: "0.75rem" }}>{keyDetectedAccount.arn}</Code>
                      </Group>
                    </Stack>
                  </Group>
                </Paper>
              )}

              {/* Account Number Field - shown as read-only when detected */}
              <TextInput
                label="Account Number"
                placeholder={keyDetectedAccount ? "Detected from credentials" : "Auto-detected from credentials"}
                description={keyDetectedAccount 
                  ? "Automatically detected from your credentials" 
                  : "Click 'Detect Account' to auto-fill, or enter manually"
                }
                maxLength={12}
                value={keyFormData.accountNumber}
                onChange={(e) =>
                  setKeyFormData({ ...keyFormData, accountNumber: e.target.value.replace(/\D/g, "") })
                }
                rightSection={keyDetectedAccount && <IconCheck size={16} color="var(--mantine-color-green-6)" />}
              />

              <Group justify="flex-end" mt="md">
                <Button variant="default" onClick={closeConnectModal}>
                  Cancel
                </Button>
                <Button
                  onClick={handleConnectWithKeys}
                  loading={isLoading}
                  disabled={
                    !keyFormData.name ||
                    !keyFormData.accessKeyId ||
                    !keyFormData.secretAccessKey
                  }
                >
                  Connect
                </Button>
              </Group>
            </Stack>
          </Tabs.Panel>
        </Tabs>
      </Modal>

      {/* Disconnect Confirmation Modal */}
      <Modal
        data-testid="confirm-disconnect-modal"
        opened={disconnectModalOpened}
        onClose={closeDisconnectModal}
        title="Disconnect AWS Account"
        size="sm"
      >
        <Stack gap="md">
          <Text>
            Are you sure you want to disconnect{" "}
            <Text span fw={600}>
              {selectedAccount?.name}
            </Text>
            ?
          </Text>
          <Text size="sm" c="dimmed">
            This will remove all credentials and stop cost analysis for this account. This action
            cannot be undone.
          </Text>
          <Group justify="flex-end" mt="md">
            <Button variant="default" onClick={closeDisconnectModal}>
              Cancel
            </Button>
            <Button color="red" onClick={handleConfirmDisconnect} loading={isLoading}>
              Confirm
            </Button>
          </Group>
        </Stack>
      </Modal>
    </Container>
  );
});

export default AccountsPage;
