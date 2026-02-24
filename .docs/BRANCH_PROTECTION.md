# Branch Protection & Merge Policy

This document defines the minimum governance to keep `main` stable and production-ready.

## Branch Protection Rules (`main`)

Enable these settings in GitHub repository settings:

1. **Require a pull request before merging**
2. **Require approvals**: minimum 1
3. **Dismiss stale approvals when new commits are pushed**
4. **Require review from Code Owners** (uses `.github/CODEOWNERS`)
5. **Require status checks to pass before merging**
   - Required check: `backend-quality` (from `.github/workflows/ci.yml`)
6. **Require branches to be up to date before merging**
7. **Require conversation resolution before merging**
8. **Restrict direct pushes to `main`**
9. **Include administrators**

## Merge Strategy

Recommended:
- **Squash merge** for feature PRs
- Keep commit title meaningful (Conventional Commits preferred)

## CI Quality Gates

The workflow `Backend CI` enforces:
- Dependency install (`npm ci`)
- Prisma client generation (`npx prisma generate`)
- Type checking (`npm run typecheck`)
- Full test suite (`npm test`)
- Security audit warning (`npm run audit:high`, non-blocking)

## Operational Rule

Do not merge if:
- CI is red
- Required reviews are missing
- Docs/tests are not updated for behavior changes
