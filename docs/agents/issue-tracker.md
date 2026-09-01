# Issue tracker: Jira

Issues and specs for this repo live in Jira, project **DOW** ("Dawn of War Dev team") on the `vital-stats.atlassian.net` Atlassian site. Board: https://vital-stats.atlassian.net/jira/software/projects/DOW/boards/36

Use the Atlassian MCP tools for all operations. `cloudId` for every call is `vital-stats.atlassian.net` (or the resolved cloud UUID `e8547745-6a80-4b0b-932a-59730a0ae175`).

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
