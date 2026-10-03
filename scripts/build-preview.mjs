import { build } from "esbuild";
import fs from "node:fs";
fs.mkdirSync("artifacts", { recursive: true });
const result = await build({
  stdin: {
    contents:
      "import {createRoot} from 'react-dom/client';import {WorkspaceAccess} from './src/components/workspace-access';createRoot(document.getElementById('root')).render(<WorkspaceAccess/>);",
    resolveDir: process.cwd(),
    loader: "tsx",
  },
  bundle: true,
  write: false,
  minify: true,
  jsx: "automatic",
  define: {
    "process.env.NODE_ENV": '"production"',
    "process.env.NEXT_PUBLIC_SUPABASE_URL": '""',
    "process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY": '""',
  },
});
const js = result.outputFiles[0].text.replaceAll("</script", "<\\/script");
const css = fs.readFileSync("src/app/globals.css", "utf8");
fs.writeFileSync(
  "artifacts/kimo-os-preview.html",
  `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>KIMO OS — Local Preview</title><style>${css}</style></head><body><div id="root"></div><script>${js}</script></body></html>`,
);
console.log(
  "Local HTML preview generated. Cloud sign-in requires a configured hosted app.",
);
