import { cp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const distDir = path.join(rootDir, "dist");

const variants = {
    social: {
        mode: "social",
        label: "社招版",
        name: "微光 社招版",
        description: "面向社招求职的 Boss 直聘 AI 职位分析助手。",
        features: {
            autoApply: true,
            internshipHardFilter: false
        }
    },
    intern: {
        mode: "intern",
        label: "实习生版",
        name: "微光 实习生版",
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

const includePaths = [
    "manifest.json",
    "variant.js",
    "background.js",
    "content.js",
    "popup.html",
    "popup.js",
    "style.css",
    "html2canvas.min.js",
    "injected_probe.js",
    "spa_monitor.js",
    "scf_bootstrap",
    "images",
    "README.md",
    "DISCLAIMER.md",
    "CHANGELOG.md"
];

await mkdir(distDir, { recursive: true });

for (const mode of modes) {
    const variant = variants[mode];
    const outputDir = path.join(distDir, `weiguang-${mode}`);
    const zipPath = path.join(distDir, `weiguang-${mode}.zip`);

    await rm(outputDir, { recursive: true, force: true });
    await rm(zipPath, { force: true });
    await mkdir(outputDir, { recursive: true });

    for (const relativePath of includePaths) {
        const source = path.join(rootDir, relativePath);
        if (!existsSync(source)) continue;
        await cp(source, path.join(outputDir, relativePath), { recursive: true });
    }

    await writeVariantFile(path.join(outputDir, "variant.js"), variant);
    await writeManifest(path.join(outputDir, "manifest.json"), variant);
    zipDirectory(outputDir, zipPath);

    console.log(`Built ${variant.label}:`);
    console.log(`  unpacked: ${path.relative(rootDir, outputDir)}`);
    console.log(`  zip:      ${path.relative(rootDir, zipPath)}`);
}

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
