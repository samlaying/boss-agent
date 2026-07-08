import { cp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");
const webpackDistDir = path.join(rootDir, ".variant-build");

const variants = {
    social: {
        mode: "social",
        label: "社招版",
        name: "Boss Agent 社招版",
        description: "面向社招求职的 Boss 直聘 AI 职位分析助手。",
        features: {
            autoApply: true,
            internshipHardFilter: false
        }
    },
    intern: {
        mode: "intern",
        label: "实习生版",
        name: "Boss Agent 实习生版",
        description: "面向在校生和实习投递的 Boss 直聘 AI 职位分析助手。",
        features: {
            autoApply: true,
            internshipHardFilter: true
        }
    }
};

const requestedModes = process.argv.slice(2);
const modes = requestedModes.length > 0 ? requestedModes : Object.keys(variants);
const unknownModes = modes.filter(mode => !variants[mode]);

if (unknownModes.length > 0) {
    console.error(`Unknown variant: ${unknownModes.join(", ")}`);
    console.error(`Available variants: ${Object.keys(variants).join(", ")}`);
    process.exit(1);
}

await mkdir(distDir, { recursive: true });
const buildResult = spawnSync(
    process.platform === "win32" ? "npx.cmd" : "npx",
    ["webpack", "--mode", "production", "--output-path", webpackDistDir],
    { cwd: rootDir, stdio: "inherit" }
);
if (buildResult.status !== 0) process.exit(buildResult.status || 1);

for (const mode of modes) {
    const variant = variants[mode];
    const outputDir = path.join(distDir, `boss-agent-${mode}`);
    const zipPath = path.join(distDir, `boss-agent-${mode}.zip`);

    await rm(outputDir, { recursive: true, force: true });
    await rm(zipPath, { force: true });
    await mkdir(outputDir, { recursive: true });

    for (const entry of await readdir(webpackDistDir)) {
        await cp(path.join(webpackDistDir, entry), path.join(outputDir, entry), { recursive: true });
    }

    await writeVariantFile(path.join(outputDir, "variant.js"), variant);
    await writeManifest(path.join(outputDir, "manifest.json"), variant);
    zipDirectory(outputDir, zipPath);

    console.log(`Built ${variant.label}:`);
    console.log(`  unpacked: ${path.relative(rootDir, outputDir)}`);
    console.log(`  zip:      ${path.relative(rootDir, zipPath)}`);
}
await rm(webpackDistDir, { recursive: true, force: true });

async function writeVariantFile(filePath, variant) {
    const payload = {
        mode: variant.mode,
        label: variant.label,
        features: variant.features
    };
    const source = `globalThis.__WEIGUANG_VARIANT__ = Object.freeze(${JSON.stringify(payload, null, 4)});\n`;
    await writeFile(filePath, source, "utf8");
}

async function writeManifest(filePath, variant) {
    const manifest = JSON.parse(await readFile(filePath, "utf8"));
    manifest.name = variant.name;
    manifest.description = variant.description;
    manifest.version_name = `${manifest.version}-${variant.mode}`;

    for (const contentScript of manifest.content_scripts || []) {
        const js = contentScript.js || [];
        contentScript.js = ["variant.js", ...js.filter(file => file !== "variant.js")];
    }

    await writeFile(filePath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
}

function zipDirectory(sourceDir, zipPath) {
    const result = spawnSync("zip", ["-qr", zipPath, "."], {
        cwd: sourceDir,
        stdio: "inherit"
    });

    if (result.error) {
        console.warn(`zip command unavailable; use unpacked build at ${sourceDir}`);
        return;
    }

    if (result.status !== 0) {
        process.exit(result.status || 1);
    }
}
