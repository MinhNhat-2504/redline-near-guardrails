# Publication review — 2026-11-10

Status: PREPARING, not yet public or submission-ready. Owner explicitly authorized public visibility and confirmed permission from the inherited project's rights holders in chat. Owner approved MIT for new NEAR contributions only, copyright Trinh Ngoc Minh Nhat. Root LICENSE and LICENSE_SCOPE.md implement that scope; inherited work is not relicensed.

## Scope and evidence

- Repository: `MinhNhat-2504/redline-near-guardrails`, current branch `feat/near-mvp`.
- GitHub connector verified repository PRIVATE and authenticated account admin permission. Profile matches repository owner. No credential values read or printed.
- Remote `main` is original baseline `aa0b0b044d9b6e01b71a14791ec68b24385e098b`; remote development branch was `f3ac5758f1096233816547fd30ee885755e8fa12` before this task. Publishing alone would expose an obsolete default README. The latest NEAR branch must be pushed and become the reviewed entry point; do not overwrite the original history or use force push.
- Git transport authentication now works: read-only `ls-remote` and `fetch origin` succeeded. Earlier authentication blockers are historical, not proof of a current Git failure.
- Available GitHub connector supports repository reads but no repository-settings mutation. No `gh` executable found in PATH. Do not extract a stored Git token to bypass this limitation. Visibility/default-branch changes may require owner operation in GitHub Settings after review.
- Initial expanded pattern scan: 1,387 unique reachable/index blobs, zero findings, one exact reviewed inherited TESTONLY fixture. Final index/history scan must be recorded after staging. `scripts/scan-secrets.py` now covers Google API keys and additional provider patterns, using batched Git reads. Scans never print matched values.
- Scan covers locally reachable fetched Git refs and index; not GitHub issues, Actions artifacts/secrets, deleted/unreachable remote objects, forks or unknown credential formats. It is not a guarantee that no secret exists. No automatic history rewrite or credential rotation performed.
- `.env`, `.env.*` except `.env.example`, `.tooling/`, wallet keypair filenames and build outputs are ignored. Owner-modified `docs/evidence/phase3-owner-cli-login.json` remains unstaged and excluded from publication changes. Public account IDs, public keys, transaction signatures and receipt hashes are not private signing keys.

## License and attribution

No root LICENSE was found in the imported baseline or current tracked tree. Owner confirmed permission to disclose/license the inherited work. Owner explicitly approved the revised personally owned MIT scope. Root LICENSE covers new NEAR contributions as explained in LICENSE_SCOPE.md; no blanket MIT assertion is made for inherited code/assets. The earlier proposal is retained as review history.

Original CSaCLAB authors remain credited in README and `README_SOLANA.md`. Existing shadcn/UI and Unsplash notices remain in ATTRIBUTIONS.md. Original visual assets, fonts and dependency terms must not be overwritten by an assertion that all third-party work is owned by this project. The available inherited notices do not establish a complete asset-by-asset license audit.

## Release gates

| Gate | Current evidence |
| --- | --- |
| NEAR README/legacy separation | Rewritten for actual NEAR behavior; original baseline README preserved separately. Local links PASS; source/cache installation428/632 tests and both builds/typechecks PASS. |
| Public chain proof | Archived real ALLOW/rejections, funding/create/revoke and browser withdrawal FINAL receipts; historical snapshots not live metrics. |
| Secret pattern review | Fetched refs plus index pattern scan passed1,394 blobs before final license/evidence staging; repeat required before push. Local private runtime files not opened. |
| Licensing | Owner permission confirmed; MIT for new personally owned NEAR work approved and installed; inherited/third-party terms preserved. |
| Remote contents | Fetch/read succeeded; latest local changes not yet pushed. |
| Visibility/default entry | PRIVATE/main baseline at review time; not public PASS. |
| Anonymous repo/clone | NOT RUN until visibility changed. |
| Final hosted CI | Not established for submission commit. |
| X demo/form submission | Not authorized by this task; not done. |

## Product assessment

Credible technical Testnet prototype: bounded key authority, real asynchronous accounting/receipts, replay/revoke denial evidence and owner-controlled withdrawal distinguish it from a mock dashboard. Owner browser walkthrough and recent history fixes improve usefulness. No numeric score or prize prediction is justified.

Not yet a polished publicly reproducible release: local Docker/API/executor setup is demanding; no hosted NEAR demo; mobile/keyboard acceptance remains incomplete; no-hash ambiguity deliberately requires operator review; optional Gemini is unreliable; scoped history is incomplete; asset licensing provenance and final GitHub entry/CI still need closure. These limits belong in the README and video, not hidden behind broad “live” claims.

Priority before deadline: (1) license/public/default-branch/CI and reproducible README, (2) a short evidence-led video showing ALLOW, rejection, revoke and withdrawal, (3) fix demonstrated mobile/navigation defects. Avoid adding marketplace/cross-chain scope or paying for repeated model retries.


Owner clarification: the new repository/project and submission belong to Trinh Ngoc Minh Nhat individually, not the original CSaCLAB team. Old author names appear solely as source attribution. Owner approved revised MIT only for new NEAR contributions on2026-11-10; original group is not the new project license holder.


## Verified source reproduction and release preparation

Source-only tree7d6d1d326192f67d1586e31d7f42aceb5daee371 installed frontend/backend offline using npm cache, without copying .env/.tooling/.git or starting an API/indexer. Frontend428 tests/39files, backend632 tests/41files, both typechecks and production builds PASS. Backend build generated Prisma in isolated checkout; owner live files/DB were not modified. Logs/report phase6-clean-*. This snapshot preceded final documentation/license-only refinements; application code did not change. No new browser/mobile, online newcomer, Postgres integration, Rust/sandbox or live model acceptance inferred. Existing wallet529kB build warning retained.

Local links checked for README, inherited README and publication review: zero missing local targets. External URL/heading anchors are not fully covered. Root README now distinguishes current Testnet receipts from historical snapshots; optional Gemini is not a requirement for core reproduction. LICENSE_SCOPE.md limits personally owned MIT to new NEAR work; original team is credited solely as inherited source, not current team/project owner.


2026-11-10 final pre-push index/history pattern scan: 1412 unique blobs,0 findings; exact inherited TESTONLY exception retained. Evidence phase6-publication-final-secret-scan.json. Ignores confirmed for local .env, backend/.env, executor credential and CLI session paths without opening them. Ready for commit/push of reviewed documents/license, not yet PUBLIC verification.
