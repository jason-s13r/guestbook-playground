const importMap = {
  imports: {
    'pkg:signals': 'https://cdn.jsdelivr.net/npm/@maverick-js/signals@6.0.0/+esm',
  }
  
};

document.querySelectorAll('script[module]').forEach($script => {
  const name = $script.getAttribute("module");
  const code = $script.innerHTML.trim();
  const blob = new Blob([code], { type: "application/javascript" });
  const url = URL.createObjectURL(blob);
  importMap.imports[name] = url;
});


const $importMap = document.createElement("script");
$importMap.type = "importmap";
$importMap.innerHTML = JSON.stringify(importMap, null, 2);
document.body.append($importMap);



document.querySelectorAll("[entry]:not([executed])").forEach(($root) => {
  const name = $root.getAttribute("entry");
  const $script = document.querySelector(`script[module="${name}"]`);
  const $start = document.createElement("button");
  $start.textContent = `Run ${name}`;
  $start.setAttribute('run', name);
  
  $start.addEventListener("click", (e) => {
    import(name).then(() => {
      $start.toggleAttribute("executed");
      $root.toggleAttribute("executed");
    });
  });

  $root.parentElement.insertBefore($start, $script ?? $root);
});

document.querySelectorAll("script:not([src])").forEach(($element) => {
  const code = $element.innerHTML.trim();
  const lines = code.split(/\r?\n/);
  const bytes = new TextEncoder().encode(code).length;
  $element.dataset.info = ` (${lines.length} lines; ${bytes} bytes)`;
  $element.addEventListener("click", () => $element.toggleAttribute("open"));
});
