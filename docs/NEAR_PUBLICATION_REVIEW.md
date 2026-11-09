# Publication review — 2026-11-10

Status: PUBLIC SOURCE VERIFIED; full hackathon submission remains incomplete. Owner explicitly authorized public visibility and confirmed permission from the inherited project's rights holders in chat. Owner approved MIT for new NEAR contributions only, copyright Trinh Ngoc Minh Nhat. Root LICENSE and LICENSE_SCOPE.md implement that scope; inherited work is not relicensed.

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
| Remote contents | Atomic fast-forward push succeeded; main/feat/near-mvp both51764fd, new main README verified through GitHub. |
| Visibility/default entry | PUBLIC/main NEAR README verified after owner visibility change; see final checkpoint below. |
| Anonymous repo/clone | PASS shallow main clone with credential helpers/config disabled at08493cc. |
| Final hosted CI | NEAR frontend/backend/Postgres/contract/sandbox success at51764fd; later docs-only commits have no same-SHA CI claim. |
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


## 2026-11-10 - Remote entry point synchronized

Commit51764fd1e13ccb4663c55479b0a0addc7a69c62f pushed atomically and without force to origin feat/near-mvp and main. ls-remote independently returns this SHA for both; baseline remains an ancestor. GitHub connector confirms default branch main and retrieves the new NEAR README there. PRIVATE remains the latest verified visibility; admin confirmed but connector exposes no settings mutation and gh is unavailable. Owner was given the exact Settings/General/Danger Zone/Change repository visibility path. No extra permission is needed for the already-authorized publication, but owner must operate that missing UI capability. Anonymous access/clone not yet verified, no PUBLIC PASS.

Combined status tool returned no status records; this is not hosted CI PASS or proof that no Actions runs exist. Evidence phase6-github-release-checkpoint.json. Do not retry tokens or extract Git credentials. No runtime keys/env/session read. Final current publication status supersedes the earlier pending-push entries; license already approved/installed and source checks passed. Submission still requires visibility verification, video/X and final form; no new financial action needed.


## 2026-11-10 - Public repository and hosted NEAR CI verified

Owner reported changing visibility. Authenticated connector independently returned public/default main. Anonymous urllib GitHub API (no Authorization/cookie) returned private=false. A new shallow main clone with global/system Git config, credential helper and askpass disabled completed exit0 at08493cc901926be09cf6197a9e7ff73427ddc042; README/LICENSE/LICENSE_SCOPE were readable from cloned Git objects. No checkout or runtime code executed by that clone; source/cache installation proof remains separate. Evidence phase6-public-anonymous-verification.json includes exact scope, run URLs and job/step metadata.

Hosted NEAR CI at application/docs commit51764fd1e13ccb4663c55479b0a0addc7a69c62f is VERIFIED_SUCCESS: frontend run42718065422 (npm ci/check), backend42718065531 (tests/typecheck/build plus additive migration/Postgres tests), contract42718065511 (SDK tests/WASM and actual local receipt sandbox step). Job metadata/step outcomes were read, not full logs/artifact counts. Later08493cc is docs-only; no same-SHA CI claimed for it. Earlier empty combined-status response did not mean no Actions runs; public Actions API now supplies the missing evidence. No professional audit or automatic wallet/mobile acceptance inferred.

Public visibility/anonymous main source access and reviewed license/credits now PASS within the specified scope; previous PRIVATE/pending-auth/hosted-CI gaps are superseded. Phase4/5 remain PARTIAL for broader browser/recovery/provider acceptance, and Phase6 still needs video/X/form submission. No new credential read, model call, financial signature, transaction or deployment. Documentation-only update: tests/build not rerun.
