/**
 * Prompt templates for all LLM actions.
 * Each function takes structured repo data and returns a system + user message pair.
 */

export interface RepoContext {
  owner: string
  repo: string
  description: string | null
  language: string | null
  topics: string[]
  fileTree: string // formatted file listing
  readmeSnippet?: string // first ~2000 chars of README if available
}

/** Action A: Generate a high-level repository summary */
export function buildSummaryPrompt(ctx: RepoContext): { system: string; user: string } {
  return {
    system: `You are a senior software architect. Analyze GitHub repositories and produce concise, insightful summaries. Be specific about technologies, patterns, and architecture. Use markdown formatting.`,
    user: `Analyze this GitHub repository and provide a concise architectural summary.

**Repository:** ${ctx.owner}/${ctx.repo}
**Primary Language:** ${ctx.language ?? 'Unknown'}
**Description:** ${ctx.description ?? 'No description provided'}
**Topics:** ${ctx.topics.length > 0 ? ctx.topics.join(', ') : 'None'}

**File Structure:**
\`\`\`
${ctx.fileTree}
\`\`\`
${ctx.readmeSnippet ? `\n**README (excerpt):**\n${ctx.readmeSnippet}\n` : ''}
Please provide:
1. **Purpose** — What does this project do? (2-3 sentences)
2. **Tech Stack** — Languages, frameworks, and key libraries
3. **Architecture** — How is the code organized? What patterns are used?
4. **Key Components** — The most important files/modules and what they do

Keep it under 400 words. Be specific, not generic.`,
  }
}

/** Action B, Option 1: Generate a step-by-step reverse-engineering prompt */
export function buildReversePromptPrompt(
  ctx: RepoContext,
  summary: string,
): { system: string; user: string } {
  return {
    system: `You are an expert prompt engineer and software architect. Your job is to produce a detailed, step-by-step meta-prompt that another developer (or AI) could follow to rebuild an entire project from scratch. The prompt should be self-contained and actionable.`,
    user: `Based on the following repository analysis, generate a comprehensive "rebuild from scratch" prompt.

**Repository:** ${ctx.owner}/${ctx.repo}
**Summary:**
${summary}

**File Structure:**
\`\`\`
${ctx.fileTree}
\`\`\`

Generate a detailed, numbered step-by-step prompt that covers:
1. **Project initialization** — Exact commands to set up the project, install dependencies
2. **Architecture setup** — Directory structure, configuration files
3. **Core implementation** — Key modules to build, in dependency order
4. **Data models & types** — Important interfaces, schemas, database models
5. **API / routing layer** — Endpoints, pages, or CLI commands
6. **Business logic** — The critical algorithms or workflows
7. **Styling & UI** — Frontend approach if applicable
8. **Testing strategy** — What to test and how
9. **Build & deployment** — Build configuration, CI/CD considerations

The output should be a single prompt that someone could paste into an AI assistant to rebuild this project. Use markdown formatting. Be specific about technologies and file names — not vague or generic.`,
  }
}

/** Action B, Option 2: Recommend improvements */
export function buildImprovementsPrompt(
  ctx: RepoContext,
  summary: string,
): { system: string; user: string } {
  return {
    system: `You are a senior software consultant performing a technical review. Provide actionable, prioritized recommendations. Focus on real improvements, not nitpicks.`,
    user: `Based on the following repository analysis, suggest meaningful improvements.

**Repository:** ${ctx.owner}/${ctx.repo}
**Summary:**
${summary}

**File Structure:**
\`\`\`
${ctx.fileTree}
\`\`\`

Provide recommendations in these categories:

1. **Missing Features** — Important functionality the project should add
2. **Architecture Improvements** — Structural changes for better maintainability
3. **Performance Optimizations** — Specific bottlenecks or inefficiencies to address
4. **Security Enhancements** — Vulnerabilities or best practices not yet followed
5. **Developer Experience** — Tooling, documentation, or testing improvements
6. **Scalability Considerations** — What would break at 10x or 100x scale

For each recommendation:
- Explain **what** to change and **why**
- Rate priority as 🔴 High, 🟡 Medium, or 🟢 Low
- Keep it actionable — a developer should know exactly what to do

Aim for 6-10 recommendations total. Use markdown formatting.`,
  }
}
