#!/usr/bin/env python3
"""Validate the exact static Pages payload without network access or dependencies."""
from html.parser import HTMLParser
from pathlib import Path
from urllib.parse import unquote, urlsplit
import sys


class Document(HTMLParser):
    def __init__(self):
        super().__init__()
        self.ids = set()
        self.links = []

    def handle_starttag(self, tag, attrs):
        attrs = dict(attrs)
        if attrs.get("id"):
            self.ids.add(attrs["id"])
        for name in ("href", "src"):
            if attrs.get(name):
                self.links.append(attrs[name])


def validate(root):
    root = root.resolve()
    if not (root / "index.html").is_file():
        raise ValueError("Pages payload is missing site/index.html")
    documents = {}
    for path in root.rglob("*"):
        if path.is_symlink():
            raise ValueError(f"Pages payload must not contain symlinks: {path}")
        if path.name.startswith(".env"):
            raise ValueError(f"Environment file must not be published: {path}")
        if path.suffix == ".html":
            document = Document()
            document.feed(path.read_text(encoding="utf-8"))
            documents[path] = document
    for path, document in documents.items():
        for raw in document.links:
            link = urlsplit(raw)
            if link.scheme or link.netloc:
                continue  # External availability does not gate this static build.
            # Pages is hosted below /patentradar/, so root-absolute assets are invalid.
            if link.path.startswith("/"):
                raise ValueError(f"Use relative links for the Pages project path: {raw}")
            target = (path.parent / unquote(link.path)).resolve() if link.path else path
            if not target.is_relative_to(root):
                raise ValueError(f"Local reference escapes the uploaded Pages payload: {raw}")
            if target.is_dir():
                target = target / "index.html"
            if not target.is_file():
                raise ValueError(f"Broken local reference in {path.name}: {raw}")
            if link.fragment and target in documents and unquote(link.fragment) not in documents[target].ids:
                raise ValueError(f"Missing fragment in {target.name}: {raw}")
    print(f"Validated {len(documents)} HTML document(s) in {root.name}; local assets and anchors resolve.")


if __name__ == "__main__":
    try:
        validate(Path(sys.argv[1] if len(sys.argv) > 1 else "site"))
    except (OSError, ValueError) as error:
        sys.exit(str(error))
