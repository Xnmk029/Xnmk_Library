# [DeepSWE](https://deepswe.datacurve.ai/)

DeepSWE is a benchmark for measuring frontier coding agents on original, long-horizon software engineering tasks drawn from active open-source repositories. The benchmark includes 113 tasks across TypeScript, Go, Python, JavaScript, and Rust, with isolated environments and program-based verifiers.

## Task format

DeepSWE tasks use the [Harbor](https://www.harborframework.com/docs/tasks) task format:

```text
task.toml         Metadata (repo, base commit, language, image, limits)
instruction.md    The prompt the agent sees
pre_artifacts.sh  Captures the agent's committed work as a patch
environment/      Dockerfile reproducing the prebuilt image
tests/            Verifier entry point, held-out tests, and grader config
solution/         Reference solution (held out from the agent)
```

The verifier exercises the behavior the prompt describes. It accepts any solution whose observable behavior is correct, regardless of internal symbol names or structure.
The reference patch in `solution/` is never used at grading time; it exists so reviewers can spot-check correctness offline.

Since v1.1, grading uses Harbor's [separate verifier environment](https://www.harborframework.com/docs/tasks#verifier-environment-shared-vs-separate), requiring [Pier >=0.3.0](https://pypi.org/project/datacurve-pier/). The agent works in an isolated environment and commits its work upon completion. Pier then runs a `pre_artifacts.sh` script to extract these commits as a patch, which is applied and graded in a pristine container.

The verifier produces the following outputs for each run:

```text
verifier/
    reward.json      Structured scores (binary reward + pass fractions)
    ctrf.json        Machine-readable test report with failure messages
    test-stdout.txt  Raw suite output and a list of failure reasons
    run.log          Raw stdout/stderr captured during the run
    reports/         Framework-native report/log files from the grader
```

## Quickstart

Use [Pier](https://github.com/datacurve-ai/pier) to run the benchmark:

```bash
git clone https://github.com/datacurve-ai/deep-swe
uv tool install datacurve-pier

# Claude Opus 4.8
export ANTHROPIC_API_KEY=...
pier run -p deep-swe/tasks --agent mini-swe-agent --model anthropic/claude-opus-4-8

# GPT-5.5
export OPENAI_API_KEY=...
pier run -p deep-swe/tasks --agent mini-swe-agent --model openai/gpt-5.5
```

## What is Pier

[Pier](https://github.com/datacurve-ai/pier) is a [Harbor](https://www.harborframework.com/docs/tasks)-compatible framework for sandboxed coding-agent evals. It began as a fork of Harbor to support CLI agents in air-gapped tasks: Harbor blocks all outbound traffic in `allow_internet = false` tasks, including dependency installs and LLM API calls. Pier adds per-agent network allowlists, giving agents only the network access they need while keeping the task environment isolated.

Pier also adds more complete trajectory metadata, a better trajectory viewer, and `pier critique run` for analyzing agent trajectories. All leaderboard scores were produced with Pier running `mini-swe-agent` on Modal.

### Agents and models

`mini-swe-agent` is model-agnostic. Pier also drives `claude-code`, `codex`, `gemini-cli`, and `opencode` directly. Pass `--env modal` to run in parallel sandboxes on Modal.

### Subsets and single tasks

Deterministic random subset of the 113-task corpus:

```bash
pier run -p deep-swe/tasks --agent mini-swe-agent --n-tasks 10 --sample-seed 0
```

Single task:

```bash
pier run -p deep-swe/tasks/<task-id> --agent mini-swe-agent
```

