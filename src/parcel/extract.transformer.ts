import { Transformer } from "@parcel/plugin";
import { parse } from "node-html-parser";

export default new Transformer({
  async transform({ asset, config, options }) {
    let code = await asset.getCode();

    const root = parse(code, { blockTextElements: { script: true } });

    const scripts = root.querySelectorAll('script[id][type="module"]');
    const assets: unknown[] = [asset];

    for (const script of scripts) {
      const id = '#' + script.getAttribute("id");
      const code = script.innerHTML.trim();

      assets.push({
        type: "js",
        content: code,
        uniqueKey: id,
        meta: { literalName: id },
      });

      const dependencyId = asset.addDependency({
        specifier: id!,
        specifierType: 'esm',
        needsStableName: true,
      });
      
      script.setAttribute('type', 'inline');
    }

    const entries = root.querySelectorAll('[entry]').map(el => {
      const name = el.getAttribute('entry');
      el.insertAdjacentHTML('afterend', `<button run="${name}">Run ${name}</button>`);
      return name;
    });

    const loader = `
      export const entries = {
        ${entries.map(name => `['${name}']: { init: async () => import('${name}') }`).join(',')}
      };

      export async function initEntry(name) {
        if (!entries[name]) {
          throw new Error('Entry ' + name + ' not found');
        }
        return await entries[name].init();
      }

      document
        .querySelectorAll("button[run]")
        .forEach(($run) => {
          
        $run.addEventListener("click", (e) => {
            const name = e.target.getAttribute("run");
            const id = name.replace(/^#/, "");
            const $entry = document.querySelector(\`[entry="\${name}"]\`);
            const $script = document.querySelector(\`script[id="\${id}"]\`);
            initEntry(name)
            .then(() => {
                console.debug("executed", name);
                $run.toggleAttribute("executed");
                $entry.toggleAttribute("executed");
                $script.toggleAttribute("executed");
              })
              .catch((err) => console.error("error executed", name, err));
          });
        });

        document.querySelectorAll('script[id][type="inline"], script[id][type="module"]').forEach(($element) => {
          const code = $element.innerHTML.trim();
          const lines = code.split(/\\r?\\n/);
          const bytes = new TextEncoder().encode(code).length;
          $element.dataset.info = \` (\${lines.length} lines; \${bytes} bytes)\`;
          $element.addEventListener("click", () => $element.toggleAttribute("open"));
        });
    `;


    root.insertAdjacentHTML('beforeend', `<script type="module" defer>${loader}</script>`);

    asset.setCode(root.toString());

    return assets;
  },
});
