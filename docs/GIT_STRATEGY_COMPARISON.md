# Git Strategy Comparison for NetVis

**Quick decision guide**

---

## Option 1: Simplified Feature Branch (RECOMMENDED)

### Structure
```
main (production)
  ↓
develop (integration)
  ↓
feature/task-* (short-lived)
```

### Visual
```
main:     A-----------E-----------J (tagged releases)
           \         /           /
develop:    B---C---D---F---G---I
             \     /     \     /
feature:      task-13    task-14
```

### Pros ✅
- Clean, organized history
- Easy code review via PRs
- Can work on multiple tasks in parallel
- Easy to revert features
- Matches spec-driven task structure
- Collaboration-ready

### Cons ❌
- Slightly more complex
- Need to manage branches
- Requires PR workflow

### Best For
- ✅ NetVis (spec-driven development)
- ✅ Solo dev who wants structure
- ✅ Projects that might add contributors
- ✅ Learning good Git practices

### Daily Commands
```bash
# Start task
git checkout develop
git checkout -b feature/task-13-zustand-store

# Work
git commit -m "feat: implement Zustand store"

# Finish
git push origin feature/task-13-zustand-store
# Create PR on GitHub → develop
```

---

## Option 2: Single Branch (Simple)

### Structure
```
main (only branch)
```

### Visual
```
main: A---B---C---D---E---F---G---H---I---J
      │   │   │   │   │   │   │   │   │   │
      │   │   │   │   │   │   │   │   │   └─ Task 14 done
      │   │   │   │   │   │   │   │   └───── Bug fix
      │   │   │   │   │   │   │   └─────────  Task 14 WIP
      │   │   │   │   │   │   └─────────────  Task 13 done
      │   │   │   │   │   └─────────────────  Task 13 WIP
      │   │   │   │   └─────────────────────  Bug fix
      │   │   │   └─────────────────────────  Task 13 WIP
      │   │   └─────────────────────────────  Task 12 done
      │   └─────────────────────────────────  Task 12 WIP
      └─────────────────────────────────────  Initial commit
```

### Pros ✅
- Simplest possible
- No branch management
- Fast iteration
- Good for solo learning

### Cons ❌
- No code review
- Hard to revert features
- Can't work on multiple tasks easily
- History can be messy
- Not collaboration-ready

### Best For
- ✅ Rapid prototyping
- ✅ Solo experimentation
- ✅ Very small projects
- ❌ Not ideal for NetVis

### Daily Commands
```bash
# Work directly on main
git add .
git commit -m "feat: implement Zustand store"
git push origin main
```

---

## Option 3: GitFlow (Complex)

### Structure
```
main (production)
  ↓
develop (integration)
  ↓
feature/*, release/*, hotfix/*
```

### Visual
```
main:     A-----------E-----------J-----------M
           \         /           /           /
develop:    B---C---D---F---G---I---K---L---
             \     /     \     /     \     /
feature:      task-13    task-14    task-15
                    \
release:             H (v1.0.0-rc)
```

### Pros ✅
- Very structured
- Supports complex release cycles
- Clear separation of concerns
- Industry standard for large teams

### Cons ❌
- Overkill for NetVis
- Complex branch management
- Slower iteration
- More overhead

### Best For
- ❌ Large teams
- ❌ Complex release schedules
- ❌ Enterprise projects
- ❌ Too complex for NetVis

---

## Side-by-Side Comparison

| Feature | Single Branch | Feature Branch | GitFlow |
|---------|--------------|----------------|---------|
| **Complexity** | ⭐ Simple | ⭐⭐ Moderate | ⭐⭐⭐ Complex |
| **Code Review** | ❌ No | ✅ Yes (PRs) | ✅ Yes (PRs) |
| **Parallel Work** | ❌ Hard | ✅ Easy | ✅ Easy |
| **Revert Features** | ❌ Hard | ✅ Easy | ✅ Easy |
| **Collaboration** | ❌ Poor | ✅ Good | ✅ Excellent |
| **Learning Curve** | ⭐ Easy | ⭐⭐ Moderate | ⭐⭐⭐ Steep |
| **Setup Time** | 0 min | 5 min | 15 min |
| **Daily Overhead** | Low | Medium | High |
| **For NetVis** | ❌ Not ideal | ✅ Perfect | ❌ Overkill |

---

## Decision Matrix

### Choose Single Branch If:
- [ ] You're the only developer (forever)
- [ ] You're just learning Git
- [ ] You're prototyping rapidly
- [ ] You don't need code review
- [ ] You're okay with messy history

### Choose Feature Branch If: ✅ RECOMMENDED
- [x] You want clean, organized history
- [x] You might add contributors later
- [x] You want to learn good Git practices
- [x] You're following spec-driven development
- [x] You want quality control (tests before merge)
- [x] **This is NetVis!**

### Choose GitFlow If:
- [ ] You have a large team (5+ developers)
- [ ] You have complex release cycles
- [ ] You need strict separation of concerns
- [ ] You're building enterprise software
- [ ] **Not needed for NetVis**

---

## My Recommendation

### For NetVis: **Simplified Feature Branch Workflow**

**Why:**
1. ✅ Matches your spec-driven task structure perfectly
2. ✅ Clean history (one commit per task via squash merge)
3. ✅ Quality control (tests must pass before merge)
4. ✅ Easy to review your own work
5. ✅ Collaboration-ready if you add contributors
6. ✅ Not too complex (just 2 permanent branches)
7. ✅ Industry-standard practice

**Setup (5 minutes):**
```bash
# Create develop branch
git checkout -b develop
git push -u origin develop

# Protect branches on GitHub
# Settings → Branches → Add rule for main and develop:
#   ✅ Require pull request reviews
#   ✅ Require status checks to pass (tests)
```

**Daily workflow:**
```bash
# Start task
git checkout develop
git checkout -b feature/task-13-zustand-store

# Work (make multiple commits as you go)
git commit -m "feat: add Zustand store structure"
git commit -m "feat: wire IPC listeners"
git commit -m "test: add store tests"

# Push and create PR
git push -u origin feature/task-13-zustand-store
# On GitHub: Create PR → develop

# After tests pass, squash merge
# Result: One clean commit on develop

# Clean up
git checkout develop
git pull
git branch -d feature/task-13-zustand-store
```

---

## Quick Start Guide

### Step 1: Initial Setup (One Time)

```bash
# Clone repo
git clone <your-repo-url>
cd netvis

# Create develop branch
git checkout -b develop
git push -u origin develop

# Set develop as default branch on GitHub (optional)
# Settings → Branches → Default branch → develop
```

### Step 2: Protect Branches (One Time)

On GitHub:
1. Go to Settings → Branches
2. Add rule for `main`:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
3. Add same rule for `develop`

### Step 3: Daily Workflow

```bash
# Start new task
git checkout develop
git pull
git checkout -b feature/task-13-zustand-store

# Work and commit frequently
git add .
git commit -m "feat(renderer): implement Zustand store structure"

# More work...
git commit -m "feat(renderer): wire IPC listeners in App.tsx"

# More work...
git commit -m "test(renderer): add Zustand store tests"

# Push when ready
git push -u origin feature/task-13-zustand-store

# Create PR on GitHub
# feature/task-13-zustand-store → develop

# After PR approved and tests pass
# Click "Squash and merge" on GitHub

# Clean up locally
git checkout develop
git pull
git branch -d feature/task-13-zustand-store
```

### Step 4: Checkpoint (After Phase Complete)

```bash
# All Phase 1 tasks merged to develop
git checkout main
git pull
git merge develop --no-ff -m "chore: merge Phase 1 - core pipeline complete"

# Tag the release
git tag -a v0.1.0-phase1 -m "Phase 1: Core pipeline complete (Tasks 1-11)"

# Push
git push origin main --tags

# Continue development on develop
git checkout develop
```

---

## Summary

**For NetVis, use:**
- ✅ **Simplified Feature Branch Workflow**
- ✅ Two permanent branches: `main` and `develop`
- ✅ Short-lived feature branches: `feature/task-*`
- ✅ Squash merge to keep history clean
- ✅ PR workflow for quality control

**Don't use:**
- ❌ Single branch (too simple, no quality control)
- ❌ GitFlow (too complex, unnecessary overhead)

**Result:**
- Clean, organized history
- Easy to review and revert
- Collaboration-ready
- Matches spec-driven development
- Industry-standard practice

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-01
