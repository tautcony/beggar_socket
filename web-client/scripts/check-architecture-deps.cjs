#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const ts = require('typescript');
const { parse: parseSfc } = require('@vue/compiler-sfc');

const ROOT = path.resolve(__dirname, '..');
const TARGET_EXTS = new Set(['.ts', '.tsx', '.js', '.jsx', '.mts', '.cts', '.mjs', '.cjs', '.vue']);

function walk(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    if (entry.name === 'node_modules' || entry.name === 'dist' || entry.name === 'coverage') {
      continue;
    }
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(full));
      continue;
    }
    const ext = path.extname(entry.name);
    if (TARGET_EXTS.has(ext)) {
      files.push(full);
    }
  }
  return files;
}

function readImports(file, content) {
  const imports = [];
  const errors = [];
  let blocks = [{ content, offset: 0, lang: path.extname(file).slice(1) }];
  if (file.endsWith('.vue')) {
    const parsed = parseSfc(content, { filename: file });
    for (const error of parsed.errors) errors.push({ reason: String(error.message || error), line: error.loc?.start.line || 1, column: error.loc?.start.column || 1 });
    blocks = [parsed.descriptor.script, parsed.descriptor.scriptSetup].filter(Boolean).map(block => ({
      content: block.content, offset: block.loc.start.offset, lang: block.lang || 'js', src: block.src,
    }));
  }
  const original = ts.createSourceFile(file, content, ts.ScriptTarget.Latest, true);
  for (const block of blocks) {
    const syntax = ts.createSourceFile(file, block.content, ts.ScriptTarget.Latest, true,
      block.lang === 'tsx' ? ts.ScriptKind.TSX : ['js', 'jsx', 'mjs', 'cjs'].includes(block.lang) ? ts.ScriptKind.JSX : ts.ScriptKind.TS);
    function location(pos) {
      const point = original.getLineAndCharacterOfPosition(block.offset + pos);
      return { line: point.line + 1, column: point.character + 1 };
    }
    function add(literal, kind) {
      if (literal && (ts.isStringLiteral(literal) || ts.isNoSubstitutionTemplateLiteral(literal))) {
        imports.push({ specifier: literal.text, kind: /\.d\.[cm]?ts$/.test(file) ? 'type' : kind, ...location(literal.getStart(syntax)) });
      }
    }
    if (block.src) imports.push({ specifier: block.src, kind: 'runtime', ...location(0) });
    for (const error of syntax.parseDiagnostics) errors.push({ reason: ts.flattenDiagnosticMessageText(error.messageText, '\n'), ...location(error.start || 0) });
    function visit(node) {
      if (ts.isImportDeclaration(node)) {
        const clause = node.importClause;
        const named = clause?.namedBindings;
        const typeOnly = clause?.isTypeOnly || (!clause?.name && named && ts.isNamedImports(named) && named.elements.length > 0 && named.elements.every(item => item.isTypeOnly));
        add(node.moduleSpecifier, typeOnly ? 'type' : 'runtime');
      } else if (ts.isExportDeclaration(node)) {
        const named = node.exportClause;
        const typeOnly = node.isTypeOnly || (named && ts.isNamedExports(named) && named.elements.length > 0 && named.elements.every(item => item.isTypeOnly));
        add(node.moduleSpecifier, typeOnly ? 'type' : 'runtime');
      } else if (ts.isImportTypeNode(node) && ts.isLiteralTypeNode(node.argument)) {
        add(node.argument.literal, 'type');
      } else if (ts.isImportEqualsDeclaration(node) && ts.isExternalModuleReference(node.moduleReference)) {
        add(node.moduleReference.expression, node.isTypeOnly ? 'type' : 'runtime');
      } else if (ts.isCallExpression(node) && (node.expression.kind === ts.SyntaxKind.ImportKeyword || (ts.isIdentifier(node.expression) && node.expression.text === 'require'))) {
        add(node.arguments[0], 'runtime');
      }
      ts.forEachChild(node, visit);
    }
    visit(syntax);
  }
  return { imports, errors };
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

function topLevel(relPath) {
  return relPath.split('/')[0] || '';
}

function checkViolation(sourceRel, importRel) {
  const sourceTop = topLevel(sourceRel);
  const importTop = topLevel(importRel);

  if ((sourceTop === 'components' || sourceTop === 'views') && importTop === 'protocol') {
    return 'UI layer (components/views) must not directly import protocol layer';
  }

  if ((sourceTop === 'types' || sourceTop === 'utils') && importTop === 'services') {
    return 'types/utils layer must not directly import services layer';
  }

  if (
    sourceRel.startsWith('components/operaiton/')
    && (
      importRel.startsWith('platform/')
      || importRel.startsWith('services/')
      || importRel.startsWith('features/burner/application/')
    )
  ) {
    return 'presentational operation components must only consume container-facing contracts, not platform/services/orchestration implementations';
  }

  if (sourceTop === 'protocol' && (importRel === 'services/serial-service' || importRel.startsWith('services/serial-service/'))) {
    return 'protocol layer must not directly import services/serial-service; use platform/serial transport contracts';
  }

  if (
    sourceTop === 'protocol'
    && (
      importRel.startsWith('platform/serial/tauri')
      || importRel.startsWith('platform/serial/web')
      || importRel.startsWith('platform/serial/transports')
    )
  ) {
    return 'protocol layer must not import runtime-specific serial implementations; use platform/serial transport contracts';
  }

  if (
    (sourceTop === 'services' || sourceTop === 'features')
    && importRel.startsWith('protocol/')
    && importRel !== 'protocol'
  ) {
    return 'application/service layers must consume protocol via @/protocol entrypoint, not protocol internals';
  }

  if (
    sourceRel.startsWith('features/burner/application/')
    && (
      importRel.startsWith('platform/serial/')
      || importRel.startsWith('services/')
    )
  ) {
    return 'features/burner/application must depend on burner domain ports/adapters, not runtime serial/services implementations';
  }

  return null;
}

function findCycles(edges) {
  const graph = new Map();
  for (const edge of edges.filter(item => item.kind === 'runtime')) {
    if (!graph.has(edge.source)) graph.set(edge.source, []);
    graph.get(edge.source).push(edge);
  }
  // Tarjan identifies each cyclic component once; DFS then supplies actual edges
  // in traversal order, rather than presenting a sorted set as a cycle path.
  const indices = new Map();
  const low = new Map();
  const stack = [];
  const active = new Set();
  const cycles = [];
  let index = 0;
  function visit(source) {
    indices.set(source, index);
    low.set(source, index++);
    stack.push(source);
    active.add(source);
    for (const edge of graph.get(source) || []) {
      if (!indices.has(edge.target)) {
        visit(edge.target);
        low.set(source, Math.min(low.get(source), low.get(edge.target)));
      } else if (active.has(edge.target)) low.set(source, Math.min(low.get(source), indices.get(edge.target)));
    }
    if (low.get(source) !== indices.get(source)) return;
    const component = new Set();
    let member;
    do {
      member = stack.pop();
      active.delete(member);
      component.add(member);
    } while (member !== source);
    if (component.size === 1 && !(graph.get(source) || []).some(edge => edge.target === source)) return;
    const start = [...component].sort()[0];
    const seen = new Set([start]);
    function trace(current) {
      for (const edge of graph.get(current) || []) {
        if (!component.has(edge.target)) continue;
        if (edge.target === start) return [edge];
        if (seen.has(edge.target)) continue;
        seen.add(edge.target);
        const suffix = trace(edge.target);
        if (suffix) return [edge, ...suffix];
      }
      return null;
    }
    cycles.push(trace(start));
  }
  for (const source of [...graph.keys()].sort()) if (!indices.has(source)) visit(source);
  return cycles;
}

function analyzeProject(root = ROOT) {
  const srcRoot = path.join(root, 'src');
  const configFile = path.join(root, 'tsconfig.json');
  const config = ts.readConfigFile(configFile, ts.sys.readFile);
  if (config.error) throw new Error(ts.flattenDiagnosticMessageText(config.error.messageText, '\n'));
  const parsedConfig = ts.parseJsonConfigFileContent(config.config, ts.sys, root);
  // This gate enumerates Vue/JS source independently of tsconfig includes;
  // an empty TypeScript input set does not prevent analyzing those modules.
  const configErrors = parsedConfig.errors.filter(error => error.code !== 18003);
  if (configErrors.length) throw new Error(configErrors.map(error => ts.flattenDiagnosticMessageText(error.messageText, '\n')).join('\n'));
  const options = parsedConfig.options;
  const host = { ...ts.sys, fileExists: file => ts.sys.fileExists(file) || (file.endsWith('.vue.ts') && ts.sys.fileExists(file.slice(0, -3))) };
  const cache = ts.createModuleResolutionCache(root, name => ts.sys.useCaseSensitiveFileNames ? name : name.toLowerCase(), options);
  const files = walk(srcRoot).sort();
  const edges = [];
  const violations = [];
  const errors = [];
  const matrix = new Map();
  for (const filePath of files) {
    const rel = toPosix(path.relative(srcRoot, filePath));
    const content = fs.readFileSync(filePath, 'utf8');
    const parsed = readImports(filePath, content);
    errors.push(...parsed.errors.map(error => ({ source: rel, ...error })));
    for (const imp of parsed.imports) {
      const specifier = imp.specifier;
      // Assets are outside the source dependency graph; query suffixes on
      // source modules (e.g. ?raw) still resolve to their canonical module.
      const clean = specifier.slice(0, 1) + specifier.slice(1).split(/[?#]/)[0];
      const extension = path.extname(clean);
      if (extension && !TARGET_EXTS.has(extension)) continue;
      let resolved = ts.resolveModuleName(clean, filePath, options, host, cache).resolvedModule?.resolvedFileName;
      if (resolved?.endsWith('.vue.ts')) resolved = resolved.slice(0, -3);
      const alias = Object.keys(options.paths || {}).some(pattern => pattern.includes('*')
        ? clean.startsWith(pattern.split('*')[0]) && clean.endsWith(pattern.split('*')[1]) : clean === pattern);
      if (!resolved) {
        if (clean.startsWith('.') || alias) errors.push({ source: rel, ...imp, reason: `Unresolved internal dependency: ${specifier}` });
        continue;
      }
      const target = toPosix(path.relative(srcRoot, resolved));
      if (target.startsWith('../') || path.isAbsolute(target) || !TARGET_EXTS.has(path.extname(target))) continue;
      const edge = { source: rel, target, ...imp };
      edges.push(edge);
      const key = `${topLevel(rel)} -> ${topLevel(target)} (${imp.kind})`;
      matrix.set(key, (matrix.get(key) || 0) + 1);
      const policyTarget = target.replace(/\.(?:[cm]?[jt]sx?|vue)$/, '').replace(/\/index$/, '');
      const reason = checkViolation(rel, policyTarget);
      if (reason) violations.push({ ...edge, reason });
    }
  }
  return { edges, violations, errors, matrix, cycles: findCycles(edges) };
}

function main(args = process.argv.slice(2)) {
  if (args.length && (args.length !== 2 || args[0] !== '--root')) throw new Error('Usage: check-architecture-deps.cjs [--root <project-root>]');
  const result = analyzeProject(args.length ? path.resolve(args[1]) : ROOT);
  console.log('Architecture dependency matrix (top-level):');
  const sorted = Array.from(result.matrix.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  for (const [edge, count] of sorted.slice(0, 30)) {
    console.log(`  ${String(count).padStart(3, ' ')}  ${edge}`);
  }

  if (result.violations.length + result.errors.length + result.cycles.length === 0) {
    console.log('\nNo architecture dependency violations found.');
    return;
  }

  if (result.violations.length) console.error('\nArchitecture dependency violations found:');
  for (const item of result.violations) {
    console.error(`- ${item.source}:${item.line}:${item.column} -> ${item.target} (${item.kind}, ${item.specifier})`);
    console.error(`  Reason: ${item.reason}`);
  }
  if (result.errors.length) console.error('\nDependency parsing/resolution errors:');
  for (const item of result.errors) console.error(`- ${item.source}:${item.line}:${item.column}: ${item.reason}`);
  if (result.cycles.length) console.error('\nRuntime dependency cycles found:');
  for (const cycle of result.cycles) {
    console.error(`- ${cycle.map(edge => edge.source).concat(cycle.at(-1).target).join(' -> ')}`);
    for (const edge of cycle) console.error(`  ${edge.source}:${edge.line}:${edge.column} -> ${edge.target} (${edge.specifier})`);
  }
  process.exitCode = 1;
}

module.exports = { analyzeProject, readImports, checkViolation, findCycles };
if (require.main === module) {
  try { main(); } catch (error) {
    console.error(`Architecture dependency check failed: ${error.message}`);
    process.exitCode = 1;
  }
}
