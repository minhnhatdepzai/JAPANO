# dashboard-design-skill

Agent-agnostic skill that teaches any AI assistant how to design effective dashboards. Combines a decision-first 8-step design process with implementation-level UI quality rules (based on [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines)).

## What's in here

**`SKILL.md`** — a standalone markdown document covering the full dashboard design lifecycle: understanding the audience, exploring data relationships, establishing semantic design systems, navigation patterns, data quality transparency, and a code-level implementation checklist for accessibility, performance, and correctness.

No YAML frontmatter required by consumers, no tool-specific config, no plugin APIs. Just plain markdown that any AI tool can consume.

## Core Philosophy

A dashboard exists to help someone make a decision. Every element earns its place by answering a business question or it gets removed.

**The 8-step process:**

1. **Understand the ask** — Who is the audience? What decisions will they make?
2. **Know the data** — What can the data tell you when combined?
3. **Visual design system** — Semantic colors (blue = revenue everywhere), consistent spacing
4. **Navigation** — Home, back, reset filters, info/help on every page
5. **Overview landing page** — KPI cards, navigation, 10-second executive glance
6. **Page purpose** — Each page answers a specific business question
7. **Never lose the audience** — Dynamic titles, smart narratives, reset affordances
8. **Data quality** — Quality score on every page, dedicated quality page, transparent estimates

## Usage

Include `SKILL.md` in your AI agent's context. How you do that depends on the tool:

### Claude Code

Add to your project's `.claude/CLAUDE.md`:

```markdown
@dashboard-design-skill/SKILL.md
```

Or install as a skill:

```bash
# Clone into your skills directory
git clone https://github.com/mares29/dashboard-design-skill.git ~/.claude/skills/dashboard-design
```

### Cursor

Add `SKILL.md` to your project's `.cursor/rules/` directory, or reference it in `.cursorrules`.

### GitHub Copilot

Add `SKILL.md` to your repository's `.github/copilot-instructions.md` or reference it in your prompt context.

### Other agents

Copy `SKILL.md` into whatever context mechanism your AI tool supports — system prompts, knowledge bases, or project instructions.

## What this skill changes

Without this skill, AI agents typically:
- Design pages by data domain ("Sales", "Customers") instead of business questions
- Skip data exploration and jump straight to visuals
- Build color palettes without semantic meaning
- Put smart narratives only on the overview page
- Ignore data quality entirely

With this skill, agents follow a structured process that produces decision-enabling dashboards with data quality transparency.

## Links

- [Web Interface Guidelines](https://github.com/vercel-labs/web-interface-guidelines) — implementation rules source
