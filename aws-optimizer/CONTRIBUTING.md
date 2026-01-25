# Contributing to AWS Cost Optimizer

Thank you for your interest in contributing! This document provides guidelines for development.

## Development Workflow

### 1. Setup

```bash
# Clone the repository
git clone https://github.com/your-org/aws-optimizer.git
cd aws-optimizer

# Install dependencies
npm install

# Start development servers
npm run dev
```

### 2. Making Changes

1. Create a feature branch from `main`
2. Make your changes
3. Write/update tests
4. Run quality checks (see below)
5. Submit a pull request

### 3. Quality Checks

Before submitting, ensure all checks pass:

```bash
# Type checking
npm run typecheck

# Linting
npm run lint --workspaces --if-present

# Tests
npm test --workspaces
```

## Code Style

### TypeScript

- Use TypeScript for all new code
- Avoid `any` types - use proper typing
- Export types when they may be reused
- Use `interface` for object shapes, `type` for unions/aliases

### React

- Use functional components with hooks
- Keep components focused and small
- Use Mantine components for UI
- Colocate component styles

### Convex

- Use `authedQuery` and `authedMutation` for authenticated endpoints
- Always check organization membership before data access
- Log significant actions with `logActivity`
- Include rate limiting for public endpoints

### Testing

- Write tests for new functionality
- Use `convex-test` for backend tests
- Use Testing Library for React components
- Prefer integration tests over unit tests for complex flows

## Project Structure Guidelines

### Adding a New Feature

1. **Backend (Convex)**
   - Add schema types in `schema.ts`
   - Create query/mutation functions
   - Add tests
   - Update rate limits if needed

2. **Frontend (Web)**
   - Add page component in `src/pages/`
   - Add route in `src/routes/`
   - Create MobX store if needed
   - Add tests

### File Naming

- Components: `PascalCase.tsx` (e.g., `DashboardPage.tsx`)
- Functions: `camelCase.ts` (e.g., `organizations.ts`)
- Tests: `*.test.ts` or `*.test.tsx`
- Types: Colocate with implementation or in `types.ts`

## Commit Messages

Use conventional commit format:

```
type: description

[optional body]
```

Types:
- `feat` - New feature
- `fix` - Bug fix
- `docs` - Documentation
- `refactor` - Code refactoring
- `test` - Test changes
- `chore` - Build/tooling changes

Examples:
```
feat: add budget threshold alerts
fix: handle empty cost data in dashboard
docs: update deployment instructions
```

## Security Considerations

### AWS Credentials

- Never log or expose AWS credentials
- Always encrypt credentials at rest
- Use the sandbox for all AWS command execution
- Validate and sanitize all user input

### Authentication

- Use `requireAuth` for all authenticated endpoints
- Use `requireRole` for role-based access
- Always verify organization membership

### Data Access

- Check membership before returning organization data
- Use row-level security via membership checks
- Audit sensitive operations with activity logs

## Testing Guidelines

### Backend Tests

```typescript
import { convexTest } from "convex-test";
import { expect, test, describe } from "vitest";
import { api } from "./_generated/api";

describe("organizations", () => {
  test("create organization", async () => {
    const t = convexTest();
    // ... test implementation
  });
});
```

### Frontend Tests

```tsx
import { render, screen } from '@testing-library/react';
import { describe, test, expect } from 'vitest';

describe('DashboardPage', () => {
  test('renders dashboard title', () => {
    render(<DashboardPage />);
    expect(screen.getByText('Dashboard')).toBeInTheDocument();
  });
});
```

## Getting Help

- Check existing issues and pull requests
- Review the documentation in `docs/`
- Ask questions in pull request comments

## License

By contributing, you agree that your contributions will be licensed under the project's license.
