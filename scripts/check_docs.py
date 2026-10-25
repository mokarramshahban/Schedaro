"""Read-only documentation consistency checks for Schedaro."""
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
markdown = list(ROOT.glob("*.md")) + list((ROOT / "docs").rglob("*.md"))
errors: list[str] = []

for path in markdown:
    text = path.read_text(encoding="utf-8")
    for target in re.findall(r"\[[^\]]+\]\(([^)#]+)(?:#[^)]+)?\)", text):
        if target.startswith(("http://", "https://", "mailto:")):
            continue
        resolved = (path.parent / target).resolve()
        if not resolved.exists():
            errors.append(f"broken link: {path.relative_to(ROOT)} -> {target}")

index = ROOT / "docs/DECISION_INDEX.md"
if index.exists():
    for target in re.findall(r"\]\((decisions/ADR-[^)]+\.md)\)", index.read_text(encoding="utf-8")):
        if not (ROOT / "docs" / target).exists():
            errors.append(f"missing indexed ADR: {target}")

secret_patterns = [r"postgresql(?:\+\w+)?://[^\s`]+:[^\s`]+@", r"(?:password|secret|token)\s*[:=]\s*['\"][^'\"]{12,}"]
for path in markdown:
    text = path.read_text(encoding="utf-8")
    for pattern in secret_patterns:
        if re.search(pattern, text, re.IGNORECASE):
            errors.append(f"possible secret pattern: {path.relative_to(ROOT)}")
            break

if errors:
    print("Documentation checks failed:")
    print("\n".join(f"- {error}" for error in errors))
    raise SystemExit(1)
print(f"Documentation checks passed: {len(markdown)} Markdown files checked.")
