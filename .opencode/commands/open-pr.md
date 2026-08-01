---
description: Branch, split staged/unstaged changes into atomic commits, push, and give a pre-filled PR link
argument-hint: [optional branch-name]
allowed-tools: Bash(git:*)
---

Branch name override (if given): $ARGUMENTS

Follow this process. Stop and ask the user if anything is ambiguous — don't guess
on branch naming, commit grouping, or which base branch to target if detection fails.

## Phase 1: Check state

1. Run `git status --porcelain` and `git diff` (and `git diff --cached`) to see
   all changes — staged, unstaged, and explicitly listed untracked paths.
2. For every untracked path, read its contents before staging. Check for secrets
   and confirm it is relevant to the PR before including it in a commit.
3. If there are no changes at all, stop and tell the user there's nothing to open a PR for.
4. Confirm you're not already on the base branch (main/master) with uncommitted
   changes you're about to commit directly to it — if so, branching is mandatory
   before committing anything.

## Phase 2: Create branch

1. Detect the base branch: try `git remote show origin | grep 'HEAD branch'`,
   falling back to `main` then `master` if that fails.
2. If the user gave a branch name in $ARGUMENTS, use it (prefixed `feature/` if
   it has no prefix). Otherwise generate a short kebab-case name from the actual
   diff content (e.g. `fix/password-retry-reset`) — don't use a generic name like
   `update-code`.
3. Stash the working tree (`git stash`), switch to the detected base branch
   (`git checkout <base>`), then create the new branch (`git checkout -b
<branch-name>`). If switching safely is not possible (dirty state, merge
   conflicts), stop and ask the user instead of creating the branch from the
   current position.

## Phase 3: Atomic commits

1. Group the changes by logical concern (one commit per concern — e.g. don't mix
   a bug fix with an unrelated formatting change, don't split one logical change
   across multiple commits).
2. For each group, stage only the relevant files/hunks (`git add <files>` or
   `git add -p` for partial files) and commit with a clear, imperative message
   (e.g. `fix: reset retry counter after password change`).
3. Do not commit anything not already present in the working tree — this command
   never generates new code, only commits what's already changed.

## Phase 4: Push and build PR link

1. Push: `git push -u origin <branch-name>`.
2. Get the remote to build the PR URL:
   `git remote get-url origin` — parse owner/repo whether it's SSH
   (`git@github.com:owner/repo.git`) or HTTPS (`https://github.com/owner/repo.git`) form.
3. Write a PR title (one line) and body (bullet summary of what changed and why,
   based on the commits made) in markdown.
4. URL-encode the title and body with PowerShell:
   `[System.Uri]::EscapeDataString("<text>")`
5. Build and print this link:
   `https://github.com/<owner>/<repo>/compare/<base>...<branch-name>?expand=1&title=<encoded-title>&body=<encoded-body>`

## Phase 5: Report

Give the user:

- The branch name and list of commits made (hash + message).
- The PR link from Phase 4, on its own line, ready to click.
  Do not attempt to merge, approve, or otherwise act on the PR — the user reviews
  and merges manually.
