# Local reviewer qualification

This is an isolated screening experiment for an advisory reviewer. It has no queue credentials, tool calls, deployment capability, acceptance endpoint or automatic approval authority. Native Claude/Codex subscription calls are not involved. Independent provider QA and trusted release checks remain required regardless of the local score.

The earlier small-model routing baseline used short factual labels and did not qualify a code reviewer. This experiment instead pairs two actual code-backed defects with two correct controls. Executable fixture oracles establish the expected behavior independently of model answers:

- Archive examples: the accepted `convex/intelligence.ts` key retains person, platform, month and format. The mutation removes month, reproducing the fixed historical-evidence collapse. Test posts from May 2013 and October 2026 expose the difference.
- Writable paths: the accepted `product-release.mjs` comparison distinguishes exact files from directories with trailing slashes. The mutation accepts arbitrary string prefixes, incorrectly permitting `src/card.ts.backup` when only `src/card.ts` is allowed.

The model receives only a requirement and one standalone JavaScript fixture. It does not receive the expected classification, oracle result, task state, credential, source history or other cases. Each answer must give a concrete code-based reason; a correct label alone is insufficient. Canonical source hashes and raw stdout/stderr are retained privately. The harness refuses stale fixture construction if the expected source expressions change.

## Verified model and runtime

Primary sources checked during setup:

- [Official Qwen GGUF repository](https://huggingface.co/Qwen/Qwen2.5-Coder-3B-Instruct-GGUF), pinned commit `f74adce6aa16316c625447af059dbebe4983757c`. Q4_K_M file size 2,104,932,800 bytes; SHA-256 `724fb256bec1ff062b2f65e4569e871ad2e95ab2a3989723d1769c54294730b7` verified after download. The model card labels its license `qwen-research`; this document describes it as open weights.
- [Official llama.cpp b11678 release](https://github.com/ggml-org/llama.cpp/releases/tag/b11678), Ubuntu x64 CPU archive size 17,881,035 bytes; published SHA-256 `16122345af3b1c7529ca1d22c36a858eb47e7d80f08a5a3ed3a1357878e55847` verified before extraction.
- [Official llama.cpp CLI documentation](https://github.com/ggml-org/llama.cpp/blob/master/tools/cli/README.md), supplemented by the installed binary's help output to confirm flags. No dependency build or GPU runtime was installed.

The isolated installation is `/opt/orwell-local-reviewer/`; total installed disk use is approximately 2.1 GiB, below the 3 GB download/storage target. Runtime binaries, model and approved prompt copies are root-owned. A dedicated `orwell-local-reviewer` account, UID 994/GID 985, belongs to no provider/model execution group.

## Execution limits

Each case runs serially in a separate transient systemd unit: CPU quota 200%, two inference/prompt threads, MemoryMax 5 GB, TasksMax 24, runtime maximum 60 seconds, inner timeout 58 seconds, and a parent watchdog. Four cases cap local inference at four minutes, below the five-minute authorization. Temperature is zero, seed seven, context 2048 and maximum generated tokens 160. The Qwen ChatML prompt requests JSON and the external parser rejects invalid answers; it supplies no expected classifications.

PrivateNetwork blocks network access; ProtectHome hides provider homes; explicit inaccessible paths hide controller/Paperclip configuration and state. ProtectSystem is strict, NoNewPrivileges is enabled, HOME is `/nonexistent`, and the process receives a minimal environment. A read-permission probe confirmed private controller state is unreadable to this dedicated UID. No production service is stopped or reconfigured by the harness.

The root harness is `scripts/orwell-pilot/local-reviewer-qualification.mjs`, with pure fixture/parser/scoring regressions in the sibling test file. Private evaluation artifacts live under `/tmp/orwell-local-reviewer-qualification/` on the VPS. Only a root-supervised, explicitly authorized `--run` executes local inference. The harness does not connect to the production controller or replace a QA provider.

## Acceptance interpretation

Passing this four-case screen establishes only that these specific controls and mutations were classified with grounded explanations under the recorded resource limits. It does not establish general code review quality, source-research capability, current-fact accuracy or a safe replacement for independent QA. Any timeout, malformed answer, wrong verdict or ungrounded reason holds qualification. Reports distinguish true positives/negatives, false positives/negatives, missing verdicts and failed runs. No score changes release authority.

The completed run is **not qualified**. Both seeded defects were incorrectly called clean. Both correct controls were called clean. This configuration therefore failed to distinguish the regressions and cannot act as a code reviewer or replace independent provider QA.

| Case | Executable ground truth | Local verdict | Wall time | Peak RSS |
| --- | --- | --- | --- | --- |
| Correct month-preserving archive | Clean | Clean | 42.596 s | 3,519,624 KiB |
| Defective filename-prefix permissions | Defect | Clean | 13.295 s | 3,508,624 KiB |
| Defective archive key without month | Defect | Clean | 21.865 s | 3,519,288 KiB |
| Correct exact-file/directory permissions | Clean | Clean | 16.647 s | 3,509,612 KiB |

The observed score is 2/4: zero true positives, two true negatives, two false negatives, zero false positives, and zero missing verdicts in the repaired run. All processes exited zero. The wrong explanations falsely asserted that a plain prefix comparison enforced exact filenames, and that a key containing only person/platform/format preserved monthly examples. Actual counterexamples from the independent oracles contradict both claims.

Repaired-run wall time was 94.403 seconds; maximum peak RSS was approximately 3.36 GiB, within the configured 5 GB cap. Combined with the initial failed runtime attempt below, total wall time was 140.315 seconds, below five minutes. Private raw outputs remain on the VPS, and `scripts/orwell-pilot/local-reviewer-qualification.result.json` preserves the actual structured results and prior-attempt provenance. No further model runs or tuning were performed after this quality failure. The runtime is inactive; the downloaded assets remain available for a separately authorized future experiment.

An initial runtime-interface attempt used the new `llama-cli` JSON grammar sampler, which threw a sampler exception before generating any tokens despite exit status zero. Its four raw receipts remain under `/tmp/orwell-local-reviewer-qualification-attempt-01/`; elapsed wall time was 45.912 seconds, peak RSS 3,496,648 KiB, with no actual model verdicts. These are unavailable classifications, not false-positive or false-negative predictions. One bounded transport repair uses the same official runtime's `llama-completion` with explicit ChatML and no grammar sampler. Requirements, fixtures, expected behavior and quality thresholds are unchanged. Combined attempt wall time remains below five minutes even at the repaired run's configured maximum.
