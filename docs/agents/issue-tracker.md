# Issue tracker: Jira

Issues and specs for this repo live in Jira, project **DOW** ("Dawn of War Dev team") on the `vital-stats.atlassian.net` Atlassian site. Board: https://vital-stats.atlassian.net/jira/software/projects/DOW/boards/36

Use the Atlassian MCP tools for all operations. `cloudId` for every call is `vital-stats.atlassian.net` (or the resolved cloud UUID `e8547745-6a80-4b0b-932a-59730a0ae175`).

## Board workflow

Modeled on the sibling **VS** (Vital Stats) project's workflow, so both projects move tickets the same way. Board columns: **To Do → In Progress → In Review → Done**, plus **Blocked**.

- **Every change worth tracking gets a Jira issue** — even a quick one-off ask, not just planned work.
- **Transition an issue to In Progress before starting work on it** (planning, implementation, anything beyond filing it) — not after, not as a batch cleanup later.
- Keep the status matched to where the work actually stands:
  - **To Do** — filed, not started.
  - **In Progress** — actively investigating/implementing, or self-tested but not yet confirmed correct. Stay here even after the fix is implemented — being confident in a fix isn't the same as it being confirmed.
  - **In Review** — code is up for review (e.g. an open PR) rather than mid-implementation.
  - **Done** — only after the fix/feature is confirmed correct AND the code is committed AND pushed to `origin/main`. Don't jump to Done off of self-testing alone.
  - **Blocked** — can't proceed (missing input, external dependency, waiting on a decision).
- Keep status in sync as work moves — don't leave a ticket stale in the wrong column.

## Commit message format

Every commit tied to a ticket starts with the Jira issue key in brackets, followed by one of these prefixes:

- `[DOW-##] Add: ` — new files, features, or capabilities
- `[DOW-##] Update: ` — changes to existing behavior/code
- `[DOW-##] Fix: ` — bug fixes
- `[DOW-##] Delete: ` — removing code, files, or features

Example: `[DOW-1] Fix: item picker popover no longer covers Situational Items/Notes`

## Conventions

- **Create an issue**: `createJiraIssue` with `projectKey: "DOW"`. Issue types available: `Feature`, `Bug`, `Subtask`.
- **Read an issue**: `getJiraIssue` with the issue key (e.g. `DOW-123`), including comments via the `fields` param.
- **List / search issues**: `searchJiraIssuesUsingJql` with a JQL query, e.g. `project = DOW AND status != Done ORDER BY created DESC`.
- **Comment on an issue**: `addCommentToJiraIssue`.
- **Transition status**: `getTransitionsForJiraIssue` to see valid transitions, then `transitionJiraIssue`.
- **Edit fields (labels, etc.)**: `editJiraIssue`.

## When a skill says "publish to the issue tracker"

Create a Jira issue in project DOW via `createJiraIssue`.

## When a skill says "fetch the relevant ticket"

Run `getJiraIssue` with the ticket's key (e.g. `DOW-42`). If only a bare number is given, prefix it with `DOW-`.

## Notes

- Jira issue keys (`DOW-<n>`) are the canonical reference — use them in commit messages and branch names where practical (e.g. `DOW-42-add-hero-picker`) so Jira's smart commits can link work automatically.
- No GitHub/GitLab PR-as-triage-surface convention applies here; Jira has no equivalent flag.
