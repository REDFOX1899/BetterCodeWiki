# Live Code Tutor (BetterCodeWiki)

**Category:** Live Agents

## Summary

Live Code Tutor is a voice-powered AI tutor that explains any GitHub repository through natural, real-time conversation. It ingests a repository, builds a semantic index of the codebase, and uses RAG-grounded retrieval to answer spoken questions with accurate, hallucination-resistant responses. The tutor can generate interactive architecture diagrams, walk users through codebases with a guided tour mode, and produce structured documentation in multiple formats.

## Problem

Onboarding to new codebases takes weeks. Developers spend significant time reading through unfamiliar code, piecing together architecture from scattered and often outdated documentation. Existing documentation tools produce static output that becomes stale the moment the code changes, and they lack the ability to answer follow-up questions or adapt explanations to the reader's level of understanding.

## Solution

A voice-powered AI tutor that can explain any GitHub repository through natural conversation, grounded in actual code via RAG. Users paste a GitHub URL, ingest the repository, and immediately begin a voice conversation with an AI agent that has deep, retrieval-augmented understanding of the codebase. The agent dynamically fetches relevant code snippets, generates architecture diagrams, and provides guided walkthroughs -- all through spoken interaction.

## Tech Stack

- **Voice Interface:** Gemini Live API (gemini-2.0-flash-live-001) for bidirectional audio streaming
- **Agent Framework:** Google ADK agent with function calling (4 tools: search_codebase, get_file_content, get_repository_structure, get_repository_summary)
- **RAG Pipeline:** FAISS vector store with Gemini text-embedding-004 for semantic code search with normalized embeddings
- **Backend:** FastAPI (async) deployed on Google Cloud Run
- **Infrastructure:** Terraform IaC for automated GCP deployment (Cloud Run, Artifact Registry, Cloud Build)
- **Frontend:** Next.js + Three.js + Mermaid.js for interactive wikis and 3D visualizations
- **Diagrams:** Mermaid.js for interactive architecture visualization

## Key Features

- **Real-time voice conversations** about any GitHub repository using Gemini Live API bidirectional streaming
- **RAG-grounded answers** that prevent hallucination by retrieving actual code snippets from a FAISS vector index before generating responses
- **Interactive Mermaid diagrams** with voice-triggered node highlighting, allowing users to explore architecture visually while talking
- **Guided Tour mode** for automatic architecture walkthroughs that systematically explain a repository's structure and design patterns
- **Multi-format output** supporting text, JSON, Markdown, and XML digest formats optimized for different LLM context windows
- **BYOK model** where users provide their own Gemini API key, eliminating server-side API cost concerns

## Modalities

- **Voice:** Audio input and output via Gemini Live API bidirectional streaming
- **Visual:** Interactive Mermaid architecture diagrams with clickable nodes and voice-triggered highlighting
- **Code:** Syntax-highlighted code snippets retrieved via RAG and displayed alongside voice explanations
- **Wiki:** Structured documentation output in multiple formats (Markdown, JSON, XML, plain text)

## GCP Services

- **Cloud Run:** Hosts the FastAPI backend with auto-scaling
- **Artifact Registry:** Stores Docker container images
- **Cloud Build:** Builds container images as part of the CI/CD pipeline

## Deployment

- **Live URL (Web):** https://gitunderstand-web-308289525742.us-central1.run.app
- **Live URL (API):** https://gitunderstand-api-308289525742.us-central1.run.app
- **GitHub:** https://github.com/REDFOX1899/BetterCodeWiki

## Findings and Learnings

- **Gemini Live API bidirectional streaming** enables a natural conversation feel that is qualitatively different from turn-based voice interactions. The ability to interrupt and receive real-time responses makes code exploration feel like pair programming with a knowledgeable colleague.
- **RAG grounding is essential** for code tutoring accuracy. Without retrieval-augmented generation, the model frequently hallucinated file names, function signatures, and architectural details. Grounding every response in actual retrieved code snippets dramatically improved factual accuracy.
- **FAISS with normalized embeddings** provides fast semantic search over code chunks. L2 distance on normalized vectors is equivalent to cosine similarity, giving accurate semantic matching with minimal computational overhead even on large repositories.
- **ADK function calling** allows the tutor to dynamically retrieve relevant code during conversation. The agent autonomously decides when to search the codebase, fetch specific files, or retrieve the repository structure, creating a fluid experience where the user does not need to manually navigate code.
