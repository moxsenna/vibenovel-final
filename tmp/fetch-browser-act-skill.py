import subprocess
from pathlib import Path

exe = Path(r"C:/Users/bimap/.local/bin/browser-act.exe")
out = subprocess.run(
    [str(exe), "get-skills", "main"],
    capture_output=True,
    text=True,
    timeout=180,
)
print("exit", out.returncode)
if out.stderr:
    print("stderr", out.stderr[:800])
text = out.stdout
if not text.strip():
    raise SystemExit("empty stdout")
paths = [
    Path(r"C:/Users/bimap/.agents/skills/browser-act/SKILL.md"),
    Path(r"C:/Users/bimap/.claude/skills/browser-act/SKILL.md"),
]
for p in paths:
    p.parent.mkdir(parents=True, exist_ok=True)
    p.write_text(text, encoding="utf-8")
    print("wrote", p, "bytes", p.stat().st_size)