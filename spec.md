# Product Specification — Live Code Tutor (BetterCodeWiki)

## Vision
Voice-powered AI tutor that lets users talk to any GitHub repository. Built on BetterCodeWiki's existing wiki platform with Gemini Live API for real-time voice interaction.

## Target Users
- Developers onboarding to new codebases
- Tech leads reviewing unfamiliar repositories
- Students learning from open-source projects

## Core Features

### 1. Voice Tutoring (NEW - Hackathon)
- [ ] Real-time voice conversation about any repo via Gemini Live API
- [ ] RAG-grounded answers using existing FAISS pipeline
- [ ] ADK agent with 4 tools: search_code, get_wiki_page, explain_component, list_files
- [ ] Floating mic button on wiki pages
- [ ] Audio visualizer + transcript panel
- [ ] Guided Tour mode (automatic architecture walkthrough)
- [ ] BYOK: user provides own Gemini API key

### 2. Wiki Generation (EXISTING)
- [ ] Auto-generate interactive wiki from any GitHub/GitLab/Bitbucket repo
- [ ] Mermaid diagrams for architecture visualization
- [ ] Multi-provider AI (Gemini, OpenAI, OpenRouter, Ollama, Bedrock, Azure)
- [ ] RAG-powered chat (Ask feature)
- [ ] Code Explorer with file tree
- [ ] Export to PDF, JSON, XML, Markdown
- [ ] 10-language i18n support

### 3. Presentation Modes (EXISTING)
- [ ] Slides mode for repo presentations
- [ ] Workshop mode for interactive learning
- [ ] 3D dependency graph visualization

## Tech Stack
| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 15, React 19, Tailwind CSS 4, Three.js, GSAP |
| Backend | FastAPI, Python 3.11, Poetry |
| AI | Gemini Live API, Gemini 2.5 Flash, OpenAI, multi-provider |
| RAG | FAISS + adalflow, Gemini/OpenAI embeddings |
| Auth | Clerk (optional) |
| Storage | Local filesystem / Google Cloud Storage |
| Deploy | Cloud Run, Artifact Registry, Terraform |
| CI/CD | GitHub Actions, Workload Identity Federation |

## Authentication
- **Clerk** integration (optional — app works without it)
- Wiki auth code gate (optional password protection)
- BYOK model for AI API keys

## Deployment Architecture
```
gitunderstand.com
  |
  +-- gitunderstand-web (Next.js frontend, port 3000)
  +-- gitunderstand-api (FastAPI backend, port 8001)
  +-- MCP server (port 8008)
```

---

## QUESTIONS FOR YOU (Shantanu)

### Product Direction
1. **Is the hackathon deadline actually passed (March 16)?** Or is there still time to submit? This affects what we prioritize.
2. **What is the primary goal now?** (a) Submit to hackathon ASAP, (b) Get gitunderstand.com fully working, or (c) Both?
3. **Do you want the voice tutor on every wiki page**, or only on specific pages?
4. **Should voice tutor work without wiki generation?** (e.g., user pastes a repo URL and can immediately talk to it without waiting for full wiki)

### Authentication (Clerk Issue)
5. **Do you have a Clerk account/dashboard?** We need `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY` to fix the 500 error.
6. **Do you want to keep Clerk auth?** Or should we remove it entirely for the hackathon? (Removing it would fix the 500 immediately)
7. **If keeping Clerk**: Do you have the keys from https://dashboard.clerk.com?

### Infrastructure
8. **Is `gitunderstand.com` the domain you want for the hackathon submission?**
9. **Do you have billing enabled on the `gitunderstand` GCP project?** (Cloud Run free tier should cover it, but need billing account linked)
10. **Supabase**: The app references Supabase env vars. Is Supabase set up? Or can we remove that dependency?

### Features Priority
11. **3D Landing page**: The current landing page has Three.js. Is it working as you want, or does it need changes?
12. **Diagram highlighting**: Should the voice tutor highlight Mermaid nodes when explaining components?
13. **Multi-language voice**: Should the tutor support non-English languages?
14. **Demo video**: Do you need help scripting/planning the 4-minute demo video?
