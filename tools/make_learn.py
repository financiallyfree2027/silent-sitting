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
# Sideways layout: the picture takes the full height, with caption, controls and menu in a
# column beside it. Used when the phone is turned (landscape) and for the "Bigger view" button
# in portrait, which shows the same layout turned 90 degrees on screen.
SIDE = """
$P{padding:0;overflow:hidden;--side:clamp(150px, calc(var(--W) - (var(--H) - 16px) * 16 / 9 - 40px), 300px)}
$P .wrap{display:grid;grid-template-columns:auto var(--side);grid-template-rows:auto auto minmax(0,1fr);grid-template-areas:"stage nav" "stage head" "stage bar";column-gap:12px;row-gap:8px;width:var(--W);height:var(--H);max-width:none;padding:8px 10px 8px 8px;box-sizing:border-box;align-items:start}
$P .stage{grid-area:stage;align-self:center;width:min(calc((var(--H) - 16px) * 16 / 9), calc(var(--W) - 30px - var(--side)));height:auto;aspect-ratio:16/9;border-radius:12px}
$P .head{grid-area:head;border:0;padding:0;margin:0}
$P .subtabs{flex-direction:column;align-items:stretch;gap:6px;width:100%}
$P .sub{padding:7px 10px;font-size:12px;text-align:left}
$P .sub b{display:block;margin:0 0 2px}
$P .bar{grid-area:bar;display:flex;flex-direction:column;flex-wrap:nowrap;align-items:stretch;gap:8px;height:100%;min-height:0}
$P .cap{flex:1 1 auto;min-height:0;overflow-y:auto}
$P .text{font-size:13px;line-height:1.4;margin-top:4px;display:block;overflow:visible}
$P .kicker{font-size:10px;flex-wrap:wrap;gap:6px}
$P .ctrls{width:auto;justify-content:space-between;gap:6px;flex:none}
$P .dots{display:none}
$P .ctrl{width:40px;height:40px}
$P .sidenav{display:flex}
$P .rotbtn{display:none}
"""

CSS = """
/* --- added for the app --- */
.tabs{display:none}
.head{border-bottom:0;padding-bottom:0;justify-content:flex-start}
body:not([data-section="concept"]) .head{display:none}
/* leave room for the caption below the picture (and the example tabs on Concept) at every screen size */
.wrap{width:min(100%,calc((100dvh - 170px)*16/9))}
body[data-section="concept"] .wrap{width:min(100%,calc((100dvh - 225px)*16/9))}
/* dark theme, following the app's switch: the page goes dark; the drawings keep their colours (their text is dark ink on light scenery) and are dimmed a little */
html.dark{color-scheme:dark}
html.dark body{background:#111513;color:#E5E8E3}
html.dark .sub{background:#191E1B;border-color:#2C3330;color:#A3ADA6}
html.dark .sub[aria-selected="true"]{background:#E5E8E3;border-color:#E5E8E3;color:#111513}
html.dark .kicker{color:#5FC4B6}
html.dark .kicker .n{color:#99A39C}
html.dark .sidenav button{background:#191E1B;border-color:#2C3330;color:#E5E8E3}
html.dark body.rot .wrap{background:#111513}
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
  body .rotbtn{display:flex}
}
%%SIDE%%
"""
side_css = ("@media (max-height:520px) and (orientation:landscape){\nbody[data-section]{--W:100vw;--H:100dvh}\n"
            + SIDE.replace("$P", "body[data-section]") + "}\n"
            + "body.rot{--W:100dvh;--H:100vw;overflow:hidden}\n"
            + "body[data-section].rot .wrap{position:fixed;top:0;left:0;z-index:5;background:var(--paper);transform-origin:top left;transform:translateX(100vw) rotate(90deg)}\n"
            + SIDE.replace("$P", "body[data-section].rot"))
CSS = CSS.replace("%%SIDE%%", "") + """
.sidenav{display:none;grid-area:nav;justify-content:space-between;gap:8px}
.sidenav button{width:38px;height:38px;border-radius:10px;border:1.5px solid var(--line);background:var(--card);color:var(--ink);display:grid;place-items:center;cursor:pointer}
.sidenav svg{width:18px;height:18px}
.rotbtn{display:none;align-items:center;justify-content:center;gap:8px;width:100%;border:0;border-radius:12px;padding:12px 14px;background:var(--calm);color:#fff;font:700 15px/1.2 var(--f-body);cursor:pointer}
.rotbtn svg{flex:none}
""" + side_css
html, n = re.subn(r"</style>(\s*<div class=\"wrap\">)", lambda m: CSS + "</style>" + m.group(1), html, count=1)
assert n == 1, "main stylesheet not found"

# 4. section control: #hash on load, hashchange, or a message from the app
CTRL = """
<script>
(function(){
  var keys = ["concept","vp","hi","gu","tt","fe"];
  var bar = document.querySelector(".bar");
  var wrap = document.querySelector(".wrap");
  function tell(msg){ try { if (window.parent !== window) window.parent.postMessage(msg, "*"); } catch (e) {} }
  // menu and close for the sideways layout, where the app's own top bar is hidden
  var nav = document.createElement("div"); nav.className = "sidenav";
  nav.innerHTML = '<button id="sMenu" aria-label="Open menu"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M4 7h16M4 12h16M4 17h10"/></svg></button>'
    + '<button id="sClose" aria-label="Close"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button>';
  wrap.appendChild(nav);
  var rot = document.createElement("button"); rot.className = "rotbtn"; rot.type = "button";
  rot.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 15v5h-5M4 4l6 6M20 20l-6-6"/></svg>Bigger view';
  wrap.appendChild(rot);
  var landscape = matchMedia("(orientation: landscape)");
  function setRot(on){ document.body.classList.toggle("rot", on); tell({ learnFull: on }); }
  rot.addEventListener("click", function(e){ e.stopPropagation(); setRot(true); });
  document.getElementById("sMenu").addEventListener("click", function(e){ e.stopPropagation(); tell({ learnAction: "menu" }); });
  document.getElementById("sClose").addEventListener("click", function(e){
    e.stopPropagation();
    if (document.body.classList.contains("rot")) setRot(false); else tell({ learnAction: "close" });
  });
  // turning the phone itself gives the real sideways layout, so the turned-on-screen view is no longer needed
  (landscape.addEventListener ? landscape.addEventListener.bind(landscape, "change") : landscape.addListener.bind(landscape))(function(){ if (landscape.matches) setRot(false); });
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
