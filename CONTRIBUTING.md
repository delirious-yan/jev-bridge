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

This project is distributed under the [MIT License](LICENSE). You may reuse, modify, and redistribute this bridge subject to that license. The license does **not** provide free TypeSafe/JEV service access or the owner's API credentials.

Using this adapter with TypeSafe requires each user to obtain their own account and credentials and comply with TypeSafe's terms.
