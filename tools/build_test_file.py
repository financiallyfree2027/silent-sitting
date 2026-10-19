#!/usr/bin/env python3
"""Builds 'Open Silent Sitting.html': the whole app with its audio inside one file,
so it can be tested by double-clicking, with no server and no internet."""
import base64, json, os, re
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
rd = lambda p, m="r": open(os.path.join(ROOT, p), m, encoding=None if "b" in m else "utf-8").read()
b64 = lambda p: base64.b64encode(rd(p, "rb")).decode()

css = rd("styles.css")
css = re.sub(r"url\((fonts/[^)]+\.woff2)\)", lambda m: f"url(data:font/woff2;base64,{b64(m.group(1))})", css)
clips = json.loads(rd("clips.json"))
files = {"clips.json": base64.b64encode(json.dumps(clips).encode()).decode()}
for c in clips["clips"].values():
    files[c["file"]] = b64(c["file"])

app = rd("app.js")  # app.js handles the test copy itself (window.__STANDALONE)

shim = """<script>
window.__STANDALONE = true;
(function(){
  var FILES = %s;
  var TYPES = {json: "application/json", mp3: "audio/mpeg"};
  var realFetch = window.fetch ? window.fetch.bind(window) : null;
  function bytes(s){ var b = atob(s), u = new Uint8Array(b.length); for (var i = 0; i < b.length; i++) u[i] = b.charCodeAt(i); return u; }
  window.fetch = function(input, init){
    var url = typeof input === "string" ? input : input.url;
    for (var k in FILES) {
      if (url.slice(-k.length) === k) {
        var ext = k.split(".").pop();
        return Promise.resolve(new Response(new Blob([bytes(FILES[k])], {type: TYPES[ext]}), {status: 200, headers: {"Content-Type": TYPES[ext]}}));
      }
    }
    return realFetch ? realFetch(input, init) : Promise.reject(new Error("offline"));
  };
})();
</script>""" % json.dumps(files)

html = rd("index.html")
html = html.replace('<link rel="stylesheet" href="styles.css">', "<style>\n" + css + "\n</style>")
html = re.sub(r'<link rel="(manifest|preload|icon|apple-touch-icon)"[^>]*>\n?', "", html)
# the concept sections, with their animation library and fonts inside, for the menu's full-screen view
learn = rd("learn.html")
learn = learn.replace('<script src="vendor/gsap.min.js"></script>', "<script>\n" + rd("vendor/gsap.min.js") + "\n</script>")
learn = re.sub(r"url\((fonts/[^)]+\.woff2)\)", lambda m: f"url(data:font/woff2;base64,{b64(m.group(1))})", learn)
learn_js = "<script>window.__LEARN_HTML = " + json.dumps(learn).replace("</", "<\\/") + ";</script>"
html = html.replace('<script src="app.js"></script>', learn_js + "\n" + shim + "\n<script>\n" + app + "\n</script>")
out = os.path.join(ROOT, "Open Silent Sitting.html")
open(out, "w", encoding="utf-8").write(html)
print("Wrote", out, round(os.path.getsize(out) / 1e6, 1), "MB")
