# Task List — BetterCodeWiki Hackathon Deployment

## Priority 1: Fix Frontend 500 (BLOCKING)

### Task 1.1: Resolve Clerk Middleware Crash
**Status**: Blocked — needs your input
**Options**:
- **A) Upgrade Clerk** (15 min): `npm install @clerk/nextjs@latest` + rebuild + deploy
- **B) Remove Clerk** (30 min): Strip Clerk from middleware, layout, components + rebuild + deploy
- **C) Provide Clerk keys** (5 min): Add real keys to Cloud Run secrets so Clerk initializes properly

**Question**: Which option do you prefer?

### Task 1.2: Verify Supabase Dependency
**Status**: Needs investigation
- Check if Supabase is required for core features or just analytics/waitlist
- If not critical, can we disable it for hackathon?

**Question**: Is Supabase set up for this project? Do you have the keys?

---

## Priority 2: End-to-End Voice Tutor Testing

### Task 2.1: Test Voice WebSocket Connection
- Open wiki page in browser
- Click mic button
- Verify WebSocket connects to `/ws/voice-tutor`
- Enter Gemini API key in settings panel

### Task 2.2: Test Audio Capture + Playback
- Grant microphone permission
- Speak a question about the codebase
- Verify audio is sent to Gemini Live API
- Verify voice response plays back

### Task 2.3: Test RAG Grounding
- Ask about specific files/functions
- Verify answers reference actual code
- Test tool calls (search_code, get_wiki_page)

### Task 2.4: Test Guided Tour
- Click "Guided Tour" button
- Verify automatic architecture walkthrough starts

---

## Priority 3: Polish & Submission

### Task 3.1: Record Demo Video (4 minutes)
Script from strategy doc:
- 0:00-0:15 — Hook: "What if you could talk to any codebase?"
- 0:15-0:30 — Problem: Onboarding takes weeks
- 0:30-2:00 — Live demo: paste repo, generate wiki, voice conversation
- 2:00-2:30 — Guided Tour mode
- 2:30-3:00 — Architecture + GCP proof
- 3:00-3:30 — Technical depth (ADK, RAG, FAISS)
- 3:30-4:00 — Impact + close

### Task 3.2: GCP Deployment Proof
- Screenshot Cloud Run dashboard showing both services
- Run `gcloud run services list` and capture output
- Show Terraform files in repo

### Task 3.3: Write Blog Post (Bonus)
- Medium or Dev.to post about building with Gemini Live API
- Include #GeminiLiveAgentChallenge hashtag

### Task 3.4: Google Developer Group Signup (Bonus)
- Sign up at developers.google.com/community/gdg
- Include profile link in submission

---

## Priority 4: Nice-to-Have Improvements

### Task 4.1: Diagram Highlighting
- Wire voice tutor events to Mermaid diagram component
- When tutor mentions a component, highlight corresponding node

### Task 4.2: Landing Page Polish
- Verify 3D hero section renders correctly
- Add "Try Voice Tutor" CTA button

### Task 4.3: Multi-Language Voice
- Test voice tutor in non-English languages
- Gemini Live API supports multiple languages natively

---

## Dependency Chain

```
Task 1.1 (Fix Clerk) ──> Task 2.x (Testing) ──> Task 3.1 (Demo Video)
                                                      |
Task 1.2 (Supabase) ──> Deploy ──────────────> Task 3.2 (GCP Proof)
                                                      |
                                               Task 3.3 (Blog Post)
```

## Time Estimates (Approximate)

| Task | Effort | Blocked On |
|------|--------|-----------|
| 1.1 Fix Clerk | 15-30 min | Your decision on approach |
| 1.2 Supabase check | 10 min | Your input on keys |
| 2.1-2.4 Testing | 30 min | Task 1.1 complete |
| 3.1 Demo video | You record it | Tasks 2.x complete |
| 3.2 GCP proof | 5 min | Deployment working |
| 3.3 Blog post | 30 min | Optional |
| 4.1-4.3 Polish | 1-2 hours | Optional |
