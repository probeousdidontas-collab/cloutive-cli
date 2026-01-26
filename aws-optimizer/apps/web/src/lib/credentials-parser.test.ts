import { describe, it, expect } from "vitest";
import {
  parseCredentialsFile,
  detectFormat,
  validateAccessKeyId,
  isTemporaryCredentials,
  isCredentialExpired,
  getCredentialExpiryStatus,
  formatExpiryTime,
  getFormatDisplayName,
  type ParsedCredential,
} from "./credentials-parser";

describe("credentials-parser", () => {
  describe("detectFormat", () => {
    it("detects INI format with section headers", () => {
      const content = `[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = secret`;
      expect(detectFormat(content)).toBe("ini");
    });

    it("detects JSON format with object", () => {
      const content = `{"AccessKeyId": "AKIAIOSFODNN7EXAMPLE"}`;
      expect(detectFormat(content)).toBe("json");
    });

    it("detects JSON format with array", () => {
      const content = `[{"accessKeyId": "AKIAIOSFODNN7EXAMPLE"}]`;
      expect(detectFormat(content)).toBe("json");
    });

    it("detects ENV format with AWS_ variables", () => {
      const content = `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=secret`;
      expect(detectFormat(content)).toBe("env");
    });

    it("detects CSV format with Access key ID header", () => {
      const content = `Access key ID,Secret access key
AKIAIOSFODNN7EXAMPLE,secret`;
      expect(detectFormat(content)).toBe("csv");
    });

    it("detects CSV format with full AWS Console export", () => {
      const content = `User name,Password,Access key ID,Secret access key,Console login link
myuser,,AKIAIOSFODNN7EXAMPLE,secret,https://console.aws.amazon.com`;
      expect(detectFormat(content)).toBe("csv");
    });

    it("returns unknown for unrecognized format", () => {
      const content = `some random text`;
      expect(detectFormat(content)).toBe("unknown");
    });
  });

  describe("parseCredentialsFile - INI format", () => {
    it("parses single profile", () => {
      const content = `[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.format).toBe("ini");
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0]).toEqual({
        profileName: "default",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: undefined,
        region: undefined,
      });
    });

    it("parses multiple profiles", () => {
      const content = `[default]
aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = secret1

[production]
aws_access_key_id = AKIAI44QH8DHBEXAMPLE
aws_secret_access_key = secret2
region = us-west-2`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2);
      expect(result.profiles[0].profileName).toBe("default");
      expect(result.profiles[1].profileName).toBe("production");
      expect(result.profiles[1].region).toBe("us-west-2");
    });

    it("parses profile with session token", () => {
      const content = `[temp]
aws_access_key_id = ASIAZXCVBNM1234TEMP
aws_secret_access_key = secret
aws_session_token = token123`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles[0].sessionToken).toBe("token123");
    });

    it("ignores comments and empty lines", () => {
      const content = `# This is a comment
[default]
; Another comment

aws_access_key_id = AKIAIOSFODNN7EXAMPLE
aws_secret_access_key = secret`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(1);
    });
  });

  describe("parseCredentialsFile - JSON format", () => {
    it("parses single credential object (PascalCase)", () => {
      const content = JSON.stringify({
        AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
        SecretAccessKey: "secret",
      });

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.format).toBe("json");
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].profileName).toBe("default");
    });

    it("parses AWS CLI Credentials wrapper", () => {
      const content = JSON.stringify({
        Credentials: {
          AccessKeyId: "AKIAIOSFODNN7EXAMPLE",
          SecretAccessKey: "secret",
          SessionToken: "token",
          Expiration: "2024-12-31T23:59:59Z",
        },
      });

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles[0].sessionToken).toBe("token");
      expect(result.profiles[0].expiresAt).toBeDefined();
    });

    it("parses array of profiles", () => {
      const content = JSON.stringify([
        { profile: "dev", accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "secret1" },
        { profile: "prod", accessKeyId: "AKIAI44QH8DHBEXAMPLE", secretAccessKey: "secret2" },
      ]);

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2);
    });

    it("parses object with profile keys", () => {
      const content = JSON.stringify({
        default: { accessKeyId: "AKIAIOSFODNN7EXAMPLE", secretAccessKey: "secret1" },
        staging: { accessKeyId: "AKIAI44QH8DHBEXAMPLE", secretAccessKey: "secret2" },
      });

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2);
    });
  });

  describe("parseCredentialsFile - ENV format", () => {
    it("parses standard env format", () => {
      const content = `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.format).toBe("env");
      expect(result.profiles).toHaveLength(1);
    });

    it("handles export prefix", () => {
      const content = `export AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
export AWS_SECRET_ACCESS_KEY=secret`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
    });

    it("handles quoted values", () => {
      const content = `AWS_ACCESS_KEY_ID="AKIAIOSFODNN7EXAMPLE"
AWS_SECRET_ACCESS_KEY='secret'`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
    });

    it("parses session token and region", () => {
      const content = `AWS_ACCESS_KEY_ID=AKIAIOSFODNN7EXAMPLE
AWS_SECRET_ACCESS_KEY=secret
AWS_SESSION_TOKEN=token
AWS_DEFAULT_REGION=us-west-2`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles[0].sessionToken).toBe("token");
      expect(result.profiles[0].region).toBe("us-west-2");
    });
  });

  describe("parseCredentialsFile - CSV format", () => {
    it("parses simple CSV format", () => {
      const content = `Access key ID,Secret access key
AKIAIOSFODNN7EXAMPLE,wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.format).toBe("csv");
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0]).toEqual({
        profileName: "default",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY",
        sessionToken: undefined,
      });
    });

    it("parses AWS Console full export format", () => {
      const content = `User name,Password,Access key ID,Secret access key,Console login link
myuser,,AKIAIOSFODNN7EXAMPLE,secret123,https://console.aws.amazon.com`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.format).toBe("csv");
      expect(result.profiles).toHaveLength(1);
      expect(result.profiles[0].profileName).toBe("myuser");
      expect(result.profiles[0].accessKeyId).toBe("AKIAIOSFODNN7EXAMPLE");
    });

    it("parses multiple rows in CSV", () => {
      const content = `User name,Access key ID,Secret access key
user1,AKIAIOSFODNN7EXAMPLE,secret1
user2,AKIAI44QH8DHBEXAMPLE,secret2`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2);
      expect(result.profiles[0].profileName).toBe("user1");
      expect(result.profiles[1].profileName).toBe("user2");
    });

    it("handles quoted values in CSV", () => {
      const content = `Access key ID,Secret access key
"AKIAIOSFODNN7EXAMPLE","wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles[0].accessKeyId).toBe("AKIAIOSFODNN7EXAMPLE");
    });

    it("handles different header casing", () => {
      const content = `AccessKeyId,SecretAccessKey
AKIAIOSFODNN7EXAMPLE,secret`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(1);
    });

    it("parses CSV with session token column", () => {
      const content = `Access key ID,Secret access key,Session token
ASIAZXCVBNM1234TEMP,secret,token123`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles[0].sessionToken).toBe("token123");
    });

    it("skips empty rows", () => {
      const content = `Access key ID,Secret access key
AKIAIOSFODNN7EXAMPLE,secret1

AKIAI44QH8DHBEXAMPLE,secret2`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(true);
      expect(result.profiles).toHaveLength(2);
    });
  });

  describe("parseCredentialsFile - error handling", () => {
    it("returns error for empty content", () => {
      const result = parseCredentialsFile("");
      expect(result.success).toBe(false);
      expect(result.error).toContain("empty");
    });

    it("returns error for unknown format", () => {
      const result = parseCredentialsFile("random text without credentials");
      expect(result.success).toBe(false);
      expect(result.error).toContain("format");
    });

    it("returns error for invalid access key format", () => {
      const content = `[default]
aws_access_key_id = invalid-key
aws_secret_access_key = secret`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain("Invalid AWS access key ID");
    });

    it("returns error when no credentials found", () => {
      const content = `[default]
some_other_key = value`;

      const result = parseCredentialsFile(content);
      expect(result.success).toBe(false);
      expect(result.error).toContain("No valid AWS credentials");
    });
  });

  describe("validateAccessKeyId", () => {
    it("accepts valid long-term key (AKIA)", () => {
      expect(validateAccessKeyId("AKIAIOSFODNN7EXAMPLE")).toBe(true);
    });

    it("accepts valid temporary key (ASIA)", () => {
      expect(validateAccessKeyId("ASIAZXCVBNM1234TEMP")).toBe(true);
    });

    it("rejects invalid prefix", () => {
      expect(validateAccessKeyId("ABCDIOSFODNN7EXAMPLE")).toBe(false);
    });

    it("rejects wrong length", () => {
      expect(validateAccessKeyId("AKIAIOSFODNN7")).toBe(false);
      expect(validateAccessKeyId("AKIAIOSFODNN7EXAMPLETOOLONG")).toBe(false);
    });
  });

  describe("isTemporaryCredentials", () => {
    it("returns true for credentials with session token", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "secret",
        sessionToken: "token",
      };
      expect(isTemporaryCredentials(cred)).toBe(true);
    });

    it("returns true for ASIA access key", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "ASIAZXCVBNM1234TEMP",
        secretAccessKey: "secret",
      };
      expect(isTemporaryCredentials(cred)).toBe(true);
    });

    it("returns false for permanent credentials", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "secret",
      };
      expect(isTemporaryCredentials(cred)).toBe(false);
    });
  });

  describe("getFormatDisplayName", () => {
    it("returns correct display names", () => {
      expect(getFormatDisplayName("ini")).toBe("AWS Credentials File (INI)");
      expect(getFormatDisplayName("json")).toBe("JSON");
      expect(getFormatDisplayName("env")).toBe("Environment File (.env)");
      expect(getFormatDisplayName("csv")).toBe("CSV (AWS Console Export)");
      expect(getFormatDisplayName("unknown")).toBe("Unknown");
    });
  });

  describe("isCredentialExpired", () => {
    it("returns false for credentials without expiresAt", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "secret",
      };
      expect(isCredentialExpired(cred)).toBe(false);
    });

    it("returns true for expired credentials", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "ASIAZXCVBNM1234TEMP",
        secretAccessKey: "secret",
        sessionToken: "token",
        expiresAt: Date.now() - 3600000, // 1 hour ago
      };
      expect(isCredentialExpired(cred)).toBe(true);
    });

    it("returns false for valid credentials", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "ASIAZXCVBNM1234TEMP",
        secretAccessKey: "secret",
        sessionToken: "token",
        expiresAt: Date.now() + 3600000, // 1 hour from now
      };
      expect(isCredentialExpired(cred)).toBe(false);
    });
  });

  describe("getCredentialExpiryStatus", () => {
    it("returns no_expiry for credentials without expiresAt", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "AKIAIOSFODNN7EXAMPLE",
        secretAccessKey: "secret",
      };
      const status = getCredentialExpiryStatus(cred);
      expect(status.status).toBe("no_expiry");
    });

    it("returns expired for past expiration time", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "ASIAZXCVBNM1234TEMP",
        secretAccessKey: "secret",
        sessionToken: "token",
        expiresAt: Date.now() - 1800000, // 30 minutes ago
      };
      const status = getCredentialExpiryStatus(cred);
      expect(status.status).toBe("expired");
      if (status.status === "expired") {
        expect(status.expiredMinutesAgo).toBeGreaterThanOrEqual(29);
        expect(status.expiredMinutesAgo).toBeLessThanOrEqual(31);
      }
    });

    it("returns expiring_soon for credentials expiring within threshold", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "ASIAZXCVBNM1234TEMP",
        secretAccessKey: "secret",
        sessionToken: "token",
        expiresAt: Date.now() + 1800000, // 30 minutes from now
      };
      const status = getCredentialExpiryStatus(cred, 60); // 60 minute threshold
      expect(status.status).toBe("expiring_soon");
      if (status.status === "expiring_soon") {
        expect(status.expiresInMinutes).toBeGreaterThanOrEqual(29);
        expect(status.expiresInMinutes).toBeLessThanOrEqual(31);
      }
    });

    it("returns valid for credentials not expiring soon", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "ASIAZXCVBNM1234TEMP",
        secretAccessKey: "secret",
        sessionToken: "token",
        expiresAt: Date.now() + 7200000, // 2 hours from now
      };
      const status = getCredentialExpiryStatus(cred, 60); // 60 minute threshold
      expect(status.status).toBe("valid");
      if (status.status === "valid") {
        expect(status.expiresAt).toBeDefined();
      }
    });

    it("uses custom threshold for expiring_soon", () => {
      const cred: ParsedCredential = {
        profileName: "test",
        accessKeyId: "ASIAZXCVBNM1234TEMP",
        secretAccessKey: "secret",
        sessionToken: "token",
        expiresAt: Date.now() + 600000, // 10 minutes from now
      };
      // With 5 minute threshold, should be "valid"
      expect(getCredentialExpiryStatus(cred, 5).status).toBe("valid");
      // With 15 minute threshold, should be "expiring_soon"
      expect(getCredentialExpiryStatus(cred, 15).status).toBe("expiring_soon");
    });
  });

  describe("formatExpiryTime", () => {
    it("formats expired time in minutes", () => {
      const expiresAt = Date.now() - 300000; // 5 minutes ago
      const formatted = formatExpiryTime(expiresAt);
      expect(formatted).toMatch(/Expired 5 minutes ago/);
    });

    it("formats expired time in hours", () => {
      const expiresAt = Date.now() - 7200000; // 2 hours ago
      const formatted = formatExpiryTime(expiresAt);
      expect(formatted).toMatch(/Expired 2 hours ago/);
    });

    it("formats expired time in days", () => {
      const expiresAt = Date.now() - 172800000; // 2 days ago
      const formatted = formatExpiryTime(expiresAt);
      expect(formatted).toMatch(/Expired 2 days ago/);
    });

    it("formats valid time in minutes", () => {
      const expiresAt = Date.now() + 300000; // 5 minutes from now
      const formatted = formatExpiryTime(expiresAt);
      expect(formatted).toMatch(/Expires in 5 minutes/);
    });

    it("formats valid time in hours", () => {
      const expiresAt = Date.now() + 7200000; // 2 hours from now
      const formatted = formatExpiryTime(expiresAt);
      expect(formatted).toMatch(/Expires in 2 hours/);
    });

    it("formats valid time in days", () => {
      const expiresAt = Date.now() + 172800000; // 2 days from now
      const formatted = formatExpiryTime(expiresAt);
      expect(formatted).toMatch(/Expires in 2 days/);
    });

    it("handles singular units correctly", () => {
      const oneMinuteAgo = Date.now() - 60000;
      expect(formatExpiryTime(oneMinuteAgo)).toMatch(/Expired 1 minute ago/);

      const oneHourFromNow = Date.now() + 3600000;
      expect(formatExpiryTime(oneHourFromNow)).toMatch(/Expires in 1 hour/);
    });
  });
});
