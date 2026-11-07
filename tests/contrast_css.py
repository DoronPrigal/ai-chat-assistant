import re
import sys

css = open(sys.argv[1], encoding="utf-8").read()


def block(selector):
    start = css.index(selector + " {")
    body = css[start:css.index("}", start)]
    return dict(re.findall(r"--([\w-]+):\s*([^;]+);", body))


def lum(h):
    rgb = [int(h[i:i + 2], 16) / 255 for i in (1, 3, 5)]
    rgb = [c / 12.92 if c <= 0.03928 else ((c + 0.055) / 1.055) ** 2.4 for c in rgb]
    return 0.2126 * rgb[0] + 0.7152 * rgb[1] + 0.0722 * rgb[2]


def ratio(a, b):
    la, lb = sorted([lum(a), lum(b)], reverse=True)
    return (la + 0.05) / (lb + 0.05)


def blend(rgba, base):
    """צבע הזכוכית בפועל: rgba מעל צבע הרקע."""
    r, g, b, a = [float(x) for x in re.findall(r"[\d.]+", rgba)]
    br, bg, bb = [int(base[i:i + 2], 16) for i in (1, 3, 5)]
    return "#" + "".join(f"{round(c * a + o * (1 - a)):02x}" for c, o in ((r, br), (g, bg), (b, bb)))


def check(name, values):
    v = dict(values)
    v["glass"] = blend(v["glass-bg"], v["color-bg"])
    v["white"] = "#ffffff"

    # צבעי ההתחלה והסוף של כל גרדיאנט (משתנים או צבעים קבועים)
    def stops(grad):
        if "var(" in grad:
            return [v[name] for name in re.findall(r"var\(--([\w-]+)\)", grad)]
        return re.findall(r"#[0-9a-fA-F]{6}", grad)

    v["btn-start"], v["btn-end"] = stops(v["gradient"])
    v["title-start"], v["title-end"] = stops(v["gradient-text"])
    pairs = [
        ("text", "bg", 4.5), ("text", "surface", 4.5), ("text", "bubble-user", 4.5), ("text", "bg-subtle", 4.5),
        ("text", "code-bg", 4.5), ("text", "glass", 4.5),
        ("text-muted", "bg", 4.5), ("text-muted", "surface", 4.5), ("text-muted", "bubble-user", 4.5),
        ("text-muted", "bg-subtle", 4.5), ("text-muted", "glass", 4.5),
        ("primary", "bg", 4.5), ("primary", "surface", 4.5), ("primary", "bg-subtle", 4.5), ("primary", "glass", 4.5),
        ("danger", "danger-bg", 4.5),
        ("white", "btn-start", 3), ("white", "btn-end", 3),
        ("title-start", "bg", 3), ("title-end", "bg", 3),
    ]
    special = ("glass", "white", "btn-start", "btn-end", "title-start", "title-end")
    print(f"--- {name} (glass = {v['glass']}) ---")
    ok_all = True
    for fg, bg, need in pairs:
        f = v[fg] if fg in special else v["color-" + fg]
        b = v[bg] if bg in special else v["color-" + bg]
        r = ratio(f, b)
        ok_all &= r >= need
        label = "gradient/focus/icon (3:1)" if need == 3 else ""
        print(f"{'PASS' if r >= need else 'FAIL'}  {r:5.2f}:1  {fg} on {bg} {label}")
    return ok_all


light = block(":root")
dark = block(':root[data-theme="dark"]')
ok = check("light", light)
# בכהה, הגרדיאנט של הכותרות מוגדר בצבעים קבועים
d = dict(dark)
ok &= check("dark", d)
print("ALL PASS" if ok else "SOME FAIL")
