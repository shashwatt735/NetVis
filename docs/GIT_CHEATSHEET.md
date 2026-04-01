# Git Cheatsheet for NetVis

**Quick reference for daily Git commands**

---

## Daily Workflow

### Start New Task
```bash
git checkout develop
git pull
git checkout -b feature/task-13-zustand-store
```

### Work and Commit
```bash
# Make changes...
git add .
git commit -m "feat(renderer): implement Zustand store"

# More changes...
git commit -m "test(renderer): add store tests"
```

### Push and Create PR
```bash
git push -u origin feature/task-13-zustand-store
# Go to GitHub and create PR: feature/task-13 → develop
```

### After Merge
```bash
git checkout develop
git pull
git branch -d feature/task-13-zustand-store
```

---

## Common Commands

### Branch Management
```bash
# List branches
git branch                    # Local branches
git branch -r                 # Remote branches
git branch -a                 # All branches

# Create branch
git checkout -b feature/task-13-zustand-store

# Switch branch
git checkout develop

# Delete branch
git branch -d feature/task-13  # Safe delete (merged only)
git branch -D feature/task-13  # Force delete
```

### Committing
```bash
# Stage changes
git add .                     # All changes
git add src/main/            # Specific directory
git add file.ts              # Specific file

# Commit
git commit -m "feat: add feature"
git commit -m "fix: resolve bug"
git commit -m "docs: update README"

# Amend last commit
git commit --amend -m "feat: updated message"
```

### Syncing
```bash
# Pull latest
git pull                      # Current branch
git pull origin develop       # Specific branch

# Push
git push                      # Current branch
git push origin feature/task-13  # Specific branch
git push -u origin feature/task-13  # Set upstream
```

### Viewing History
```bash
# Log
git log                       # Full log
git log --oneline            # Compact log
git log --graph --oneline    # Visual graph

# Status
git status                    # Current changes
git diff                      # Unstaged changes
git diff --staged            # Staged changes
```

---

## Commit Message Templates

### Feature
```bash
git commit -m "feat(scope): add new feature

- Implement X
- Add Y
- Update Z

Closes #123"
```

### Bug Fix
```bash
git commit -m "fix(scope): resolve issue with X

- Fix Y
- Update Z

Fixes #456"
```

### Documentation
```bash
git commit -m "docs: update architecture documentation"
```

### Test
```bash
git commit -m "test(anonymizer): add property test for payload pseudonym"
```

### Checkpoint
```bash
git commit -m "chore: complete Phase 1 checkpoint

- All 86 tests passing
- Tasks 1-11 complete
- Documentation updated"
```

---

## Undo Commands

### Undo Uncommitted Changes
```bash
# Discard changes in file
git checkout -- file.ts

# Discard all changes
git reset --hard HEAD
```

### Undo Last Commit (Keep Changes)
```bash
git reset --soft HEAD~1
```

### Undo Last Commit (Discard Changes)
```bash
git reset --hard HEAD~1
```

### Revert Commit (Create New Commit)
```bash
git revert <commit-hash>
```

---

## Merge Commands

### Merge develop into feature (Update Feature Branch)
```bash
git checkout feature/task-13
git merge develop
```

### Merge feature into develop (After PR)
```bash
# Usually done on GitHub with "Squash and merge"
# Or manually:
git checkout develop
git merge --squash feature/task-13
git commit -m "feat(renderer): implement Zustand store (Task 13)"
```

### Merge develop into main (Checkpoint)
```bash
git checkout main
git merge develop --no-ff -m "chore: merge Phase 1 complete"
```

---

## Tagging

### Create Tag
```bash
git tag -a v0.1.0-phase1 -m "Phase 1: Core pipeline complete"
```

### List Tags
```bash
git tag
```

### Push Tags
```bash
git push origin --tags
```

### Delete Tag
```bash
git tag -d v0.1.0-phase1           # Local
git push origin :refs/tags/v0.1.0-phase1  # Remote
```

---

## Stashing (Save Work Temporarily)

### Save Work
```bash
git stash                         # Save all changes
git stash save "WIP: task 13"    # Save with message
```

### List Stashes
```bash
git stash list
```

### Apply Stash
```bash
git stash apply                   # Apply latest
git stash apply stash@{0}        # Apply specific
git stash pop                     # Apply and remove
```

### Delete Stash
```bash
git stash drop stash@{0}         # Delete specific
git stash clear                   # Delete all
```

---

## Troubleshooting

### Merge Conflict
```bash
# 1. See conflicted files
git status

# 2. Edit files to resolve conflicts
# Look for <<<<<<< HEAD markers

# 3. Mark as resolved
git add <file>

# 4. Complete merge
git commit
```

### Accidentally Committed to Wrong Branch
```bash
# 1. Copy commit hash
git log --oneline

# 2. Switch to correct branch
git checkout correct-branch

# 3. Cherry-pick commit
git cherry-pick <commit-hash>

# 4. Go back and remove from wrong branch
git checkout wrong-branch
git reset --hard HEAD~1
```

### Need to Update Feature Branch with Latest develop
```bash
git checkout feature/task-13
git merge develop
# Or
git rebase develop
```

---

## GitHub PR Workflow

### Create PR
```bash
# 1. Push branch
git push -u origin feature/task-13

# 2. Go to GitHub
# 3. Click "Compare & pull request"
# 4. Select: feature/task-13 → develop
# 5. Fill in description
# 6. Click "Create pull request"
```

### Update PR After Review
```bash
# Make changes
git add .
git commit -m "fix: address review comments"
git push
# PR updates automatically
```

### After PR Merged
```bash
git checkout develop
git pull
git branch -d feature/task-13
```

---

## Useful Aliases

Add to `~/.gitconfig`:

```ini
[alias]
  co = checkout
  br = branch
  ci = commit
  st = status
  unstage = reset HEAD --
  last = log -1 HEAD
  visual = log --graph --oneline --all
  amend = commit --amend --no-edit
```

Usage:
```bash
git co develop              # Instead of git checkout develop
git br                      # Instead of git branch
git ci -m "message"        # Instead of git commit -m "message"
git st                      # Instead of git status
```

---

## Quick Reference

| Task | Command |
|------|---------|
| Start task | `git checkout -b feature/task-13` |
| Commit | `git commit -m "feat: message"` |
| Push | `git push -u origin feature/task-13` |
| Update branch | `git pull` |
| Switch branch | `git checkout develop` |
| Delete branch | `git branch -d feature/task-13` |
| View log | `git log --oneline` |
| Undo changes | `git reset --hard HEAD` |
| Stash work | `git stash` |
| Apply stash | `git stash pop` |

---

**Last Updated:** 2026-04-01
