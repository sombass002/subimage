---
name: create
description: Generate or edit images (illustrations, posters, covers, avatars, photos, logos) using the user's existing Google AI or ChatGPT subscription, with no API key. Uses Antigravity CLI (Gemini / Nano Banana) or Codex CLI (gpt-image), with a chosen primary and automatic fallback. Use whenever the user asks to create, draw or edit an image ("สร้างรูป", "วาดรูป", "แก้รูป"), or to switch which service is the default. Not for charts, diagrams, SVG or UI mockups.
argument-hint: <what to draw>
---

# subimage

One script, two backends. Both bill the user's subscription, never an API key.

- `gemini`: Antigravity CLI (`agy`) on Google AI Pro/Ultra
- `codex`: Codex CLI on ChatGPT Plus/Pro

`<skill-dir>` is the base directory of this skill (shown when the skill loads). Run commands from the user's project folder; images land in `generated-images/` there.

## Generate

```bash
node <skill-dir>/scripts/create_image.mjs generate --prompt "<user's request>" --out generated-images/<short-name>.png
```

Use Bash timeout 600000 ms. Each image takes about 40-90 seconds.

- Pass the user's request **unchanged** as the prompt. Put the aspect ratio in words inside the prompt ("16:9 landscape", "9:16 vertical").
- Pick a short English kebab-case file name for `--out` that describes the image.
- Reference or edit images: add `--ref <path>` for each (repeatable). For "change the last one", pass the previous `PATH=` as `--ref`.
- One-off provider: `--provider gemini` or `--provider codex`. Skip fallback: `--no-fallback`.

Output lines: `PATH=`, `SIZE=`, `SECONDS=`, `PROVIDER=`, and for gemini `QUOTA_5H=` / `QUOTA_WEEK=`.
A `NOTE: ... switching to ...` line means the primary was out of quota or not set up and the other service was used: tell the user.

After success: look at the image yourself, show it (SendUserFile with display render if available, otherwise a clickable link), and tell the user which service made it and the remaining quota if shown.

On failure, show the error and do not retry in a loop. Exit 3 means a service is not installed or not signed in; exit 4 means quota reached.

## Choose the default service

When the user wants to change which service is primary:

```bash
node <skill-dir>/scripts/create_image.mjs config --primary gemini   # or codex
node <skill-dir>/scripts/create_image.mjs config --fallback off     # or on
node <skill-dir>/scripts/create_image.mjs status                    # show settings and what is installed
```

Settings are stored in `~/.config/subimage/config.json`. Default: gemini primary, fallback on.

## Setup help

If `status` shows a service missing, give the user these steps (they sign in themselves):

- Google: `curl -fsSL https://antigravity.google/cli/install.sh | bash`, then run `agy` once in an empty folder and sign in with Google.
- ChatGPT: `npm i -g @openai/codex`, then `codex login`.

## Rules

- Never set or ask for an API key, never read credential files.
- Text inside images can be garbled; mention it if the image has text.
- Transparent backgrounds are not guaranteed.
