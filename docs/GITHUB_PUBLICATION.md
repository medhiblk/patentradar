# GitHub publication — complete

Source: https://github.com/medhiblk/patentradar . The owner’s initial commit and Apache 2.0 LICENSE were preserved. Application code was published as a clean source snapshot in commit `2ef9bc96ed7ca8b76a5d2977ab57b5e2559c00c3`. Private account databases, credentials and earlier user-text research outputs were excluded.

GitHub Actions source validation passed: https://github.com/medhiblk/patentradar/actions/runs/40185950508 . The earlier HTTP403 was resolved after the owner connected the correct GitHub installation. No other repository was used.

The production website/API/MCP are live at https://patentradar-puce.vercel.app . Browser 3D is directly testable at /engineering without Python, an account or an API key. API documentation is at /developers and /api/v1/openapi.json. The user-facing working identity is FormaProof; repository and API/MCP identifiers remain compatible.

The local development history is separate from the clean published snapshot. Do not force-push that private history. Use a fresh clone of the published repository or the clean snapshot publisher. Dependency WASM is prepared from pinned packages during npm install and is not committed as a generated binary.

GitHub setup for future repository permissions: https://github.com/settings/installations . Select the ChatGPT GitHub application on the correct account and authorize this repository. No tokens should be pasted into chat.
