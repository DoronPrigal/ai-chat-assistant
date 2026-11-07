import shutil
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent / "Backend"))
from agent.graph import SYSTEM_PROMPT, llm_with_tools, to_human_message  # noqa: E402
from config import UPLOADS_DIR  # noqa: E402
from langchain_core.messages import HumanMessage  # noqa: E402

# תמונה זמנית בתיקיית uploads (ותימחק בסוף)
name = "f" * 32 + ".png"
shutil.copy(Path(__file__).resolve().parent / "fixtures" / "sample.png", UPLOADS_DIR / name)
try:
    # רק החלטת המודל (tool_calls), בלי להריץ את הכלי - אין יצירת תמונה ואין עלות של תמונה
    for i in range(3):
        r = llm_with_tools.invoke([SYSTEM_PROMPT, to_human_message("", f"/uploads/{name}")])
        calls = [c["name"] for c in r.tool_calls]
        print(f"image without text #{i + 1}: tool_calls={calls} -> {'PASS' if 'generate_image' not in calls else 'FAIL'} | {r.text[:70]!r}")
    r = llm_with_tools.invoke([SYSTEM_PROMPT, HumanMessage(content="Draw a red apple on a wooden table")])
    calls = [c["name"] for c in r.tool_calls]
    print(f"control 'Draw a red apple': tool_calls={calls} -> {'PASS' if calls == ['generate_image'] else 'FAIL'} (tool NOT executed)")
finally:
    (UPLOADS_DIR / name).unlink()
