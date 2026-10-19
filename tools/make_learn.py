#!/usr/bin/env python3
"""
Turns the Vipassana Concept page into learn.html for the app.

    python3 tools/make_learn.py                     # uses tools/concept-source.html
    python3 tools/make_learn.py ~/Downloads/Vipassana_Concept.html

What it changes (the animations themselves are untouched):
  - loads GSAP and the fonts from the app's own folder instead of the internet, so it works offline
  - hides the page's own tab bar; the app's menu picks the section instead
  - opens the section named in the address (#concept, #vp, #hi, #gu, #tt, #fe) or sent by the app
  - adds phone layouts for portrait and landscape
"""
import os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
src = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, "tools", "concept-source.html")
html = open(src, encoding="utf-8").read()

# 1. fonts from the app folder
html = re.sub(r'<link rel="preconnect"[^>]*>\s*', "", html)
html = re.sub(r'<link rel="stylesheet" href="https://fonts\.googleapis\.com[^>]*>\s*', "", html)
FONTS = """<style>
@font-face{font-family:"Bricolage Grotesque";src:url(fonts/bricolage-grotesque-latin-500-normal.woff2) format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"Bricolage Grotesque";src:url(fonts/bricolage-grotesque-latin-700-normal.woff2) format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Bricolage Grotesque";src:url(fonts/bricolage-grotesque-latin-800-normal.woff2) format("woff2");font-weight:800;font-display:swap}
@font-face{font-family:"Figtree";src:url(fonts/figtree-latin-400-normal.woff2) format("woff2");font-weight:400;font-display:swap}
@font-face{font-family:"Figtree";src:url(fonts/figtree-latin-500-normal.woff2) format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"Figtree";src:url(fonts/figtree-latin-600-normal.woff2) format("woff2");font-weight:600;font-display:swap}
@font-face{font-family:"Figtree";src:url(fonts/figtree-latin-700-normal.woff2) format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Figtree";src:url(fonts/figtree-latin-800-normal.woff2) format("woff2");font-weight:800;font-display:swap}
@font-face{font-family:"Caveat";src:url(fonts/caveat-latin-500-normal.woff2) format("woff2");font-weight:500;font-display:swap}
@font-face{font-family:"Caveat";src:url(fonts/caveat-latin-700-normal.woff2) format("woff2");font-weight:700;font-display:swap}
@font-face{font-family:"Tiro Devanagari Hindi";src:url(fonts/tiro-devanagari-hindi-devanagari-400-normal.woff2) format("woff2");unicode-range:U+0900-097F,U+1CD0-1CF9,U+200C-200D,U+20A8,U+20B9,U+25CC,U+A830-A839,U+A8E0-A8FF;font-display:swap}
@font-face{font-family:"Tiro Devanagari Hindi";src:url(fonts/tiro-devanagari-hindi-latin-400-normal.woff2) format("woff2");unicode-range:U+0000-00FF,U+2000-206F;font-display:swap}
</style>
"""
html = html.replace("<title>", FONTS + "<title>", 1)

# 2. GSAP from the app folder
html, n = re.subn(r'<script src="https://cdnjs\.cloudflare\.com/ajax/libs/gsap/[^"]+"></script>',
                  '<script src="vendor/gsap.min.js"></script>', html)
assert n == 1, "GSAP script tag not found"

# 3. layout for phones, and the app's menu instead of the page's tab bar
CSS = """
/* --- added for the app --- */
.tabs{display:none}
.head{border-bottom:0;padding-bottom:0;justify-content:flex-start}
body:not([data-section="concept"]) .head{display:none}
.rotate-hint{display:none;align-items:center;gap:8px;font:600 12px/1.3 var(--f-body);color:var(--muted)}
/* leave room for the caption below the picture (and the example tabs on Concept) at every screen size */
.wrap{width:min(100%,calc((100dvh - 170px)*16/9))}
body[data-section="concept"] .wrap{width:min(100%,calc((100dvh - 225px)*16/9))}
.rotate-hint svg{flex:none}
/* dark theme, following the app's switch: the page goes dark; the drawings keep their colours (their text is dark ink on light scenery) and are dimmed a little */
html.dark{color-scheme:dark}
html.dark body{background:#111513;color:#E5E8E3}
html.dark .sub{background:#191E1B;border-color:#2C3330;color:#A3ADA6}
html.dark .sub[aria-selected="true"]{background:#E5E8E3;border-color:#E5E8E3;color:#111513}
html.dark .kicker{color:#5FC4B6}
html.dark .kicker .n,html.dark .rotate-hint{color:#99A39C}
html.dark .text{color:#E5E8E3}
html.dark .ctrl{background:#191E1B;border-color:#2C3330;color:#E5E8E3}
html.dark .ctrl.primary{background:#E5E8E3;border-color:#E5E8E3;color:#111513}
html.dark .dot{background:#2F3733}
html.dark .dot.done{background:#6F7A73}
html.dark .dot.on{background:#E5E8E3}
html.dark .stage{border-color:#2C3330;filter:brightness(.88)}
@media (max-width:760px) and (orientation:portrait){
  body{padding-block:10px;gap:8px;justify-content:flex-start}
  .wrap,body[data-section] .wrap{width:100%;gap:10px}
  .stage{border-radius:12px}
  .sub{padding:8px 12px;font-size:13px}
  .bar{gap:12px}
  .cap{flex-basis:100%}
  .ctrls{width:100%;justify-content:space-between}
  .dots{max-width:none;flex:1}
  .text{font-size:15px}
  .rotate-hint{display:flex}
}
@media (max-height:520px) and (orientation:landscape){
  body{padding-block:6px;gap:6px}
  .wrap{width:min(100%,calc((100dvh - 92px)*16/9));gap:6px}
  body[data-section="concept"] .wrap{width:min(100%,calc((100dvh - 124px)*16/9))}
  .sub{padding:5px 10px;font-size:12px}
  .bar{flex-wrap:nowrap;gap:10px}
  .text{font-size:13px;line-height:1.3;margin-top:3px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
  .kicker{font-size:10px}
  .ctrl{width:36px;height:36px}
  .dots{display:none}
}
"""
html, n = re.subn(r"</style>(\s*<div class=\"wrap\">)", CSS + r"</style>\1", html, count=1)
assert n == 1, "main stylesheet not found"

# 4. section control: #hash on load, hashchange, or a message from the app
CTRL = """
<script>
(function(){
  var keys = ["concept","vp","hi","gu","tt","fe"];
  var bar = document.querySelector(".bar");
  var hint = document.createElement("div");
  hint.className = "rotate-hint";
  hint.innerHTML = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="7" y="2" width="10" height="20" rx="2"/><path d="M3 13a9 9 0 0 0 7 7M21 11a9 9 0 0 0-7-7"/></svg>Turn your phone sideways for a bigger view.';
  bar.parentNode.appendChild(hint);
  function open(k){
    if (keys.indexOf(k) < 0) k = "concept";
    var b = document.querySelector('.tab[data-tab="' + k + '"]');
    if (b) b.click();
    document.body.setAttribute("data-section", k);
  }
  window.addEventListener("hashchange", function(){ open(location.hash.slice(1)); });
  window.addEventListener("message", function(e){
    if (!e.data) return;
    if (e.data.learnTheme) document.documentElement.classList.toggle("dark", e.data.learnTheme === "dark");
    if (e.data.learnSection) open(e.data.learnSection);
  });
  if (/[?&]theme=dark/.test(location.search)) document.documentElement.classList.add("dark");
  open((location.hash || "#concept").slice(1));
})();
</script>
"""
html = html.rstrip()
html = html + "\n" + CTRL

out = os.path.join(ROOT, "learn.html")
open(out, "w", encoding="utf-8").write(html)
print("Wrote", out)
