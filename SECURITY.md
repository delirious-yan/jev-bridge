# Security Policy

Do not put vulnerabilities, API keys, live credentials, customer data, or exploitation steps in public issues or pull requests.

If enabled, use the repository's GitHub private vulnerability reporting feature under **Security**. If it is not enabled, request a private reporting channel from the owner without disclosing sensitive details publicly.

- API keys are kept in GitHub Actions Secrets and are never tracked in source.
- Fork-originated pull-request checks must not receive repository secrets or write tokens.
- JEV calls are always advisory, opt-in, and cost-aware. Public cloning is not permission to spend the owner's TypeSafe credits.
- Untrusted pull requests must never automatically merge, deploy, access another private repo, or run on an owner workstation.
- Public visibility exposes all reachable Git history and public PR discussions: audit branches, tags and history before changing visibility.
