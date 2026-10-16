# Contributing to JEV Bridge

Once this repository is public, anyone can view, clone or fork it and propose changes through a pull request. No contributor gains upstream write access merely by forking or opening a PR.

1. Work in your own fork and propose one narrow, reviewable PR targeting `main`.
2. Run `npm test` under Node 22+ and include the observed result.
3. Add focused offline tests when changing behavior. Never add live, billable API calls to tests.
4. Complete the PR template; a maintainer decides whether to approve and merge.

## Privacy and security

- Never include private repositories, `mind-self`, credentials, TypeSafe API keys, customer tickets, real user data, personal context or internal documents in commits, examples, logs, screenshots, PR descriptions or issues.
- Use synthetic inputs and mocked TypeSafe responses only.
- All workflow, execution, authentication and model authority changes require owner review. Never auto-merge external contributions.
- Never use `pull_request_target` with untrusted fork code, make GitHub secrets available to fork PRs, run fork PR code on a persistent self-hosted machine, or enable privileged automation without a separate security decision.
- Report suspected credential exposure privately, following [SECURITY.md](SECURITY.md).

## License

The owner has **not yet selected an open-source license**. Public GitHub visibility allows viewing and forking on GitHub but does not automatically grant blanket reuse/redistribution rights. Choose and publish an appropriate license before inviting broad reuse.

Using this adapter with TypeSafe requires each user to obtain their own account and credentials and comply with TypeSafe's terms.
