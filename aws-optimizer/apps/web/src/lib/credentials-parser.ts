/**
 * AWS Credentials File Parser
 *
 * Parses AWS credentials from multiple file formats:
 * - INI format (standard ~/.aws/credentials)
 * - JSON format (exported credentials)
 * - ENV format (.env file with AWS_ variables)
 * - CSV format (AWS Console credential exports)
 */

export interface ParsedCredential {
  profileName: string;
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
  region?: string;
  expiresAt?: number; // Unix timestamp
}

export interface ParseResult {
  success: boolean;
  profiles: ParsedCredential[];
  format: "ini" | "json" | "env" | "csv" | "unknown";
  error?: string;
}

/**
 * Detect the format of the credentials file content
 */
export function detectFormat(content: string): "ini" | "json" | "env" | "csv" | "unknown" {
  const trimmed = content.trim();

  // Check for JSON (starts with { or [)
  if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
    try {
      JSON.parse(trimmed);
      return "json";
    } catch {
      // Not valid JSON
    }
  }

  // Check for INI format (has [section] headers)
  if (/^\[\w+\]/m.test(trimmed)) {
    return "ini";
  }

  // Check for CSV format (has header row with Access key ID or AccessKeyId)
  const firstLine = trimmed.split(/\r?\n/)[0].toLowerCase();
  if (
    (firstLine.includes("access key id") || firstLine.includes("accesskeyid")) &&
    (firstLine.includes("secret access key") || firstLine.includes("secretaccesskey")) &&
    firstLine.includes(",")
  ) {
    return "csv";
  }

  // Check for ENV format (has KEY=value lines with AWS_ - may have export prefix)
  if (/^(export\s+)?AWS_/mi.test(trimmed)) {
    return "env";
  }

  return "unknown";
}

/**
 * Parse INI format credentials file (standard AWS credentials file)
 *
 * Example:
 * [default]
 * aws_access_key_id = AKIAIOSFODNN7EXAMPLE
 * aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
 *
 * [profile-name]
 * aws_access_key_id = AKIAI44QH8DHBEXAMPLE
 * aws_secret_access_key = je7MtGbClwBF/2Zp9Utk/h3yCo8nvbEXAMPLEKEY
 * aws_session_token = token123
 * region = us-west-2
 */
function parseIniFormat(content: string): ParsedCredential[] {
  const profiles: ParsedCredential[] = [];
  const lines = content.split(/\r?\n/);

  let currentProfile: string | null = null;
  let currentCreds: Partial<ParsedCredential> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#") || trimmed.startsWith(";")) {
      continue;
    }

    // Check for section header [profile-name]
    const sectionMatch = trimmed.match(/^\[([^\]]+)\]$/);
    if (sectionMatch) {
      // Save previous profile if it has credentials
      if (currentProfile && currentCreds.accessKeyId && currentCreds.secretAccessKey) {
        profiles.push({
          profileName: currentProfile,
          accessKeyId: currentCreds.accessKeyId,
          secretAccessKey: currentCreds.secretAccessKey,
          sessionToken: currentCreds.sessionToken,
          region: currentCreds.region,
        });
      }

      // Start new profile
      currentProfile = sectionMatch[1].replace(/^profile\s+/, ""); // Handle "profile name" format
      currentCreds = {};
      continue;
    }

    // Parse key=value pairs
    const keyValueMatch = trimmed.match(/^([^=]+)\s*=\s*(.*)$/);
    if (keyValueMatch && currentProfile !== null) {
      const key = keyValueMatch[1].trim().toLowerCase();
      const value = keyValueMatch[2].trim();

      switch (key) {
        case "aws_access_key_id":
          currentCreds.accessKeyId = value;
          break;
        case "aws_secret_access_key":
          currentCreds.secretAccessKey = value;
          break;
        case "aws_session_token":
          currentCreds.sessionToken = value;
          break;
        case "region":
          currentCreds.region = value;
          break;
      }
    }
  }

  // Don't forget the last profile
  if (currentProfile && currentCreds.accessKeyId && currentCreds.secretAccessKey) {
    profiles.push({
      profileName: currentProfile,
      accessKeyId: currentCreds.accessKeyId,
      secretAccessKey: currentCreds.secretAccessKey,
      sessionToken: currentCreds.sessionToken,
      region: currentCreds.region,
    });
  }

  return profiles;
}

/**
 * Parse JSON format credentials
 *
 * Supports multiple formats:
 * 1. Single credential object:
 *    { "AccessKeyId": "...", "SecretAccessKey": "...", ... }
 *
 * 2. AWS CLI credential output:
 *    { "Credentials": { "AccessKeyId": "...", ... } }
 *
 * 3. Array of profiles:
 *    [{ "profile": "default", "accessKeyId": "...", ... }]
 *
 * 4. Object with profile keys:
 *    { "default": { "accessKeyId": "...", ... }, "prod": { ... } }
 */
function parseJsonFormat(content: string): ParsedCredential[] {
  const profiles: ParsedCredential[] = [];

  const data = JSON.parse(content);

  // Helper to normalize credential object keys (handles different casing)
  const extractCredential = (obj: Record<string, unknown>, profileName: string): ParsedCredential | null => {
    const accessKeyId =
      (obj.AccessKeyId as string) ||
      (obj.accessKeyId as string) ||
      (obj.aws_access_key_id as string);
    const secretAccessKey =
      (obj.SecretAccessKey as string) ||
      (obj.secretAccessKey as string) ||
      (obj.aws_secret_access_key as string);

    if (!accessKeyId || !secretAccessKey) {
      return null;
    }

    const sessionToken =
      (obj.SessionToken as string) ||
      (obj.sessionToken as string) ||
      (obj.aws_session_token as string);
    const region = (obj.region as string) || (obj.Region as string);

    // Parse expiration if present
    let expiresAt: number | undefined;
    const expiration = (obj.Expiration as string) || (obj.expiration as string) || (obj.expiresAt as string);
    if (expiration) {
      const parsed = Date.parse(expiration);
      if (!isNaN(parsed)) {
        expiresAt = parsed;
      }
    }

    return {
      profileName,
      accessKeyId,
      secretAccessKey,
      sessionToken,
      region,
      expiresAt,
    };
  };

  // Format 1: Single credential object or AWS CLI output
  if (data.AccessKeyId || data.accessKeyId || data.aws_access_key_id) {
    const cred = extractCredential(data, "default");
    if (cred) profiles.push(cred);
  }
  // Format 2: AWS CLI "Credentials" wrapper
  else if (data.Credentials) {
    const cred = extractCredential(data.Credentials, "default");
    if (cred) profiles.push(cred);
  }
  // Format 3: Array of profiles
  else if (Array.isArray(data)) {
    for (const item of data) {
      const profileName = item.profile || item.profileName || item.name || "default";
      const cred = extractCredential(item, profileName);
      if (cred) profiles.push(cred);
    }
  }
  // Format 4: Object with profile keys
  else if (typeof data === "object") {
    for (const [profileName, profileData] of Object.entries(data)) {
      if (typeof profileData === "object" && profileData !== null) {
        const cred = extractCredential(profileData as Record<string, unknown>, profileName);
        if (cred) profiles.push(cred);
      }
    }
  }

  return profiles;
}

/**
 * Parse CSV format credentials (AWS Console export)
 *
 * Common formats:
 * 1. Simple format:
 *    Access key ID,Secret access key
 *    AKIAIOSFODNN7EXAMPLE,wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
 *
 * 2. Full format with user info:
 *    User name,Password,Access key ID,Secret access key,Console login link
 *    myuser,,AKIAIOSFODNN7EXAMPLE,secret,https://...
 *
 * 3. With additional columns:
 *    User Name,Access Key Id,Secret Access Key,Status
 *    myuser,AKIAIOSFODNN7EXAMPLE,secret,Active
 */
function parseCsvFormat(content: string): ParsedCredential[] {
  const lines = content.split(/\r?\n/).filter((line) => line.trim());
  if (lines.length < 2) {
    return [];
  }

  // Parse header row to find column indices
  const headerLine = lines[0];
  const headers = parseCsvLine(headerLine).map((h) => h.toLowerCase().trim());

  // Find column indices for required fields
  const accessKeyIdIndex = headers.findIndex(
    (h) => h === "access key id" || h === "accesskeyid" || h === "access_key_id"
  );
  const secretKeyIndex = headers.findIndex(
    (h) =>
      h === "secret access key" ||
      h === "secretaccesskey" ||
      h === "secret_access_key"
  );

  if (accessKeyIdIndex === -1 || secretKeyIndex === -1) {
    return [];
  }

  // Find optional column indices
  const userNameIndex = headers.findIndex(
    (h) => h === "user name" || h === "username" || h === "user" || h === "name"
  );
  const sessionTokenIndex = headers.findIndex(
    (h) => h === "session token" || h === "sessiontoken" || h === "session_token"
  );

  const profiles: ParsedCredential[] = [];

  // Parse data rows (skip header)
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const values = parseCsvLine(line);
    const accessKeyId = values[accessKeyIdIndex]?.trim();
    const secretAccessKey = values[secretKeyIndex]?.trim();

    if (!accessKeyId || !secretAccessKey) {
      continue;
    }

    // Use username as profile name if available, otherwise use "default" or indexed name
    let profileName = "default";
    if (userNameIndex !== -1 && values[userNameIndex]?.trim()) {
      profileName = values[userNameIndex].trim();
    } else if (profiles.length > 0) {
      profileName = `profile-${profiles.length + 1}`;
    }

    const sessionToken =
      sessionTokenIndex !== -1 ? values[sessionTokenIndex]?.trim() : undefined;

    profiles.push({
      profileName,
      accessKeyId,
      secretAccessKey,
      sessionToken: sessionToken || undefined,
    });
  }

  return profiles;
}

/**
 * Parse a single CSV line, handling quoted values
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped quote
        current += '"';
        i++;
      } else {
        // Toggle quote state
        inQuotes = !inQuotes;
      }
    } else if (char === "," && !inQuotes) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  // Don't forget the last field
  result.push(current);

  return result;
}

/**
 * Parse ENV format credentials
 *
 * Example:
 * AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
 * AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
 * AWS_SESSION_TOKEN=token123
 * AWS_DEFAULT_REGION=us-west-2
 */
function parseEnvFormat(content: string): ParsedCredential[] {
  const lines = content.split(/\r?\n/);
  const envVars: Record<string, string> = {};

  for (const line of lines) {
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith("#")) {
      continue;
    }

    // Remove 'export ' prefix if present
    const cleaned = trimmed.replace(/^export\s+/i, "");

    // Parse KEY=value (handle quoted values)
    const match = cleaned.match(/^([A-Z_][A-Z0-9_]*)\s*=\s*["']?([^"']*)["']?$/i);
    if (match) {
      envVars[match[1].toUpperCase()] = match[2];
    }
  }

  // Extract AWS credentials
  const accessKeyId = envVars.AWS_ACCESS_KEY_ID || envVars.AWS_ACCESS_KEY;
  const secretAccessKey = envVars.AWS_SECRET_ACCESS_KEY || envVars.AWS_SECRET_KEY;

  if (!accessKeyId || !secretAccessKey) {
    return [];
  }

  return [
    {
      profileName: "default",
      accessKeyId,
      secretAccessKey,
      sessionToken: envVars.AWS_SESSION_TOKEN,
      region: envVars.AWS_DEFAULT_REGION || envVars.AWS_REGION,
    },
  ];
}

/**
 * Parse credentials from file content
 * Automatically detects format and parses accordingly
 */
export function parseCredentialsFile(content: string): ParseResult {
  if (!content || !content.trim()) {
    return {
      success: false,
      profiles: [],
      format: "unknown",
      error: "File content is empty",
    };
  }

  const format = detectFormat(content);

  try {
    let profiles: ParsedCredential[] = [];

    switch (format) {
      case "ini":
        profiles = parseIniFormat(content);
        break;
      case "json":
        profiles = parseJsonFormat(content);
        break;
      case "env":
        profiles = parseEnvFormat(content);
        break;
      case "csv":
        profiles = parseCsvFormat(content);
        break;
      default:
        return {
          success: false,
          profiles: [],
          format: "unknown",
          error: "Unable to detect file format. Supported formats: INI (.aws/credentials), JSON, ENV (.env), CSV",
        };
    }

    if (profiles.length === 0) {
      return {
        success: false,
        profiles: [],
        format,
        error: "No valid AWS credentials found in the file",
      };
    }

    // Validate each profile
    for (const profile of profiles) {
      if (!validateAccessKeyId(profile.accessKeyId)) {
        return {
          success: false,
          profiles: [],
          format,
          error: `Invalid AWS access key ID format in profile "${profile.profileName}"`,
        };
      }
    }

    return {
      success: true,
      profiles,
      format,
    };
  } catch (error) {
    return {
      success: false,
      profiles: [],
      format,
      error: `Failed to parse credentials file: ${error instanceof Error ? error.message : "Unknown error"}`,
    };
  }
}

/**
 * Validate AWS access key ID format
 */
export function validateAccessKeyId(accessKeyId: string): boolean {
  // AWS access key IDs are 20 characters:
  // - Start with AKIA (long-term) or ASIA (temporary)
  // - Followed by 16 alphanumeric characters
  // The regex allows for slight variations in length (16-20 chars after prefix)
  return /^(AKIA|ASIA)[A-Z0-9]{12,16}$/.test(accessKeyId);
}

/**
 * Check if credentials are temporary (have session token or start with ASIA)
 */
export function isTemporaryCredentials(cred: ParsedCredential): boolean {
  return !!cred.sessionToken || cred.accessKeyId.startsWith("ASIA");
}

/**
 * Expiry status for credentials
 */
export type CredentialExpiryStatus = 
  | { status: "valid"; expiresAt?: number }
  | { status: "expiring_soon"; expiresAt: number; expiresInMinutes: number }
  | { status: "expired"; expiresAt: number; expiredMinutesAgo: number }
  | { status: "no_expiry" };

/**
 * Check if credentials are expired
 * Returns true if credentials have an expiration time that has passed
 */
export function isCredentialExpired(cred: ParsedCredential): boolean {
  if (!cred.expiresAt) {
    return false;
  }
  return Date.now() > cred.expiresAt;
}

/**
 * Get detailed expiry status for credentials
 * @param cred - The credential to check
 * @param expiringThresholdMinutes - Minutes threshold to consider "expiring soon" (default: 60)
 */
export function getCredentialExpiryStatus(
  cred: ParsedCredential,
  expiringThresholdMinutes: number = 60
): CredentialExpiryStatus {
  if (!cred.expiresAt) {
    return { status: "no_expiry" };
  }

  const now = Date.now();
  const diffMs = cred.expiresAt - now;
  const diffMinutes = Math.floor(diffMs / 60000);

  if (diffMs < 0) {
    return {
      status: "expired",
      expiresAt: cred.expiresAt,
      expiredMinutesAgo: Math.abs(diffMinutes),
    };
  }

  if (diffMinutes <= expiringThresholdMinutes) {
    return {
      status: "expiring_soon",
      expiresAt: cred.expiresAt,
      expiresInMinutes: diffMinutes,
    };
  }

  return {
    status: "valid",
    expiresAt: cred.expiresAt,
  };
}

/**
 * Format expiry time in a human-readable way
 */
export function formatExpiryTime(expiresAt: number): string {
  const now = Date.now();
  const diffMs = expiresAt - now;
  const diffMinutes = Math.floor(Math.abs(diffMs) / 60000);
  const diffHours = Math.floor(diffMinutes / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffMs < 0) {
    // Expired
    if (diffMinutes < 60) {
      return `Expired ${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""} ago`;
    }
    if (diffHours < 24) {
      return `Expired ${diffHours} hour${diffHours !== 1 ? "s" : ""} ago`;
    }
    return `Expired ${diffDays} day${diffDays !== 1 ? "s" : ""} ago`;
  }

  // Still valid
  if (diffMinutes < 60) {
    return `Expires in ${diffMinutes} minute${diffMinutes !== 1 ? "s" : ""}`;
  }
  if (diffHours < 24) {
    return `Expires in ${diffHours} hour${diffHours !== 1 ? "s" : ""}`;
  }
  return `Expires in ${diffDays} day${diffDays !== 1 ? "s" : ""}`;
}

/**
 * Get human-readable format name
 */
export function getFormatDisplayName(format: ParseResult["format"]): string {
  const names: Record<ParseResult["format"], string> = {
    ini: "AWS Credentials File (INI)",
    json: "JSON",
    env: "Environment File (.env)",
    csv: "CSV (AWS Console Export)",
    unknown: "Unknown",
  };
  return names[format];
}
