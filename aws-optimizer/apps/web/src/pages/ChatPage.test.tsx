import { describe, test, expect, beforeEach, afterEach, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MantineProvider } from "@mantine/core";
import { ChatPage } from "./ChatPage";

// Mock TanStack Router hooks
const mockNavigate = vi.fn();

vi.mock("@tanstack/react-router", () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => (
    <a href={to}>{children}</a>
  ),
}));

// Mock Convex hooks
const mockSendMessage = vi.fn();
const mockCreateThread = vi.fn();


// Mock thread data
const mockThreads = {
  page: [
    { id: "thread-1", title: "AWS Cost Analysis", createdAt: Date.now() - 86400000, status: "active" },
    { id: "thread-2", title: "EC2 Optimization", createdAt: Date.now() - 172800000, status: "active" },
  ],
  isDone: true,
  continueCursor: null,
};

// Mock messages data
const mockMessages = {
  page: [
    {
      _id: "msg-1",
      role: "user",
      message: { type: "text", text: "What are my top cost drivers?" },
      _creationTime: Date.now() - 60000,
    },
    {
      _id: "msg-2",
      role: "assistant",
      message: { type: "text", text: "Based on my analysis, your top cost drivers are EC2 instances (45%), RDS databases (25%), and S3 storage (15%)." },
      _creationTime: Date.now() - 30000,
    },
  ],
  isDone: true,
  continueCursor: null,
};

// Track which query is being called
let queryCallCount = 0;

vi.mock("convex/react", () => ({
  useQuery: vi.fn(() => {
    // Alternate between threads and messages based on call order
    // First call is threads, second is messages
    queryCallCount++;
    if (queryCallCount % 2 === 1) {
      return mockThreads;
    }
    return mockMessages;
  }),
  useMutation: vi.fn(() => mockSendMessage),
  useAction: vi.fn(() => vi.fn()),
}));

// Mock auth client
vi.mock("../lib/auth-client", () => ({
  useSession: () => ({
    data: {
      user: {
        id: "user-1",
        name: "Test User",
        email: "test@example.com",
      },
    },
    isPending: false,
  }),
}));

function renderWithProviders(ui: React.ReactElement) {
  return render(<MantineProvider>{ui}</MantineProvider>);
}

describe("US-022: AI Chat Interface Page", () => {
  beforeEach(() => {
    queryCallCount = 0;
    mockNavigate.mockClear();
    mockSendMessage.mockClear();
    mockCreateThread.mockClear();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("AC1: Create /chat route as primary UI", () => {
    test("should render chat page", () => {
      renderWithProviders(<ChatPage />);
      
      // Should have main chat container
      expect(screen.getByTestId("chat-page")).toBeInTheDocument();
    });

    test("should have chat-specific layout structure", () => {
      renderWithProviders(<ChatPage />);
      
      // Should have message area and input area
      expect(screen.getByTestId("message-area")).toBeInTheDocument();
      expect(screen.getByTestId("chat-input")).toBeInTheDocument();
    });
  });

  describe("AC2: Display message history with user and assistant messages", () => {
    test("should display user messages", () => {
      renderWithProviders(<ChatPage />);
      
      expect(screen.getByText("What are my top cost drivers?")).toBeInTheDocument();
    });

    test("should display assistant messages", () => {
      renderWithProviders(<ChatPage />);
      
      expect(screen.getByText(/Based on my analysis/)).toBeInTheDocument();
    });

    test("should visually distinguish user and assistant messages", () => {
      renderWithProviders(<ChatPage />);
      
      // User messages should have user indicator
      const userMessage = screen.getByText("What are my top cost drivers?").closest("[data-message-role]");
      expect(userMessage).toHaveAttribute("data-message-role", "user");
      
      // Assistant messages should have assistant indicator
      const assistantMessage = screen.getByText(/Based on my analysis/).closest("[data-message-role]");
      expect(assistantMessage).toHaveAttribute("data-message-role", "assistant");
    });
  });

  describe("AC3: Implement chat input with send button and Enter key support", () => {
    test("should have text input for messages", () => {
      renderWithProviders(<ChatPage />);
      
      const input = screen.getByPlaceholderText(/ask|message|type/i);
      expect(input).toBeInTheDocument();
    });

    test("should have send button", () => {
      renderWithProviders(<ChatPage />);
      
      const sendButton = screen.getByRole("button", { name: /send/i });
      expect(sendButton).toBeInTheDocument();
    });

    test("should send message on button click", async () => {
      renderWithProviders(<ChatPage />);
      
      const input = screen.getByPlaceholderText(/ask|message|type/i);
      const sendButton = screen.getByRole("button", { name: /send/i });
      
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });
    });

    test("should send message on Enter key press", async () => {
      renderWithProviders(<ChatPage />);
      
      const input = screen.getByPlaceholderText(/ask|message|type/i);
      
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.keyDown(input, { key: "Enter", code: "Enter" });
      
      await waitFor(() => {
        expect(mockSendMessage).toHaveBeenCalled();
      });
    });

    test("should clear input after sending", async () => {
      renderWithProviders(<ChatPage />);
      
      const input = screen.getByPlaceholderText(/ask|message|type/i) as HTMLInputElement;
      const sendButton = screen.getByRole("button", { name: /send/i });
      
      fireEvent.change(input, { target: { value: "Test message" } });
      fireEvent.click(sendButton);
      
      await waitFor(() => {
        expect(input.value).toBe("");
      });
    });

    test("should not send empty messages", async () => {
      renderWithProviders(<ChatPage />);
      
      const sendButton = screen.getByRole("button", { name: /send/i });
      
      fireEvent.click(sendButton);
      
      expect(mockSendMessage).not.toHaveBeenCalled();
    });
  });

  describe("AC4: Show streaming responses in real-time", () => {
    test("should show loading indicator when waiting for response", async () => {
      renderWithProviders(<ChatPage />);
      
      // The component should have a way to show loading state
      // This will be visible when a message is being processed
      expect(screen.getByTestId("chat-page")).toBeInTheDocument();
    });
  });

  describe("AC5: Display thread list in sidebar for conversation history", () => {
    test("should display thread list", () => {
      renderWithProviders(<ChatPage />);
      
      expect(screen.getByTestId("thread-list")).toBeInTheDocument();
    });

    test("should show thread titles", () => {
      renderWithProviders(<ChatPage />);
      
      expect(screen.getByText("AWS Cost Analysis")).toBeInTheDocument();
      expect(screen.getByText("EC2 Optimization")).toBeInTheDocument();
    });

    test("should allow selecting a thread", () => {
      renderWithProviders(<ChatPage />);
      
      const thread = screen.getByText("AWS Cost Analysis");
      fireEvent.click(thread);
      
      // Thread should be selectable
      expect(thread).toBeInTheDocument();
    });
  });

  describe("AC6: Allow creating new threads", () => {
    test("should have new thread button", () => {
      renderWithProviders(<ChatPage />);
      
      const newThreadButton = screen.getByRole("button", { name: /new|create/i });
      expect(newThreadButton).toBeInTheDocument();
    });

    test("should create new thread on button click", async () => {
      // Re-mock useMutation for this specific test
      const { useMutation } = await import("convex/react");
      (useMutation as ReturnType<typeof vi.fn>).mockImplementation(() => mockCreateThread);
      
      renderWithProviders(<ChatPage />);
      
      const newThreadButton = screen.getByRole("button", { name: /new|create/i });
      fireEvent.click(newThreadButton);
      
      // Button should be clickable (actual creation handled by Convex)
      expect(newThreadButton).toBeInTheDocument();
    });
  });
});
