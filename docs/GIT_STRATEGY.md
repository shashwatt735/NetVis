# Git Branching and Commit Strategy for NetVis

**Recommended Strategy:** Simplified Feature Branch Workflow

---

## Overview

For NetVis, I recommend a **simplified feature branch workflow** that balances structure with agility. This works well for:
- Solo or small team development
- Educational/learning projects
- Spec-driven development with clear task boundaries
- Frequent iterations and bug fixes

---

## Branch Structure

### Core Branches

```
main (production-ready)
  ↓
develop (integration branch)
  ↓
feature/*, bugfix/*, docs/* (short-lived)
```

### Branch Purposes

| Branch | Purpose | Lifetime | Protected |
|--------|---------|----------|-----------|
| `main` | Production-ready code, tagged releases | Permanent | ✅ Yes |
| `develop` | Integration branch, latest stable development | Permanent | ✅ Yes |
| `feature/*` | New features (e.g., `feature/task-13-zustand-store`) | Short-lived | ❌ No |
| `bugfix/*` | Bug fixes (e.g., `bugfix/anonymizer-payload-hash`) | Short-lived | ❌ No |
| `docs/*` | Documentation updates | Short-lived | ❌ No |
| `release/*` | Release preparation (optional) | Short-lived | ❌ No |

---

## Recommended Workflow

### For NetVis Development

Given your spec-driven approach with clear tasks, here's the recommended workflow:

```
1. Start from develop
   git checkout develop
   git pull origin develop

2. Create feature branch (named after task)
   git checkout -b feature/task-13-zustand-store

3. Work on the task
   - Make small, logical commits
   - Run tests frequently
   - Update docs as you go

4. Commit with clear messages
   git add .
   git commit -m "feat(renderer): implement Zustand store with full shape (Task 13)"

5. Push and create PR
   git push origin feature/task-13-zustand-store
   # Create PR: feature/task-13-zustand-store → develop

6. After PR approval, merge to develop
   # Squash merge or regular merge (your choice)

7. Periodically merge develop → main
   # When a phase is complete or checkpoint passed
```

---

## Commit Message Convention

Use **Conventional Commits** for clarity:

### Format
```
<type>(<scope>): <subject>

<body>

<footer>
```

### Types
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation only
- `style`: Code style (formatting, no logic change)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance (dependencies, build, etc.)

### Examples

```bash
# Feature
git commit -m "feat(renderer): add Zustand store with packet state management"

# Bug fix
git commit -m "fix(anonymizer): hash only payload bytes instead of entire frame

- Calculate payload start offset from transport layer
- Extract payload bytes using subarray()
- Fixes Bug #1 from code review"

# Documentation
git commit -m "docs: add packet journey explanation for beginners"

# Test
git commit -m "test(anonymizer): add property test for payload pseudonym correctness"

# Checkpoint
git commit -m "chore: complete Phase 1 checkpoint - all 86 tests passing"
```

---

## Branch Naming Convention

### Pattern
```
<type>/<task-or-description>
```

### Examples

**Features (from tasks.md):**
```
feature/task-13-zustand-store
feature/task-14-mui-theme
feature/task-15-appshell-layout
feature/task-16-packet-list
```

**Bug fixes:**
```
bugfix/anonymizer-payload-hash
bugfix/capture-worker-bypass
bugfix/redundant-packet-handler
```

**Documentation:**
```
docs/architecture-update
docs/packet-journey-guide
docs/git-strategy
```

**Hotfixes (urgent production fixes):**
```
hotfix/critical-security-issue
hotfix/crash-on-startup
```

---

## Merge Strategy

### Option 1: Squash Merge (Recommended for NetVis)

**When to use:** Most feature branches

**Pros:**
- Clean, linear history on develop/main
- One commit per feature/task
- Easy to revert entire features
- Matches spec-driven task structure

**Cons:**
- Loses detailed commit history from feature branch

**How:**
```bash
# On GitHub/GitLab
Select "Squash and merge" when merging PR

# Or manually
git checkout develop
git merge --squash feature/task-13-zustand-store
git commit -m "feat(renderer): implement Zustand store (Task 13)"
```

**Result:**
```
develop: A---B---C---D---E
              ↑       ↑
         Task 12  Task 13 (squashed)
```

---

### Option 2: Regular Merge

**When to use:** Large features with meaningful commit history

**Pros:**
- Preserves all commits
- Shows detailed development process
- Good for learning/review

**Cons:**
- More cluttered history
- Harder to revert

**How:**
```bash
git checkout develop
git merge --no-ff feature/task-13-zustand-store
```

**Result:**
```
develop: A---B-------D---E
              \     /
               C1-C2-C3  (feature branch commits preserved)
```

---

### Option 3: Rebase (Advanced)

**When to use:** You want linear history but preserve commits

**Pros:**
- Linear history
- Preserves individual commits
- No merge commits

**Cons:**
- Rewrites history (don't do on shared branches!)
- More complex

**How:**
```bash
git checkout feature/task-13-zustand-store
git rebase develop
git checkout develop
git merge --ff-only feature/task-13-zustand-store
```

---

## Recommended Strategy for NetVis

### Phase-Based Approach

```
main (production releases)
  ↓
develop (active development)
  ↓
feature/task-* (individual tasks)
```

### Workflow

1. **Daily work:** Feature branches for each task
2. **Task completion:** Squash merge to develop
3. **Checkpoint passed:** Merge develop → main, tag release

### Example Timeline

```
Week 1:
  feature/task-13-zustand-store → develop (squash merge)
  feature/task-14-mui-theme → develop (squash merge)
  
Week 2:
  feature/task-15-appshell → develop (squash merge)
  bugfix/ui-rendering-issue → develop (squash merge)
  
Checkpoint (Phase 1 complete):
  develop → main (merge commit)
  Tag: v0.1.0-phase1
```

---

## Alternative: Simplified Single-Branch Strategy

If you prefer **maximum simplicity**, here's an alternative:

### Structure
```
main (only branch)
  ↓
Small, frequent commits directly to main
```

### When to Use
- Solo developer
- Rapid prototyping
- Learning/experimentation
- No need for code review

### Pros
- ✅ Simplest possible workflow
- ✅ No branch management overhead
- ✅ Fast iteration
- ✅ Good for learning

### Cons
- ❌ No code review process
- ❌ Can't easily revert features
- ❌ Harder to collaborate
- ❌ No separation of stable vs. experimental

### Workflow
```bash
# Work directly on main
git checkout main
git pull

# Make changes
# ... edit files ...

# Commit frequently
git add .
git commit -m "feat(renderer): add Zustand store"

# Push
git push origin main
```

### When This Works
- You're the only developer
- You're comfortable with Git
- You run tests before every commit
- You're okay with occasional broken commits

---

## My Recommendation for NetVis

### Use: **Simplified Feature Branch Workflow**

**Why:**
1. **Spec-driven development:** Each task maps to a feature branch
2. **Quality control:** Tests must pass before merging
3. **Clean history:** Squash merge keeps develop/main clean
4. **Flexibility:** Can work on multiple tasks in parallel
5. **Collaboration-ready:** Easy to add contributors later

### Setup

```bash
# Initial setup
git checkout -b develop
git push -u origin develop

# Protect main and develop on GitHub/GitLab
# Settings → Branches → Add rule:
#   - Require pull request reviews
#   - Require status checks (tests must pass)
#   - No direct pushes
```

### Daily Workflow

```bash
# Start new task
git checkout develop
git pull
git checkout -b feature/task-13-zustand-store

# Work and commit
git add .
git commit -m "feat(renderer): implement Zustand store structure"
git commit -m "feat(renderer): wire IPC listeners in App.tsx"
git commit -m "test(renderer): add Zustand store tests"

# Push and create PR
git push -u origin feature/task-13-zustand-store
# Create PR on GitHub: feature/task-13-zustand-store → develop

# After PR approved and tests pass
# Squash merge on GitHub

# Clean up
git checkout develop
git pull
git branch -d feature/task-13-zustand-store
```

---

## Tagging Strategy

### Semantic Versioning

```
v<major>.<minor>.<patch>[-<prerelease>]
```

### Examples

```bash
# Phase 1 checkpoint
git tag -a v0.1.0-phase1 -m "Phase 1: Core pipeline complete"

# Phase 2 checkpoint
git tag -a v0.2.0-phase2 -m "Phase 2: Advanced visualizations complete"

# First beta release
git tag -a v1.0.0-beta.1 -m "First beta release"

# Production release
git tag -a v1.0.0 -m "NetVis 1.0 - Production release"

# Push tags
git push origin --tags
```

### Tag Naming Convention

| Version | Meaning | Example |
|---------|---------|---------|
| `v0.x.0-phaseX` | Phase checkpoint | `v0.1.0-phase1` |
| `v0.x.0-alpha.X` | Early testing | `v0.3.0-alpha.1` |
| `v0.x.0-beta.X` | Feature complete, testing | `v0.9.0-beta.1` |
| `v1.0.0-rc.X` | Release candidate | `v1.0.0-rc.1` |
| `v1.0.0` | Production release | `v1.0.0` |
| `v1.1.0` | Minor update | `v1.1.0` |
| `v1.0.1` | Patch/bugfix | `v1.0.1` |

---

## Pull Request Template

Create `.github/pull_request_template.md`:

```markdown
## Description
Brief description of changes

## Related Task
- Task #: [e.g., Task 13 - Zustand store]
- Spec: `.kiro/specs/netvis-core/tasks.md`

## Changes
- [ ] Feature implementation
- [ ] Tests added/updated
- [ ] Documentation updated
- [ ] All tests passing

## Testing
- [ ] Unit tests pass
- [ ] Property tests pass (if applicable)
- [ ] Manual testing completed

## Checklist
- [ ] Code follows style guide (ESLint clean)
- [ ] TypeScript strict mode compliant
- [ ] No console.log statements
- [ ] Security invariants maintained
```

---

## Git Hooks (Optional)

### Pre-commit Hook

Create `.husky/pre-commit`:

```bash
#!/bin/sh
. "$(dirname "$0")/_/husky.sh"

# Run linter
npm run lint

# Run formatter check
npm run format:check

# Run tests
npm test
```

### Setup Husky

```bash
npm install --save-dev husky
npx husky install
npx husky add .husky/pre-commit "npm run lint && npm test"
```

---

## Common Scenarios

### Scenario 1: Working on a Task

```bash
git checkout develop
git pull
git checkout -b feature/task-13-zustand-store

# Work...
git add .
git commit -m "feat(renderer): implement Zustand store"

git push -u origin feature/task-13-zustand-store
# Create PR on GitHub
```

### Scenario 2: Bug Found During Development

```bash
# On feature branch
git checkout -b bugfix/anonymizer-payload-hash

# Fix bug
git add .
git commit -m "fix(anonymizer): hash only payload bytes"

git push -u origin bugfix/anonymizer-payload-hash
# Create PR → develop (high priority)
```

### Scenario 3: Checkpoint Passed

```bash
# All Phase 1 tasks complete
git checkout main
git merge develop --no-ff -m "chore: merge Phase 1 - core pipeline complete"
git tag -a v0.1.0-phase1 -m "Phase 1: Core pipeline complete"
git push origin main --tags
```

### Scenario 4: Hotfix for Production

```bash
git checkout main
git checkout -b hotfix/critical-crash

# Fix issue
git add .
git commit -m "fix: resolve crash on startup"

# Merge to main
git checkout main
git merge hotfix/critical-crash
git tag -a v1.0.1 -m "Hotfix: crash on startup"

# Also merge to develop
git checkout develop
git merge hotfix/critical-crash

git push origin main develop --tags
```

---

## Summary

### ✅ Recommended for NetVis

**Strategy:** Simplified Feature Branch Workflow

**Branches:**
- `main` - Production-ready
- `develop` - Active development
- `feature/*` - Task-based features
- `bugfix/*` - Bug fixes

**Workflow:**
1. Create feature branch from develop
2. Work and commit
3. Create PR → develop
4. Squash merge after tests pass
5. Periodically merge develop → main at checkpoints

**Why:**
- Matches spec-driven task structure
- Clean, reviewable history
- Quality control via PR + tests
- Collaboration-ready
- Not too complex

### 🎯 Quick Start

```bash
# Setup
git checkout -b develop
git push -u origin develop

# Daily work
git checkout develop
git checkout -b feature/task-13-zustand-store
# ... work ...
git push -u origin feature/task-13-zustand-store
# Create PR on GitHub

# After merge
git checkout develop
git pull
git branch -d feature/task-13-zustand-store
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-01  
**For:** NetVis Project
