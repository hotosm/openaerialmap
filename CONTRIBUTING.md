# 🤗 Welcome

:+1::tada: First off, We are really glad you're reading this, because we need
volunteer developers to help improve OpenAerialMap!
:tada::+1:

We welcome and encourage contributors of all skill levels, and we are committed
to making sure your participation is inclusive, enjoyable, and rewarding. If
you have never contributed to an open source project before, we are a good
place to start, and we will make sure you are supported every step of the way.
If you have **any** questions, please ask!

There are many ways to contribute to the **OpenAerialMap**, including:

## Testing

- User testing the functionality and reporting any issues.
- Writing automated tests for the existing code.

## Code contributions

Create pull requests (PRs) for changes that you think are needed. We would
really appreciate your help!

Skills with the following would be beneficial:

- Python
- React
- TypeScript / JavaScript
- Docker
- CI/CD workflows

## Report bugs and suggest improvements

The [issue queue][3] is the best way to get started. There are issue templates
for BUGs and FEATURES that you can use, you could also create your own.

Once you have submitted an issue, it will be assigned one label from the
following [label categories][4].

If you are wondering where to start, you can filter by the
**good first issue label**.

## Report security vulnerabilities

Please inform a maintainer as soon as possible, including the CVE code.

Message via the [HOTOSM Slack][9] or [direct email][10] would be preferred,
but via Github issue is also possible.

## :handshake: Thank you

Thank you very much in advance for your contributions!! Please ensure you refer
to our **Code of Conduct**.
If you've read the guidelines, but are still not sure how to contribute on
Github, please reach out to us via our Slack **#geospatial-tech-and-innovation**.

## Code Contribution guidelines

### Workflow

We operate the "Fork & Pull" model explained at [About Pull Requests][5]

Further details of our development workflow can be found [on this page][8]

### If you are reporting a problem

- Describe exactly what you were trying to achieve, what you did, what you
  expected to happen and what did happen instead. Include relevant information
  about the platform, OS version etc. you are using. Include shell commands you
  typed in, log files, errors messages etc.

- Please open a separate issue for each problem, question, or comment you have.
  Do not reuse existing issues for other topics, even if they are similar. This
  keeps issues small and manageable and makes it much easier to follow through
  and make sure each problem is taken care of.

### Documentation

Project documentation should be in [Markdown format][6], and in a _docs_
subdirectory. While it is possible to use HTML in Markdown documents
for tables and images, it is preferred to use the Markdown style as
it's much easier to read.

See a detailed guide on documentation contributions
[on this page](https://docs.hotosm.org/techdoc).

### Pre-Commit Hooks

[Pre-Commit Hooks][7] are used in this repo to enforce coding style:

- Python adheres mostly to PEP8 convention, amongst others, using the
  tool `ruff`.
- TypeScript / JavaScript code is formatted using `prettier`.
- Markdown files are formatted using `markdownlint`.
- Raq SQL is formatted using `sqlfluff`.

Please install the pre-commit hooks before contributing:

```bash
pip install pre-commit
pre-commit install
```

### Commit Sign-Off Policy

- In order to commit to this repository, please read and accept our
  [commit sign-off policy](https://developercertificate.org)
- This is simply to verify that you are the author of the commits you make.
- If possible, please add to your commit footer the `Signed-off-by` info:
  `Signed-off-by: John Doe <joe.doe@example.com>`

## AI Tool Usage

You may use AI tools to assist your contributions. You are fully responsible
for everything you submit.

- **Understand it**: You must be able to explain every line of your code.
- **Test it**: AI-generated code must pass all tests and security checks.
- **Disclose it**: Pick an AI assistance level (0-5) in the PR template.
<!-- markdownlint-disable-next-line MD013 -->
- **Own it**: You are the author. If a reviewer asks "why?", you answer - not the AI.

AI tools must not be used to fix issues labelled `good first issue`.
These exist for human learning.

For full policy details, see: [AI-assisted coding guide](https://responsibleai.guide/ai-assisted-coding-guide/)

## Our Development Practices

To see more detail on the development practices used at HOT,
please visit [this page](https://docs.hotosm.org/dev-practices)

[3]: https://github.com/hotosm/openaerialmap/issues "issue queue"
[4]: https://github.com/hotosm/openaerialmap/labels "label categories"
[5]: https://help.github.com/articles/about-pull-requests/ "About Pull Requests"
[6]: https://www.markdownguide.org/ "Markdown format"
[7]: https://docs.hotosm.org/dev-guide/repo-management/pre-commit "Pre-commit"
[8]: https://docs.hotosm.org/dev-guide/repo-management/git/#git-flow "Git Flow"
[9]: https://slack.hotosm.org "HOT Slack"
[10]: mailto:sysadmin@hotosm.org "Sysadmin email"
