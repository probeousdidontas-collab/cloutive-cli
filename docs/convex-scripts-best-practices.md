# Convex Scripts Best Practices

Guidelines for writing scripts and preventing code duplication in Convex applications.

## Table of Contents

1. [Use Internal Functions for Scripts](#use-internal-functions-for-scripts)
2. [Separate Business Logic from Auth Layer](#separate-business-logic-from-auth-layer)
3. [Code Reuse Patterns](#code-reuse-patterns)
4. [Examples](#examples)

---

## Use Internal Functions for Scripts

When writing scripts (one-off operations, data migrations, administrative tasks, etc.), **always use internal mutations/queries/actions** instead of creating new public functions.

### Why?

- **Security**: Internal functions are not exposed to the public API
- **Cleaner API surface**: Your public API only contains functions meant for clients
- **Reusability**: Scripts can call the same internal functions your public API uses

### ❌ Wrong: Creating Public Functions for Scripts

```typescript
// DON'T: This exposes a dangerous operation to the public API
export const backfillUserDisplayNames = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.patch(user._id, { 
        displayName: user.name.split(" ")[0] 
      });
    }
    return null;
  },
});
```

### ✅ Correct: Using Internal Functions for Scripts

```typescript
// DO: Use internalMutation for scripts
export const backfillUserDisplayNames = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    for (const user of users) {
      await ctx.db.patch(user._id, { 
        displayName: user.name.split(" ")[0] 
      });
    }
    return null;
  },
});
```

Run with:
```bash
npx convex run users:backfillUserDisplayNames
```

---

## Separate Business Logic from Auth Layer

When you have similar functionality needed by both public APIs (with auth) and scripts (without auth), **extract the core business logic into a separate shared function**.

### The Pattern

1. **Shared Logic Function**: Pure business logic, no auth checks
2. **Public Function**: Auth wrapper + calls shared logic
3. **Internal Function (Script)**: Calls shared logic directly

### Why?

- **No code duplication**: Core logic lives in one place
- **Easier testing**: Test business logic independently from auth
- **Consistent behavior**: Scripts and API use the same logic
- **Maintainability**: Fix bugs in one place

---

## Code Reuse Patterns

### Pattern 1: Extract Core Logic to Helper Functions

```typescript
// convex/users.ts
import { v } from "convex/values";
import { 
  internalMutation, 
  internalQuery 
} from "./_generated/server";
import { authedMutation, authedQuery } from "./functions";
import { Id, Doc } from "./_generated/dataModel";
import { MutationCtx, QueryCtx } from "./_generated/server";

// ============================================
// SHARED LOGIC (no auth, reusable)
// ============================================

/**
 * Core logic for creating a user - no auth checks
 */
async function createUserCore(
  ctx: MutationCtx,
  data: { name: string; email: string; role?: string }
): Promise<Id<"users">> {
  // Validate email uniqueness
  const existing = await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", data.email))
    .unique();
  
  if (existing) {
    throw new Error("Email already exists");
  }

  return await ctx.db.insert("users", {
    name: data.name,
    email: data.email,
    role: data.role ?? "user",
    createdAt: Date.now(),
  });
}

/**
 * Core logic for updating a user - no auth checks
 */
async function updateUserCore(
  ctx: MutationCtx,
  userId: Id<"users">,
  updates: Partial<{ name: string; email: string; role: string }>
): Promise<void> {
  const user = await ctx.db.get(userId);
  if (!user) {
    throw new Error("User not found");
  }

  // If updating email, check uniqueness
  if (updates.email && updates.email !== user.email) {
    const existing = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", updates.email))
      .unique();
    if (existing) {
      throw new Error("Email already exists");
    }
  }

  await ctx.db.patch(userId, updates);
}

/**
 * Core logic for fetching user by email - no auth checks
 */
async function getUserByEmailCore(
  ctx: QueryCtx,
  email: string
): Promise<Doc<"users"> | null> {
  return await ctx.db
    .query("users")
    .withIndex("by_email", (q) => q.eq("email", email))
    .unique();
}

// ============================================
// PUBLIC API (with auth)
// ============================================

/**
 * Public mutation - requires authentication
 */
export const createUser = authedMutation({
  args: {
    name: v.string(),
    email: v.string(),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Auth is handled by authedMutation wrapper
    // Only admins can create users
    if (ctx.user.role !== "admin") {
      throw new Error("Only admins can create users");
    }
    
    // Reuse core logic
    return await createUserCore(ctx, args);
  },
});

/**
 * Public mutation - user can update their own profile
 */
export const updateMyProfile = authedMutation({
  args: {
    name: v.optional(v.string()),
    email: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    // Users can only update certain fields on themselves
    const { name, email } = args;
    
    // Reuse core logic
    await updateUserCore(ctx, ctx.user._id, { name, email });
    return null;
  },
});

// ============================================
// INTERNAL FUNCTIONS (for scripts, no auth)
// ============================================

/**
 * Internal mutation for scripts - create user without auth
 */
export const createUserInternal = internalMutation({
  args: {
    name: v.string(),
    email: v.string(),
    role: v.optional(v.string()),
  },
  returns: v.id("users"),
  handler: async (ctx, args) => {
    // Directly use core logic - no auth needed for scripts
    return await createUserCore(ctx, args);
  },
});

/**
 * Internal mutation for scripts - update any user
 */
export const updateUserInternal = internalMutation({
  args: {
    userId: v.id("users"),
    name: v.optional(v.string()),
    email: v.optional(v.string()),
    role: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const { userId, ...updates } = args;
    await updateUserCore(ctx, userId, updates);
    return null;
  },
});

/**
 * Internal query for scripts - find user by email
 */
export const getUserByEmailInternal = internalQuery({
  args: { email: v.string() },
  returns: v.union(
    v.object({
      _id: v.id("users"),
      _creationTime: v.number(),
      name: v.string(),
      email: v.string(),
      role: v.string(),
      createdAt: v.number(),
    }),
    v.null()
  ),
  handler: async (ctx, args) => {
    return await getUserByEmailCore(ctx, args.email);
  },
});
```

### Pattern 2: Scripts Calling Internal Functions

When writing a script that performs complex operations, compose internal functions:

```typescript
// convex/scripts/seedData.ts
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Script to seed initial data - uses internal functions
 */
export const seedInitialData = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    // Use internal functions instead of duplicating logic
    const adminId = await ctx.runMutation(internal.users.createUserInternal, {
      name: "Admin User",
      email: "admin@example.com",
      role: "admin",
    });

    const userId = await ctx.runMutation(internal.users.createUserInternal, {
      name: "Test User",
      email: "user@example.com",
      role: "user",
    });

    // Create sample data using other internal functions
    await ctx.runMutation(internal.posts.createPostInternal, {
      authorId: userId,
      title: "Welcome Post",
      content: "Hello, world!",
    });

    console.log("Seeded data successfully");
    return null;
  },
});
```

### Pattern 3: Refactoring Existing Code

If you find yourself writing a script that duplicates existing public function logic:

#### Before (Duplicated Code) ❌

```typescript
// Public API
export const archivePost = authedMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (!post) throw new Error("Post not found");
    if (post.authorId !== ctx.user._id) throw new Error("Not authorized");
    
    await ctx.db.patch(args.postId, { 
      status: "archived",
      archivedAt: Date.now(),
    });
    return null;
  },
});

// Script - DUPLICATES the archive logic!
export const bulkArchiveOldPosts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const oldPosts = await ctx.db
      .query("posts")
      .filter((q) => q.lt(q.field("createdAt"), Date.now() - 365 * 24 * 60 * 60 * 1000))
      .collect();
    
    for (const post of oldPosts) {
      // DUPLICATED LOGIC!
      await ctx.db.patch(post._id, { 
        status: "archived",
        archivedAt: Date.now(),
      });
    }
    return null;
  },
});
```

#### After (Shared Logic) ✅

```typescript
// Shared core logic
async function archivePostCore(
  ctx: MutationCtx, 
  postId: Id<"posts">
): Promise<void> {
  const post = await ctx.db.get(postId);
  if (!post) throw new Error("Post not found");
  
  await ctx.db.patch(postId, { 
    status: "archived",
    archivedAt: Date.now(),
  });
}

// Public API - with auth
export const archivePost = authedMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    const post = await ctx.db.get(args.postId);
    if (post?.authorId !== ctx.user._id) {
      throw new Error("Not authorized");
    }
    
    await archivePostCore(ctx, args.postId);
    return null;
  },
});

// Internal function for scripts
export const archivePostInternal = internalMutation({
  args: { postId: v.id("posts") },
  returns: v.null(),
  handler: async (ctx, args) => {
    await archivePostCore(ctx, args.postId);
    return null;
  },
});

// Script - uses internal function
export const bulkArchiveOldPosts = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const oldPosts = await ctx.db
      .query("posts")
      .filter((q) => q.lt(q.field("createdAt"), Date.now() - 365 * 24 * 60 * 60 * 1000))
      .collect();
    
    for (const post of oldPosts) {
      // Reuse the internal function
      await ctx.runMutation(internal.posts.archivePostInternal, { 
        postId: post._id 
      });
    }
    return null;
  },
});
```

---

## Examples

### Example: Data Migration Script

```typescript
// convex/migrations/addUserTimestamps.ts
import { internalMutation } from "../_generated/server";
import { v } from "convex/values";

export const addCreatedAtToUsers = internalMutation({
  args: { 
    cursor: v.optional(v.string()),
    batchSize: v.optional(v.number()),
  },
  returns: v.object({
    processed: v.number(),
    cursor: v.union(v.string(), v.null()),
    isDone: v.boolean(),
  }),
  handler: async (ctx, args) => {
    const batchSize = args.batchSize ?? 100;
    
    const result = await ctx.db
      .query("users")
      .paginate({ 
        numItems: batchSize, 
        cursor: args.cursor ?? null 
      });
    
    let processed = 0;
    for (const user of result.page) {
      if (user.createdAt === undefined) {
        await ctx.db.patch(user._id, { 
          createdAt: user._creationTime 
        });
        processed++;
      }
    }
    
    return {
      processed,
      cursor: result.continueCursor,
      isDone: result.isDone,
    };
  },
});
```

### Example: Admin Script Using Existing Logic

```typescript
// convex/scripts/adminOperations.ts
import { internalMutation } from "../_generated/server";
import { internal } from "../_generated/api";
import { v } from "convex/values";

/**
 * Admin script to deactivate users by email list
 * Uses existing internal functions instead of duplicating logic
 */
export const deactivateUsersByEmail = internalMutation({
  args: { 
    emails: v.array(v.string()) 
  },
  returns: v.object({
    deactivated: v.number(),
    notFound: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const notFound: string[] = [];
    let deactivated = 0;
    
    for (const email of args.emails) {
      // Use existing internal query
      const user = await ctx.runQuery(
        internal.users.getUserByEmailInternal, 
        { email }
      );
      
      if (!user) {
        notFound.push(email);
        continue;
      }
      
      // Use existing internal mutation
      await ctx.runMutation(internal.users.updateUserInternal, {
        userId: user._id,
        role: "deactivated",
      });
      deactivated++;
    }
    
    return { deactivated, notFound };
  },
});
```

---

## Summary

| Scenario | Approach |
|----------|----------|
| Script/one-off operation | Use `internalMutation`/`internalQuery`/`internalAction` |
| Similar logic in public API and script | Extract core logic to shared helper function |
| Script needs existing functionality | Call existing internal functions via `ctx.runMutation`/`ctx.runQuery` |
| New feature needed by both API and scripts | 1. Create core logic function, 2. Create public wrapper with auth, 3. Create internal wrapper for scripts |

### Quick Checklist

- [ ] Is this a script? → Use `internal*` functions
- [ ] Does similar logic exist elsewhere? → Extract to shared function
- [ ] Am I duplicating auth wrapper code? → Separate auth from business logic
- [ ] Can I reuse existing internal functions? → Compose them instead of rewriting
