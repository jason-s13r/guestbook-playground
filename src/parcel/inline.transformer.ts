import type {TranspileOptions} from 'typescript';

import {Transformer} from '@parcel/plugin';
// import {loadTSConfig} from '@parcel/ts-utils';
import typescript from 'typescript';
import SourceMap from '@parcel/source-map';

export default (new Transformer({
  async transform({asset, config, options}) {
    let [code, originalMap] = await Promise.all([
      asset.getCode(),
      asset.getMap(),
    ]);

    let transpiled = typescript.transpileModule(
      code,
      ({
        compilerOptions: {
          noEmit: false,
          module: typescript.ModuleKind.ESNext,
          target: typescript.ScriptTarget.ESNext,
          sourceMap: Boolean(asset.env.sourceMap),
          mapRoot: options.projectRoot,
          alwaysStrict: true,
          strict: true,
        },
        fileName: asset.filePath,
  }),
    );

    let {outputText, sourceMapText} = transpiled;

    if (sourceMapText != null) {
      outputText = outputText.substring(
        0,
        outputText.lastIndexOf('//# sourceMappingURL'),
      );

      let map = new SourceMap(options.projectRoot);
      map.addVLQMap(JSON.parse(sourceMapText));
      if (originalMap) {
        map.extends(originalMap);
      }
      asset.setMap(map);
    }

    asset.setCode(outputText);

    return [asset];
  },
}));