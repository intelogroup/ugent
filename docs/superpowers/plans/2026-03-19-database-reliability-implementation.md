# Database Reliability Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ensure the application reliably reaches the vector database and reports failures instead of masking them.

**Architecture:** Implement custom error classes (`DatabaseError`, `EmbeddingError`) to distinguish between "no results found" and "connectivity failure". Update the RAG flow to throw and handle these errors.

**Tech Stack:** TypeScript, Next.js, Pinecone, OpenAI, AI SDK.

---

### Task 1: Create Custom Error Classes

**Files:**
- Create: `lib/errors.ts`

- [ ] **Step 1: Write the custom error classes**

```typescript
export class BaseError extends Error {
  public readonly code: string;
  public readonly status: number;

  constructor(message: string, code: string = 'INTERNAL_ERROR', status: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.code = code;
    this.status = status;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export class DatabaseError extends BaseError {
  constructor(message: string = 'Failed to connect to the vector database', code: string = 'DATABASE_ERROR') {
    super(message, code, 503);
  }
}

export class EmbeddingError extends BaseError {
  constructor(message: string = 'Failed to generate text embedding', code: string = 'EMBEDDING_ERROR') {
    super(message, code, 500);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/errors.ts
git commit -m "feat: add custom error classes for database and embedding failures"
```

---

### Task 2: Update OpenAI Wrapper to Throw EmbeddingError

**Files:**
- Modify: `lib/openai.ts`

- [ ] **Step 1: Import EmbeddingError and throw it on failure**

```typescript
import { EmbeddingError } from './errors';
// ...
export async function getEmbedding(text: string): Promise<number[]> {
  try {
    // ...
  } catch (error: any) {
    console.error('Error generating embedding:', error);
    throw new EmbeddingError(error.message);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/openai.ts
git commit -m "feat: throw EmbeddingError in getEmbedding"
```

---

### Task 3: Update Pinecone Wrapper to Throw DatabaseError

**Files:**
- Modify: `lib/pinecone.ts`

- [ ] **Step 1: Import DatabaseError and throw it on failure**

```typescript
import { DatabaseError } from './errors';
// ...
export async function getContext(...) {
  try {
    // ...
  } catch (error: any) {
    console.error('Error retrieving context from Pinecone:', error);
    // DO NOT return [] anymore, throw DatabaseError
    throw new DatabaseError(error.message);
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add lib/pinecone.ts
git commit -m "feat: throw DatabaseError in getContext"
```

---

### Task 4: Update API Route to Handle Database Errors

**Files:**
- Modify: `app/api/chat/route.ts`

- [ ] **Step 1: Catch DatabaseError and EmbeddingError**

```typescript
import { DatabaseError, EmbeddingError } from '@/lib/errors';
// ...
export async function POST(req: Request) {
  try {
    // ...
    let context = [];
    let dbError = false;
    
    try {
      context = await getContext(userQuery);
    } catch (error) {
      console.error('Context retrieval failed:', error);
      dbError = true;
    }

    const data = new StreamData();
    data.append({ 
      context_found: context.length > 0,
      db_error: dbError 
    });
    
    // Adjust system prompt if dbError is true
    const errorPrefix = dbError 
      ? "IMPORTANT: The textbook database is currently unavailable. " 
      : "";
    
    // ...
  } catch (error) {
    // ...
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/chat/route.ts
git commit -m "feat: handle database errors in chat API route"
```

---

### Task 5: Verification Script

**Files:**
- Create: `scripts/verify-db-reliability.ts`

- [ ] **Step 1: Write a script that tests both success and failure cases (if possible via env override)**

```typescript
import dotenv from 'dotenv';
import { getContext } from '../lib/pinecone';

dotenv.config({ path: '.env.production' });

async function verify() {
  console.log('--- Verification: Database Reliability ---');
  
  try {
    console.log('Case 1: Valid Query');
    const results = await getContext('Nephritic syndrome');
    console.log('SUCCESS: Retrieved results:', results.length);
  } catch (error) {
    console.log('FAILED: Unexpected error:', error);
  }

  // To test failure, we could temporarily unset PINECONE_API_KEY if we want to be thorough
}

verify();
```

- [ ] **Step 2: Run verification**

```bash
npx ts-node scripts/verify-db-reliability.ts
```

- [ ] **Step 3: Commit**

```bash
git add scripts/verify-db-reliability.ts
git commit -m "test: add database reliability verification script"
```
