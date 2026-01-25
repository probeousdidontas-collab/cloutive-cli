/**
 * AWS Credentials File Parser
 *
 * Parses AWS credentials from multiple file formats:
 * - INI format (standard ~/.aws/credentials)
 * - JSON format (exported credentials)
 * - ENV format (.env file with AWS_ variables)
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
  format: "ini" | "json" | "env" | "unknown";
  error?: string;
}

/**
 * Detect the format of the credentials file content
 */
export function detectFormat(content: string): "ini" | "json" | "env" | "unknown" {
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
      default:
        return {
          success: false,
          profiles: [],
          format: "unknown",
          error: "Unable to detect file format. Supported formats: INI (.aws/credentials), JSON, ENV (.env)",
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
 * Get human-readable format name
 */
export function getFormatDisplayName(format: ParseResult["format"]): string {
  const names: Record<ParseResult["format"], string> = {
    ini: "AWS Credentials File (INI)",
    json: "JSON",
    env: "Environment File (.env)",
    unknown: "Unknown",
  };
  return names[format];
}
