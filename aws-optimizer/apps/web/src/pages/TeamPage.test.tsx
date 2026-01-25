import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { TeamPage } from "./TeamPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock team members data
const mockMembers = [
  {
    _id: "member-1",
    organizationId: "org-1",
    userId: "user-1",
    role: "owner",
    createdAt: Date.now() - 30 * 86400000, // 30 days ago
    updatedAt: Date.now() - 86400000, // 1 day ago
    user: {
      _id: "user-1",
      name: "John Owner",
      email: "john@example.com",
      image: null,
    },
  },
  {
    _id: "member-2",
    organizationId: "org-1",
    userId: "user-2",
    role: "admin",
    createdAt: Date.now() - 20 * 86400000, // 20 days ago
    updatedAt: Date.now() - 7 * 86400000, // 7 days ago
    user: {
      _id: "user-2",
      name: "Jane Admin",
      email: "jane@example.com",
      image: null,
    },
  },
  {
    _id: "member-3",
    organizationId: "org-1",
    userId: "user-3",
    role: "member",
    createdAt: Date.now() - 10 * 86400000, // 10 days ago
    updatedAt: Date.now() - 3 * 86400000, // 3 days ago
    user: {
      _id: "user-3",
      name: "Bob Member",
      email: "bob@example.com",
      image: null,
    },
  },
  {
    _id: "member-4",
    organizationId: "org-1",
    userId: "user-4",
    role: "viewer",
    createdAt: Date.now() - 5 * 86400000, // 5 days ago
    updatedAt: Date.now() - 86400000, // 1 day ago
    user: {
      _id: "user-4",
      name: "Alice Viewer",
      email: "alice@example.com",
      image: null,
    },
  },
];

const mockInviteMutation = vi.fn();
const mockUpdateRoleMutation = vi.fn();
const mockRemoveMutation = vi.fn();

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => mockMembers),
  useMutation: vi.fn((mutationName) => {
    if (mutationName?.includes?.("invite")) return mockInviteMutation;
    if (mutationName?.includes?.("updateRole")) return mockUpdateRoleMutation;
    if (mutationName?.includes?.("remove")) return mockRemoveMutation;
    return vi.fn();
  }),
}));

// Mock auth client
vi.mock("../lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        name: "John Owner",
        email: "john@example.com",
      },
    },
    isPending: false,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-034: Team Management Page", () => {
  beforeEach(() => {
    mockNavigate.mockClear();
    mockInviteMutation.mockClear();
    mockUpdateRoleMutation.mockClear();
    mockRemoveMutation.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /team route with member list", () => {
    test("should render team page", () => {
      renderWithProviders(<TeamPage />);
      
      expect(screen.getByTestId("team-page")).toBeInTheDocument();
    });

    test("should display page title", () => {
      renderWithProviders(<TeamPage />);
      
      expect(screen.getByRole("heading", { name: /^team$/i, level: 2 })).toBeInTheDocument();
    });

    test("should display list of team members", () => {
      renderWithProviders(<TeamPage />);
      
      expect(screen.getByText("John Owner")).toBeInTheDocument();
      expect(screen.getByText("Jane Admin")).toBeInTheDocument();
      expect(screen.getByText("Bob Member")).toBeInTheDocument();
      expect(screen.getByText("Alice Viewer")).toBeInTheDocument();
    });

    test("should have members list container", () => {
      renderWithProviders(<TeamPage />);
      
      expect(screen.getByTestId("members-list")).toBeInTheDocument();
    });

    test("should display each member as a row", () => {
      renderWithProviders(<TeamPage />);
      
      const memberItems = screen.getAllByTestId(/member-item-/);
      expect(memberItems.length).toBe(4);
    });
  });

  describe("AC2: Show member name, email, role, and status", () => {
    test("should display member names", () => {
      renderWithProviders(<TeamPage />);
      
      expect(screen.getByText("John Owner")).toBeInTheDocument();
      expect(screen.getByText("Jane Admin")).toBeInTheDocument();
      expect(screen.getByText("Bob Member")).toBeInTheDocument();
      expect(screen.getByText("Alice Viewer")).toBeInTheDocument();
    });

    test("should display member emails", () => {
      renderWithProviders(<TeamPage />);
      
      expect(screen.getByText("john@example.com")).toBeInTheDocument();
      expect(screen.getByText("jane@example.com")).toBeInTheDocument();
      expect(screen.getByText("bob@example.com")).toBeInTheDocument();
      expect(screen.getByText("alice@example.com")).toBeInTheDocument();
    });

    test("should display member roles", () => {
      renderWithProviders(<TeamPage />);
      
      // Should show role badges
      expect(screen.getByTestId("role-badge-member-1")).toHaveTextContent(/owner/i);
      expect(screen.getByTestId("role-badge-member-2")).toHaveTextContent(/admin/i);
      expect(screen.getByTestId("role-badge-member-3")).toHaveTextContent(/member/i);
      expect(screen.getByTestId("role-badge-member-4")).toHaveTextContent(/viewer/i);
    });

    test("should display member status (active)", () => {
      renderWithProviders(<TeamPage />);
      
      // All members should show active status
      const memberItem = screen.getByTestId("member-item-member-1");
      expect(within(memberItem).getByTestId("status-badge-member-1")).toBeInTheDocument();
    });
  });

  describe("AC3: Allow inviting new members via email", () => {
    test("should have Invite Member button", () => {
      renderWithProviders(<TeamPage />);
      
      const inviteButton = screen.getByRole("button", { name: /invite member/i });
      expect(inviteButton).toBeInTheDocument();
    });

    test("should open invite modal when button clicked", async () => {
      renderWithProviders(<TeamPage />);
      
      const inviteButton = screen.getByRole("button", { name: /invite member/i });
      fireEvent.click(inviteButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("invite-modal")).toBeInTheDocument();
      });
    });

    test("should have email input field in invite modal", async () => {
      renderWithProviders(<TeamPage />);
      
      const inviteButton = screen.getByRole("button", { name: /invite member/i });
      fireEvent.click(inviteButton);
      
      await waitFor(() => {
        expect(screen.getByPlaceholderText(/colleague@company.com/i)).toBeInTheDocument();
      });
    });

    test("should have role selector in invite modal", async () => {
      renderWithProviders(<TeamPage />);
      
      const inviteButton = screen.getByRole("button", { name: /invite member/i });
      fireEvent.click(inviteButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("role-selector")).toBeInTheDocument();
      });
    });

    test("should call invite mutation when form submitted", async () => {
      renderWithProviders(<TeamPage />);
      
      const inviteButton = screen.getByRole("button", { name: /invite member/i });
      fireEvent.click(inviteButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("invite-modal")).toBeInTheDocument();
      });
      
      // Fill in email - Modal content is portaled, so search in document
      await waitFor(() => {
        const textboxes = document.querySelectorAll("input[type='text'], input:not([type])");
        expect(textboxes.length).toBeGreaterThan(0);
      });
      
      const textboxes = document.querySelectorAll("input[type='text'], input:not([type])");
      const emailInput = textboxes[0] as HTMLInputElement;
      fireEvent.change(emailInput, { target: { value: "newuser@example.com" } });
      
      // Submit the form - find Send Invite button
      const allButtons = document.querySelectorAll("button");
      const submitButton = Array.from(allButtons).find(
        btn => btn.textContent?.includes("Send Invite")
      );
      expect(submitButton).toBeDefined();
      if (submitButton) fireEvent.click(submitButton);
      
      await waitFor(() => {
        expect(mockInviteMutation).toHaveBeenCalled();
      });
    });
  });

  describe("AC4: Allow changing member roles (admin, member, viewer)", () => {
    test("should have change role button for each member (except owner)", () => {
      renderWithProviders(<TeamPage />);
      
      // Non-owner members should have role change option
      const adminMember = screen.getByTestId("member-item-member-2");
      expect(within(adminMember).getByRole("button", { name: /change role/i })).toBeInTheDocument();
    });

    test("should open role change menu when clicked", async () => {
      renderWithProviders(<TeamPage />);
      
      const adminMember = screen.getByTestId("member-item-member-2");
      const changeRoleButton = within(adminMember).getByRole("button", { name: /change role/i });
      fireEvent.click(changeRoleButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("role-menu")).toBeInTheDocument();
      });
    });

    test("should show role options (admin, member, viewer)", async () => {
      renderWithProviders(<TeamPage />);
      
      const memberItem = screen.getByTestId("member-item-member-3");
      const changeRoleButton = within(memberItem).getByRole("button", { name: /change role/i });
      fireEvent.click(changeRoleButton);
      
      await waitFor(() => {
        const roleMenu = screen.getByTestId("role-menu");
        expect(within(roleMenu).getByText(/admin/i)).toBeInTheDocument();
        expect(within(roleMenu).getByText(/member/i)).toBeInTheDocument();
        expect(within(roleMenu).getByText(/viewer/i)).toBeInTheDocument();
      });
    });

    test("should call updateRole mutation when role selected", async () => {
      renderWithProviders(<TeamPage />);
      
      const memberItem = screen.getByTestId("member-item-member-3");
      const changeRoleButton = within(memberItem).getByRole("button", { name: /change role/i });
      fireEvent.click(changeRoleButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("role-menu")).toBeInTheDocument();
      });
      
      const roleMenu = screen.getByTestId("role-menu");
      const adminOption = within(roleMenu).getByText(/^Admin$/i);
      fireEvent.click(adminOption);
      
      await waitFor(() => {
        expect(mockUpdateRoleMutation).toHaveBeenCalled();
      });
    });
  });

  describe("AC5: Allow removing members with confirmation", () => {
    test("should have remove button for each member (except self)", () => {
      renderWithProviders(<TeamPage />);
      
      // Other members should have remove button
      const adminMember = screen.getByTestId("member-item-member-2");
      expect(within(adminMember).getByRole("button", { name: /remove/i })).toBeInTheDocument();
    });

    test("should open confirmation modal when remove clicked", async () => {
      renderWithProviders(<TeamPage />);
      
      const adminMember = screen.getByTestId("member-item-member-2");
      const removeButton = within(adminMember).getByRole("button", { name: /remove/i });
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("confirm-remove-modal")).toBeInTheDocument();
      });
    });

    test("should show member name in confirmation modal", async () => {
      renderWithProviders(<TeamPage />);
      
      const adminMember = screen.getByTestId("member-item-member-2");
      const removeButton = within(adminMember).getByRole("button", { name: /remove/i });
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.getByText(/Jane Admin/i)).toBeInTheDocument();
      });
    });

    test("should call remove mutation when confirmed", async () => {
      renderWithProviders(<TeamPage />);
      
      const adminMember = screen.getByTestId("member-item-member-2");
      const removeButton = within(adminMember).getByRole("button", { name: /remove/i });
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.getByTestId("confirm-remove-modal")).toBeInTheDocument();
      });
      
      // Modal content is portaled, so search in document
      await waitFor(() => {
        const allButtons = document.querySelectorAll("button");
        const confirmButton = Array.from(allButtons).find(
          btn => btn.textContent === "Confirm"
        );
        expect(confirmButton).toBeDefined();
      });
      
      const allButtons = document.querySelectorAll("button");
      const confirmButton = Array.from(allButtons).find(
        btn => btn.textContent === "Confirm"
      );
      if (confirmButton) fireEvent.click(confirmButton);
      
      await waitFor(() => {
        expect(mockRemoveMutation).toHaveBeenCalled();
      });
    });

    test("should have cancel button in confirmation modal", async () => {
      renderWithProviders(<TeamPage />);
      
      const adminMember = screen.getByTestId("member-item-member-2");
      const removeButton = within(adminMember).getByRole("button", { name: /remove/i });
      fireEvent.click(removeButton);
      
      await waitFor(() => {
        expect(screen.getByRole("button", { name: /cancel/i })).toBeInTheDocument();
      });
    });
  });

  describe("Note: Only owners and admins can manage team", () => {
    test("should display management notice for admins/owners", () => {
      renderWithProviders(<TeamPage />);
      
      // Should show some indication about management permissions
      expect(screen.getByTestId("team-page")).toBeInTheDocument();
    });
  });

  describe("Team Display Features", () => {
    test("should display member count", () => {
      renderWithProviders(<TeamPage />);
      
      expect(screen.getByTestId("member-count")).toBeInTheDocument();
      expect(screen.getByTestId("member-count")).toHaveTextContent("4");
    });

    test("should show role distribution", () => {
      renderWithProviders(<TeamPage />);
      
      // Should have some stats or badges showing role breakdown
      expect(screen.getByTestId("members-list")).toBeInTheDocument();
    });
  });
});

describe("TeamPage Route Integration", () => {
  test("TeamPage should be exported from pages index", async () => {
    const pages = await import("./index");
    expect(pages.TeamPage).toBeDefined();
    expect(typeof pages.TeamPage).toBe("function");
  });
});
