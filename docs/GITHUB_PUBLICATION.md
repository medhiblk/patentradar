# GitHub publication

Target selected by the owner: https://github.com/medhiblk/patentradar . The public repository exists, initialized with Apache 2.0 LICENSE. The original commit/licence will be preserved, and PatentRadar will be added as a clean source snapshot without private portfolio files or internal user-text research outputs.

The owner connected the correct GitHub installation. A subsequent dry-run push succeeded; release publication now proceeds to this exact repository. The earlier HTTP403 is resolved for ordinary git writes.

Code, API/MCP and browser 3D are prepared independently of this external permission. Once access is granted:

```bash
./scripts/publish-github.sh medhiblk/patentradar
```

The script clones the existing repository, preserves its original licence/history, commits a reviewed source snapshot and uses a normal non-force push. Generated WASM assets are prepared from pinned dependencies during npm install, not checked in as binary development artifacts. Credentials, private SQLite data and earlier user-text research outputs are excluded.
