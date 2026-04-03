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
    system: `You are an expert prompt engineer and software architect. You produce a single, complete, self-contained prompt that someone can copy-paste directly into an AI assistant to rebuild a project from scratch. Your output must be ONE continuous prompt with no separate sections, no meta-commentary, no "here is your prompt" preamble, and no closing remarks. Just the prompt itself, start to finish.`,
    user: `Based on the following repository analysis, generate a single, unified "rebuild from scratch" prompt.

**Repository:** ${ctx.owner}/${ctx.repo}
**Summary:**
${summary}

**File Structure:**
\`\`\`
${ctx.fileTree}
\`\`\`

CRITICAL INSTRUCTIONS FOR YOUR OUTPUT:
- Output ONLY the prompt itself. Do not wrap it in quotes or code blocks.
- Do NOT start with "Here is..." or "Below is..." or any preamble. Start directly with the instruction to the AI.
- Do NOT end with "Let me know..." or any closing commentary.
- The entire output should be ONE single continuous prompt that covers: project setup, dependencies, directory structure, configuration files, all core modules (in build order), data models, API/routing, business logic, styling/UI, and build/deployment.
- Be extremely specific: name exact packages with versions where possible, reference actual file paths from the repo structure, and describe the real architecture.
- The prompt should flow as one cohesive instruction document, not as disconnected numbered sections.
- Use markdown formatting within the prompt for readability.`,
  }
}

/** Action B, Option 2: Recommend improvements */
export function buildImprovementsPrompt(
  ctx: RepoContext,
  summary: string,
): { system: string; user: string } {
  return {
    system: `You are a senior software consultant performing a technical review. Provide a single, complete analysis document with all recommendations in one response. Do not split your answer into multiple parts or say "continued in part 2". Deliver everything in one go.`,
    user: `Based on the following repository analysis, suggest meaningful improvements. Deliver ALL recommendations in a single, complete response.

**Repository:** ${ctx.owner}/${ctx.repo}
**Summary:**
${summary}

**File Structure:**
\`\`\`
${ctx.fileTree}
\`\`\`

Cover these areas in one unified document:
- Missing features the project should add
- Architecture improvements for better maintainability
- Performance optimizations for specific bottlenecks
- Security enhancements and best practices not yet followed
- Developer experience improvements (tooling, docs, testing)
- Scalability considerations (what breaks at 10x or 100x)

For each recommendation, explain what to change, why it matters, and rate priority (High / Medium / Low). Aim for 6-10 recommendations. Use markdown formatting. Output everything in one complete response.`,
  }
}
