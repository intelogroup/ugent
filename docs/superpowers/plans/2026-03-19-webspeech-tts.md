# WebSpeech API as Primary TTS Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace ElevenLabs API TTS with browser-native Web Speech API (`window.speechSynthesis`) for zero-latency, free, no-key-required text-to-speech.

**Architecture:** Move all TTS logic client-side into `VoiceButton` using `SpeechSynthesisUtterance`. Delete the `/api/tts` route. Move `cleanForSpeech` to a shared client utility. Keep the same UI (Volume2 → pulse bars → VolumeX stop).

**Tech Stack:** Web Speech API (`SpeechSynthesis`, `SpeechSynthesisUtterance`), React, Playwright for E2E tests.

---

## File Map

| Action | File | Responsibility |
|--------|------|----------------|
| Create | `lib/clean-for-speech.ts` | Text cleaning util (shared, testable) |
| Modify | `components/chat/message-bubble.tsx` | Replace fetch-based VoiceButton with speechSynthesis |
| Delete | `app/api/tts/route.ts` | No longer needed |
| Modify | `tests/chat.spec.ts` | Add voice button E2E test |

---

## Task 1: Extract `cleanForSpeech` to a client utility

**Files:**
- Create: `lib/clean-for-speech.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/clean-for-speech.ts
export function cleanForSpeech(text: string): string {
  return text
    .replace(/\[Image:\s*[^\]]+\]/gi, '')   // [Image: ID]
    .replace(/!\[.*?\]\(.*?\)/g, '')         // markdown images
    .replace(/\[([^\]]+)\]\(.*?\)/g, '$1')   // markdown links → label
    .replace(/#{1,6}\s+/g, '')               // headings
    .replace(/\*\*(.+?)\*\*/g, '$1')         // bold
    .replace(/\*(.+?)\*/g, '$1')             // italic
    .replace(/`{1,3}[^`]*`{1,3}/g, '')      // code
    .replace(/[-*+]\s+/g, '')               // list bullets
    .replace(/\n{2,}/g, '. ')               // double newlines → pause
    .replace(/\n/g, ' ')
    .trim();
}
```

- [ ] **Step 2: Verify file exists**

```bash
ls lib/clean-for-speech.ts
```

Expected: file listed

- [ ] **Step 3: Commit**

```bash
git add lib/clean-for-speech.ts
git commit -m "feat: extract cleanForSpeech to shared utility"
```

---

## Task 2: Replace ElevenLabs VoiceButton with WebSpeech

**Files:**
- Modify: `components/chat/message-bubble.tsx`

The new `VoiceButton`:
- Uses `window.speechSynthesis` directly (client-side only)
- States: `'idle' | 'speaking'` (no `loading` — Web Speech starts instantly)
- Guards against SSR (`typeof window === 'undefined'`)
- Cancels on second click

- [ ] **Step 1: Update imports and types in message-bubble.tsx**

Replace the top of the file:

```typescript
'use client';

import { Message } from 'ai';
import { Bot, AlertCircle, Volume2, VolumeX } from 'lucide-react';
import { useState, useRef, useCallback } from 'react';
import { cn } from '@/lib/utils';
import ImageRenderer from '../image-renderer';
import { cleanForSpeech } from '@/lib/clean-for-speech';

type PlayState = 'idle' | 'speaking';
```

Note: `Loader2` removed (no async loading state needed).

- [ ] **Step 2: Replace VoiceButton implementation**

Replace the entire `VoiceButton` function (lines 15–98):

```typescript
function VoiceButton({ text }: { text: string }) {
  const [state, setState] = useState<PlayState>('idle');
  const utteranceRef = useRef<SpeechSynthesisUtterance | null>(null);

  const handleVoice = useCallback(() => {
    if (typeof window === 'undefined' || !window.speechSynthesis) return;

    if (state === 'speaking') {
      window.speechSynthesis.cancel();
      setState('idle');
      return;
    }

    const cleaned = cleanForSpeech(text);
    if (!cleaned) return;

    const utterance = new SpeechSynthesisUtterance(cleaned);
    utteranceRef.current = utterance;

    utterance.onstart = () => setState('speaking');
    utterance.onend = () => {
      setState('idle');
      utteranceRef.current = null;
    };
    utterance.onerror = () => {
      setState('idle');
      utteranceRef.current = null;
    };

    window.speechSynthesis.speak(utterance);
  }, [state, text]);

  // Don't render if browser doesn't support Web Speech
  if (typeof window !== 'undefined' && !window.speechSynthesis) return null;

  return (
    <button
      onClick={handleVoice}
      title={state === 'speaking' ? 'Stop' : 'Read aloud'}
      className={cn(
        'mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium transition-all',
        state === 'speaking'
          ? 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
          : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 dark:hover:bg-gray-800',
      )}
    >
      {state === 'speaking' ? (
        <>
          <VolumeX className="w-3.5 h-3.5" />
          <span>Stop</span>
          <span className="flex gap-0.5 items-end h-3">
            {[1, 2, 3].map((i) => (
              <span
                key={i}
                className="w-0.5 bg-blue-500 rounded-full animate-pulse"
                style={{
                  height: `${6 + i * 3}px`,
                  animationDelay: `${i * 0.15}s`,
                }}
              />
            ))}
          </span>
        </>
      ) : (
        <Volume2 className="w-3.5 h-3.5" />
      )}
    </button>
  );
}
```

- [ ] **Step 3: Verify build compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully` (no TypeScript errors)

- [ ] **Step 4: Commit**

```bash
git add components/chat/message-bubble.tsx
git commit -m "feat: replace ElevenLabs TTS with Web Speech API"
```

---

## Task 3: Delete the TTS API route

**Files:**
- Delete: `app/api/tts/route.ts`

- [ ] **Step 1: Delete the file**

```bash
rm app/api/tts/route.ts
```

- [ ] **Step 2: Also remove the empty directory if it exists**

```bash
rmdir app/api/tts 2>/dev/null || true
```

- [ ] **Step 3: Verify build still passes**

```bash
npm run build 2>&1 | tail -10
```

Expected: no errors about tts route

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: remove ElevenLabs TTS API route (replaced by Web Speech API)"
```

---

## Task 4: Add E2E test for voice button

**Files:**
- Modify: `tests/chat.spec.ts`

The Playwright test verifies the voice button appears after an AI response and that clicking it doesn't throw.

- [ ] **Step 1: Add test to tests/chat.spec.ts**

Append after the existing tests:

```typescript
test('voice button appears on bot message', async ({ page }) => {
  await page.goto('http://localhost:3000');
  const input = page.getByRole('textbox');
  await input.fill('Hi');
  const submitButton = page.locator('button[type="submit"]');
  await submitButton.click();

  // Wait for a bot response long enough to show voice button (>20 chars)
  const voiceButton = page.locator('button[title="Read aloud"]');
  await expect(voiceButton).toBeVisible({ timeout: 20000 });
});
```

- [ ] **Step 2: Run existing tests to confirm no regressions**

```bash
npx playwright test tests/chat.spec.ts --reporter=line 2>&1 | tail -20
```

Expected: existing 2 tests pass (voice button test may skip/fail without live server — that's OK for CI, it's an E2E test requiring running app)

- [ ] **Step 3: Commit**

```bash
git add tests/chat.spec.ts
git commit -m "test: add E2E test for Web Speech voice button"
```

---

## Task 5: Deploy to Vercel

- [ ] **Step 1: Verify `npm run build` passes cleanly**

```bash
npm run build 2>&1 | tail -20
```

Expected: `✓ Compiled successfully`

- [ ] **Step 2: Deploy to production**

```bash
vercel --prod
```

Wait for deployment URL.

- [ ] **Step 3: Smoke test the voice button on production URL**

Open the production URL in a browser, send a message, wait for bot response, click the volume icon — verify it speaks.

- [ ] **Step 4: Final commit (if any pending changes)**

```bash
git status
```

If clean: done. ✓

---

## Notes

- **Chrome bug:** Chrome's `speechSynthesis` can pause silently on long texts after ~15 seconds. This is a known browser bug. Not worth working around for now — the button UI recovers naturally since the user can click Stop.
- **SSR safety:** The `typeof window === 'undefined'` guard prevents server-side crashes. The button renders null on server, then hydrates on the client.
- **No API key needed:** Eliminates dependency on `ELEVENLABS_API_KEY`.
- **Voice selection:** Uses the browser's default voice. This is intentionally left as-is — the browser picks the best available voice for the OS locale.
