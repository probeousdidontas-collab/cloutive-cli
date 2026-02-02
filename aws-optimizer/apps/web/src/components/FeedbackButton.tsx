import { BugReportProvider, BugReportButton } from '@fatagnus/convex-feedback/react';
import { useSession } from '../lib/auth-client';
import { api } from '@aws-optimizer/convex/convex/_generated/api';
import type { ReactNode } from 'react';

interface FeedbackProviderProps {
  children: ReactNode;
}

/**
 * Internal component that renders the floating feedback button for authenticated users.
 * Renders at the bottom-right corner of the screen.
 */
function AuthenticatedFeedbackButton() {
  const { data: session, isPending } = useSession();
  const user = session?.user;

  if (isPending || !user) return null;

  return (
    <BugReportButton
      reporterType="customer"
      reporterId={user.id}
      reporterEmail={user.email || ''}
      reporterName={user.name || 'User'}
      bugReportApi={{
        create: api.feedback.createBugReport,
        generateUploadUrl: api.feedback.generateBugReportUploadUrl,
      }}
      feedbackApi={{
        create: api.feedback.createFeedback,
        generateUploadUrl: api.feedback.generateFeedbackUploadUrl,
      }}
    />
  );
}

/**
 * Feedback provider that wraps the application and provides the bug report
 * context. Also renders the floating feedback button for authenticated users.
 */
export function FeedbackProvider({ children }: FeedbackProviderProps) {
  const { isPending } = useSession();

  if (isPending) {
    return <>{children}</>;
  }

  return (
    <BugReportProvider>
      {children}
      <AuthenticatedFeedbackButton />
    </BugReportProvider>
  );
}
