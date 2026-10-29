# Presenting the repository: README, docs, GitHub and npm

Checked 2026-10-29 against GitHub Docs (read from the [github/docs](https://github.com/github/docs) source where the rendered page hides details), npm Docs, diataxis.fr, opensource.guide, Keep a Changelog and the example repos linked below. Claims marked **observed** come from looking at the live npmjs.com and github.com pages or the GitHub API on that date, not from documentation; they are undocumented behavior and can change.

The short answer: ownship already has the hard parts (a clear tagline, a one-command install, a privacy section, every community health file). What it lacks is a picture of the product, a sentence on what generation costs, and a few settings on GitHub and npm. It does not need a docs site, more badges, or more community files.

## 1. README

### Structure and order

- opensource.guide says a README should answer "What does this project do?", "Why is this project useful?", "How do I get started?" and "Where can I get more help, if I need it?", and should link to CONTRIBUTING ([Starting a project](https://opensource.guide/starting-a-project/)). GitHub says a README "should only contain information necessary for developers to get started using and contributing to your project" ([About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)). npm says most READMEs cover "installing, configuring, and using" the package ([About package README files](https://docs.npmjs.com/about-package-readme-files)).
- The example repos in section 5 converge on one order: name and tagline, a paragraph that says what it is, one image of it working, install in one command, the main commands, then deeper material and links. ownship's README follows that order already, minus the image.
- GitHub builds a table of contents from headings automatically (the "Outline" menu), so a hand-written TOC is redundant ([About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)). Content past 500 KiB is truncated (same page), which is irrelevant at 58 lines.
- GitHub shows a README from `.github/`, the root or `docs/`, in that order (same page). A `docs/README.md` therefore never replaces the root one; it renders when someone browses `docs/` (**observed**).

### Badges

There is no primary-source guidance on badges; this is judgment. A badge earns its place when it answers a question a visitor has and the sidebar does not already answer it.

- **Earns it:** the npm version (is it published, which version) and CI status. GitHub documents the workflow badge URL `https://github.com/OWNER/REPO/actions/workflows/WORKFLOW-FILE/badge.svg` ([Adding a workflow status badge](https://docs.github.com/en/actions/how-tos/monitor-workflows/add-a-status-badge)). The npm version badge needs a third-party service such as shields.io.
- **Noise:** license (GitHub's About sidebar and npm's sidebar both show it), stars, downloads at 0.1.0, social follow badges, "PRs welcome", Node version (the install line already says Node 22.15). ripgrep shows three badges, uv three, atuin seven including Mastodon and Twitter follows; the last is the one to avoid.
- Badges are images: give each an `alt` (uv does; atuin does not).

### Images

- **Relative paths.** GitHub recommends relative links for images stored in the repo; they follow the branch being viewed, and a leading `/` resolves from the repo root ([Basic writing and formatting syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#relative-links)).
- **Light and dark.** GitHub's documented way is `<picture>` with `<source media="(prefers-color-scheme: dark)" srcset="…">` and an `<img>` fallback that carries the alt text ([Quickstart for writing on GitHub](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github#adding-an-image-to-suit-your-visitors)). The older `#gh-dark-mode-only` / `#gh-light-mode-only` URL fragments (still used by VHS) no longer appear in GitHub Docs; treat them as legacy.
- **Alt text** is "a short text equivalent of the information in the image" ([syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#images)). For a screenshot of a card, that means what the card says, not "screenshot". atuin's `alt="animated"` is the example not to follow.
- **Size limits.** Git warns on files over 50 MiB and GitHub rejects files over 100 MiB ([About large files on GitHub](https://docs.github.com/en/repositories/working-with-files/managing-large-files/about-large-files-on-github)). Files attached through the web UI or `gh` (the `user-attachments` URLs uv and atuin use) are capped at 10 MB for images and GIFs ([Attaching files](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/attaching-files)). Neither limit matters for a few PNGs; page weight does, so keep each image well under 1 MB.
- **Where to store them.** Two options: commit them (for example under `docs/assets/`), or upload them as attachments and paste the URL. Committed images are versioned, reviewable and regenerable; attachments keep binaries out of git history but are invisible to review and cannot be updated in place. For a repo this size, commit them.

### GitHub Markdown features

- **Alerts** (`> [!NOTE]`, `[!TIP]`, `[!IMPORTANT]`, `[!WARNING]`, `[!CAUTION]`): GitHub advises one or two per article, never consecutive, never nested ([syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax#alerts)). **Observed:** npmjs.com renders them as a plain blockquote with the literal `[!TIP]` text (nuxt's README). Since ownship's README is also its npm page, do not use alerts there.
- **Mermaid** renders in Markdown files on GitHub from a fenced `mermaid` block ([Creating diagrams](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/creating-diagrams)). Rendering on npm is **not verified**; assume it shows as a code block. The numbered "How it works" list reads better than a five-box flowchart anyway.
- **Collapsed sections** (`<details>` / `<summary>`) hide detail until clicked ([Organizing information with collapsed sections](https://docs.github.com/en/get-started/writing-on-github/working-with-advanced-formatting/organizing-information-with-collapsed-sections)). Not needed at this length.

## 2. Docs organization

### Diátaxis

Diátaxis identifies four needs and four forms ([diataxis.fr](https://diataxis.fr/), [Start here](https://diataxis.fr/start-here/)): a **tutorial** "is a lesson"; a **how-to guide** "addresses a real-world goal or problem"; **reference** contains "the technical description - facts"; **explanation** provides "context and background" and answers "why?". Explanation explicitly covers "design decisions, historical reasons, technical constraints" and "can and must consider alternatives" ([Explanation](https://diataxis.fr/explanation/)), which is what ADRs and research notes are.

It is not a folder layout. Using it "does not require you to think about dividing up your documentation into four sections", and it warns against creating "empty structures for tutorials/howto guides/reference/explanation with nothing in them"; improve one piece at a time and publish each step ([How to use Diátaxis](https://diataxis.fr/how-to-use-diataxis/)).

### Mapping onto ownship

| Form                     | What ownship has                                                                                 | Gap                                                                                                                                                                             |
| ------------------------ | ------------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tutorial                 | README "Install": `npx ownship init` does everything in one step                                 | None. A one-command setup is its own tutorial; a separate one would repeat it.                                                                                                  |
| How-to                   | Scattered: phone pairing in "Install", research mode in "Privacy", log locations in CONTRIBUTING | No "something is wrong" path for users: `ownship status`, then `~/.ownship/capture.log` and `daemon.log`. Pairing over LAN vs Tailscale could be a short section when it grows. |
| Reference                | README command list and "Configuration" keys                                                     | Enough for now.                                                                                                                                                                 |
| Explanation              | README "How it works" and "Privacy defaults"; `docs/research/`, `docs/adr/`, `docs/specs/`       | None for users. These are the right place for "why".                                                                                                                            |
| Internal (not for users) | `docs/plans/`, `docs/brainstorm-prompt.md`, `docs/research/versions.md`                          | Not a gap, but the README "Docs" list mixes user material (roadmap) with design material (spec, ADRs) without saying which is which.                                            |

### Is a docs site warranted?

No. The user-facing material fits in a ~60-line README; GitHub renders every Markdown file with an outline and resolves relative links; and Diátaxis itself says to grow structure from content, not ahead of it. A site adds a build, a deploy and a second place for copy to drift. Revisit when how-to material outgrows the README (several guides, not one section), or when the non-engineer audience the spec mentions arrives. GitHub's own advice is that longer documentation can go to a wiki ([About READMEs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)); for ownship, Markdown in `docs/` is better because it is reviewed in pull requests like the code.

## 3. GitHub repository presentation

### About, topics, homepage

- Description, website and topics are edited from the gear next to "About". Topics: lowercase letters, numbers and hyphens, 50 characters or less, no more than 20 ([Classifying your repository with topics](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/classifying-your-repository-with-topics)). `gh repo edit` sets `--description`, `--homepage`, `--add-topic` and `--remove-topic`.
- Today: description set, 8 topics, no homepage. **Observed:** the GitHub description ("…spaced-repetition exercises from your real diffs, on your phone, local-first.") differs from `package.json` and the README tagline ("Understand what your coding agent ships under your name.").

### Social preview

- PNG, JPG or GIF under 1 MB; at least 640×320, **1280×640 for best display**. Transparent PNGs work, but GitHub suggests a solid background when unsure how it will look on other platforms ([Customizing your repository's social media preview](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/customizing-your-repositorys-social-media-preview)).
- Set it in **Settings → Social preview → Edit → Upload an image** (same page). **It cannot be set by API or `gh`**: the GraphQL `Repository` type exposes `openGraphImageUrl` and `usesCustomOpenGraphImage` read-only, `UpdateRepositoryInput` has no image field, there is no mutation for it, and `gh repo edit` has no flag (checked by introspection and `gh repo edit --help`, gh 2.101.0). Without one, shares show the owner's avatar.

### Community health files and the Community Standards checklist

- The checklist checks for "recommended community health files, such as README, CODE_OF_CONDUCT, LICENSE, or CONTRIBUTING, in a supported location" ([About community profiles](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)). Supported files also include `SECURITY.md`, `SUPPORT.md`, `FUNDING.yml`, `VULNERABILITY_REPORT.yml` and discussion forms ([Creating a default community health file](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/creating-a-default-community-health-file)).
- **Observed:** ownship's checklist shows all eight items checked (description, README, code of conduct, contributing, license, security policy, issue templates, pull request template). The REST `community/profile` endpoint reports `health_percentage: 100` but `issue_template: null`; the UI is the one to trust.
- The checklist now offers one more "additional community file": `ACCESSIBILITY.md`, which adds an Accessibility tab and an About link ([Adding an accessibility page](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/adding-an-accessibility-page-to-your-repository)). Optional; it fits after the design pass, not before.
- The code of conduct is Contributor Covenant 2.1; the site lists 3.0 as the latest version ([contributor-covenant.org](https://www.contributor-covenant.org/)). 2.1 is fine; upgrading is not urgent.

### Issue forms vs templates

Issue forms are YAML in `.github/ISSUE_TEMPLATE` with required `name`, `description` and `body`, and turn inputs into a Markdown issue; they are still in public preview, and pull requests cannot use them ([Syntax for issue forms](https://docs.github.com/en/communities/using-templates-to-encourage-useful-issues-and-pull-requests/syntax-for-issue-forms)). Forms suit a bug report that needs specific fields (OS, versions, `ownship status`), which is what ownship has. Keep them.

### CITATION.cff and FUNDING.yml

- `CITATION.cff` at the root adds "Cite this repository" to the sidebar ([About CITATION files](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-citation-files)); the format exists "to let others know how to correctly cite their software" ([citation-file-format.github.io](https://citation-file-format.github.io/)). ownship is a tool, not research software people will cite. Skip.
- `.github/FUNDING.yml` adds a Sponsor button: up to four GitHub Sponsors accounts, one per external platform, up to four custom URLs ([Displaying a sponsor button](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/displaying-a-sponsor-button-in-your-repository)). Only worth it once there is a Sponsors profile to point at.

### Releases, Discussions, pinned issues

- Releases carry notes and binaries ([About releases](https://docs.github.com/en/repositories/releasing-projects-on-github/about-releases)). Generated notes list merged pull requests and contributors, configurable in `.github/release.yml` ([Automatically generated release notes](https://docs.github.com/en/repositories/releasing-projects-on-github/automatically-generated-release-notes)). Keep a Changelog says changelogs "are for humans, not machines", that commit log diffs are "full of noise", and that GitHub Releases alone are "non-portable" ([Keep a Changelog 1.1.0](https://keepachangelog.com/en/1.1.0/)). ownship already does the right thing: `CHANGELOG.md` is the source and the v0.1.0 release body is its section. **Observed:** GitHub rewrites the relative `ROADMAP.md` link in the release body to `/blob/v0.1.0/ROADMAP.md`, so relative links in release notes work.
- Discussions are "for conversations that need to be transparent and accessible but do not need to be tracked" ([Discussions quickstart](https://docs.github.com/en/discussions/quickstart)). A project with no community yet gains nothing from a second, empty inbox. Keep it off.
- Up to three issues can be pinned above the issue list ([Pinning an issue](https://docs.github.com/en/issues/tracking-your-work-with-issues/administering-issues/pinning-an-issue-to-your-repository)). Nothing to pin yet; the roadmap lives in `ROADMAP.md`.

## 4. The npm package page

- **README.** It must be at the package root and only updates on npmjs.com when a new version is published ([About package README files](https://docs.npmjs.com/about-package-readme-files)). README fixes on `main` reach npm only with the next release.
- **Fields** ([package.json](https://docs.npmjs.com/cli/v11/configuring-npm/package-json)): `description` and `keywords` help people find the package in `npm search`; `homepage` and `bugs` feed the sidebar and `npm bugs`; `repository` should be a public URL, and npm normalizes it to `{ type, url }`; `funding` feeds `npm fund`. **Observed:** without `homepage` and `bugs` in `package.json`, the registry already shows `https://github.com/crow-rojas/ownship#readme` and `…/issues`, derived from `repository`. No need to add them.
- **`files`.** It whitelists what goes in the tarball; `package.json`, the README, the LICENSE and the `bin` files are always included (same page). ownship's `files` is `["dist", "README.md", "LICENSE"]` (44 files in 0.1.0), so screenshots under `docs/` never reach the tarball. Nothing to change.
- **Relative links and images (observed).** npmjs.com rewrites relative Markdown links in ownship's README to `https://github.com/crow-rojas/ownship/blob/HEAD/…`, and relative `<img src>` to `https://raw.githubusercontent.com/<owner>/<repo>/HEAD/…` (seen on ink and execa). Two consequences:
  - relative image paths work on npm, but they point at the default branch, not the published version, so moving or deleting an image breaks it on older versions' pages;
  - `<source srcset>` inside `<picture>` is **not** rewritten. execa's `srcset="media/logo_dark.svg"` stays relative on npmjs.com and resolves against npmjs.com. A `<picture>` with relative sources is broken on npm in dark mode; use absolute URLs in `srcset` or skip `<picture>`.
- **Provenance.** Publishing with provenance needs a cloud-hosted GitHub Actions or GitLab runner, `id-token: write`, and a `repository` that matches the source repo (case-sensitive) ([Generating provenance statements](https://docs.npmjs.com/generating-provenance-statements)). With trusted publishing (OIDC, configured in the package's npm settings; npm CLI 11.5.1+ and Node 22.14+), provenance is generated by default and no token is stored ([Trusted publishing](https://docs.npmjs.com/trusted-publishers)); pnpm "attaches provenance to a public package from a public repository on its own" under trusted publishing ([pnpm publish](https://pnpm.io/cli/publish)). npmjs.com shows it as a green check next to the version, with build details behind it, and `npm audit signatures` verifies it ([Viewing package provenance](https://docs.npmjs.com/viewing-package-provenance)). **Observed:** 0.1.0 has no attestations (it was published from a laptop), and the registry also holds a `0.0.0-stage` version.
- **Old versions.** A single version can be unpublished within 72 hours of publishing if nothing depends on it; otherwise npm recommends `npm deprecate <package>@<version> "<message>"` ([Unpublish policy](https://docs.npmjs.com/policies/unpublish)).

## 5. Example READMEs worth imitating

- **[astral-sh/uv](https://github.com/astral-sh/uv):** a one-line tagline ("An extremely fast Python package and project manager, written in Rust."), then the proof as a light/dark `<picture>` benchmark chart with real alt text and a caption saying what was measured. "Highlights" is a short bullet list where each claim links to its docs page. Three badges, then install per platform. A short FAQ at the end handles the questions people actually ask.
- **[atuinsh/atuin](https://github.com/atuinsh/atuin):** the closest in spirit (local SQLite, optional sync). The first paragraph says what it replaces and what it stores, and the privacy promise is in the pitch itself, in the author's voice: "As all history sync is encrypted, I couldn't access your data even if I wanted to." A demo GIF with a caption, one example command, then features. Skip its seven badges and its weak alt text.
- **[BurntSushi/ripgrep](https://github.com/BurntSushi/ripgrep):** the opening paragraph says what it does, what it does by default, where it runs and what it resembles. A "Documentation quick links" list points to the guide, FAQ and changelog instead of inlining them. It has both "Why should I use ripgrep?" and "Why shouldn't I use ripgrep?", an honest limits section that builds trust.
- **[charmbracelet/vhs](https://github.com/charmbracelet/vhs):** the demo GIF was made with the tool, and the README links its source ("view source" of the `.tape` file), so the demo is reproducible and regenerable when the UI changes. A tutorial follows immediately. (Its light/dark logo uses the legacy URL fragments, not `<picture>`.)
- **[jesseduffield/lazygit](https://github.com/jesseduffield/lazygit):** take only the "Elevator Pitch": the problem in the user's own frustrated words before any feature. Leave the rest: a sponsor wall sits above the pitch and the README runs to 663 lines.

## Recommendations for ownship

Ordered by value for effort. "Repo" changes go through a pull request; "GitHub" and "npm" are settings or commands the maintainer runs.

### Do now

1. **Repo: add one screenshot.** `docs/assets/card-phone.png`: one card in the review app at a phone viewport (390×844 CSS px, captured at 2x = 780×1688), light theme, under 500 KB. Make it from a throwaway repo with toy content, as with fixtures (rule 7): a card quotes code, so a real one would leak it. In the README, put it right after the pitch paragraph as `<img src="docs/assets/card-phone.png" width="300" alt="…">` with alt text that says what the card asks. Relative path, no `<picture>`. The roadmap's "Design and motion" pass is next, so don't invest in more until it lands.
2. **Repo: README edits** (`README.md`):
   - one sentence on cost, from the spec: cards are written under your agent's own login, so they use your subscription or API quota, and generation stops at the daily cap;
   - split "Docs" into **Use** (Roadmap, Changelog) and **Design** (spec, ADRs, research), and add the missing `CHANGELOG.md` link;
   - add a short "Something wrong?" how-to: `ownship status`, then `~/.ownship/capture.log` and `~/.ownship/daemon.log`, then the bug form;
   - add a two-line "Contributing" section linking `CONTRIBUTING.md` and `SECURITY.md` (opensource.guide recommends linking CONTRIBUTING from the README).
3. **GitHub: social preview.** A 1280×640 PNG on a solid background, under 1 MB: the wordmark, the tagline and one card. Keep text in the middle so crops don't cut it. Upload it in Settings → Social preview; it cannot be scripted. Keep the source next to the screenshot in `docs/assets/` so it can be regenerated.
4. **GitHub and repo: one description everywhere.** Pick one sentence and use it as the GitHub About description and in `package.json` `description` (npm search reads it). The README keeps its short tagline as the heading line.
5. **GitHub: settings.** `gh repo edit crow-rojas/ownship --homepage https://www.npmjs.com/package/ownship --enable-wiki=false` (the wiki is enabled and empty; an empty tab looks abandoned).

### Do with the next release

6. **npm: provenance through trusted publishing.** Publish from a workflow on tag push with `id-token: write`, registered as the Trusted Publisher in the package's npm settings, and stop publishing from a laptop. (An uncommitted `.github/workflows/release.yml` doing this was already in the working tree when this note was written.) The workflow lives in `.github/workflows/`, which `bin/guard.mjs` guards, so it needs the maintainer's `Guard-Override:` trailer. After the first release through it, check that the version shows the green check on npmjs.com.
7. **npm: publish 0.1.1** so the README changes and the image appear on npmjs.com, and `npm deprecate ownship@0.0.0-stage "Staging build, use the latest version."` (unpublishing is also possible until 2026-11-01 12:06 UTC, 72 hours after it was published).
8. **GitHub: releases stay as they are.** `gh release create vX.Y.Z --notes-file <the CHANGELOG section>`. Do not switch to `--generate-notes`.

### Later, when there is a reason

9. Badges: at most npm version and CI, if they are wanted at all.
10. A light/dark pair of screenshots (the app has a dark theme): only with **absolute** `srcset` URLs, because npm does not rewrite relative ones.
11. A short demo GIF or video of the loop (agent turn finishes, card appears on the phone) after the design pass, made reproducibly, VHS-style, for the terminal half.
12. `docs/README.md` as a ten-line index that labels `specs/`, `plans/`, `adr/` and `research/` as design docs, if people start landing in `docs/` from search.
13. `ACCESSIBILITY.md` after the design pass, when there is something concrete to say about the app.

### Don't

- A docs site, a wiki, or empty Diátaxis folders.
- Alerts (`> [!NOTE]`) or Mermaid in the README: npm shows the first as literal text and probably the second as code.
- A hand-written table of contents: GitHub generates one.
- More than two badges, or any badge for something the sidebar already shows.
- `CITATION.cff`, `FUNDING.yml`, `SUPPORT.md` or Discussions before there is someone to use them.
- A Spanish README. The app is bilingual; the repo is English (rule 1), and a second README drifts.
- `<picture>` with relative `srcset`, or screenshots made from a real repo.
