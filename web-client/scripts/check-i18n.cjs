#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const glob = require('glob');

/**
 * 检查 Vue 文件中未 i18n 化的文本内容
 */
class I18nChecker {
  constructor() {
    this.srcDir = path.join(__dirname, '../src');
    this.results = [];
    
    // 匹配中文字符的正则
    this.chineseRegex = /[\u4e00-\u9fff\u3400-\u4dbf\uf900-\ufaff]/;
    
    // 匹配 i18n 函数调用的正则
    this.i18nFunctionRegex = /\$t\(|t\(/;
    
    // 需要忽略的模式（已经是 i18n 调用的）
    this.skipPatterns = [
      /\$t\(['"]/,           // $t('key')
      /t\(['"]/,             // t('key')
      /\{\{\s*\$t\(/,        // {{ $t(
      /\{\{\s*t\(/,          // {{ t(
      /v-text="\$t\(/,       // v-text="$t(
      /v-text="t\(/,         // v-text="t(
      /:title="\$t\(/,       // :title="$t(
      /:title="t\(/,         // :title="t(
      /:placeholder="\$t\(/,  // :placeholder="$t(
      /:placeholder="t\(/,    // :placeholder="t(
    ];
    
    // 常见的需要检查的属性
    this.checkAttributes = [
      'title', 'placeholder', 'alt', 'aria-label', 'v-text', 'label', 'value'
    ];
  }

  /**
   * 检查所有 Vue 文件
   */
  async checkAllFiles() {
    const vueFiles = glob.sync('**/*.vue', { cwd: this.srcDir });
    
    console.log(`找到 ${vueFiles.length} 个 Vue 文件`);
    console.log('='.repeat(50));
    
    for (const file of vueFiles) {
      const fullPath = path.join(this.srcDir, file);
      await this.checkFile(fullPath, file);
    }
    
    this.printResults();
  }

  /**
   * 检查单个文件
   */
  async checkFile(fullPath, relativePath) {
    try {
      const content = fs.readFileSync(fullPath, 'utf-8');
      const templateContent = this.extractTemplate(content);
      
      if (!templateContent) {
        return;
      }
      
      const issues = this.findI18nIssues(templateContent, relativePath);
      
      if (issues.length > 0) {
        this.results.push({
          file: relativePath,
          issues: issues
        });
      }
    } catch (error) {
      console.error(`读取文件失败: ${fullPath}`, error.message);
    }
  }

  /**
   * 提取 template 部分的内容
   */
  extractTemplate(content) {
    const templateMatch = content.match(/<template[^>]*>([\s\S]*?)<\/template>/);
    return templateMatch ? templateMatch[1] : null;
  }

  /**
   * 查找 i18n 问题
   */
  findI18nIssues(templateContent, fileName) {
    const issues = [];
    const lines = templateContent.split('\n');
    
    lines.forEach((line, index) => {
      const lineNumber = index + 1;
      const trimmedLine = line.trim();
      
      // 跳过空行和注释
      if (!trimmedLine || trimmedLine.startsWith('<!--')) {
        return;
      }
      
      // 检查文本内容中的中文
      const textIssues = this.checkTextContent(line, lineNumber);
      issues.push(...textIssues);
      
      // 检查属性中的中文
      const attrIssues = this.checkAttributesContent(line, lineNumber);
      issues.push(...attrIssues);
    });
    
    return issues;
  }

  /**
   * 检查文本内容中的中文
   */
  checkTextContent(line, lineNumber) {
    const issues = [];
    
    // 查找标签之间的文本内容
    const textMatches = line.matchAll(/>([^<]*)</g);
    
    for (const match of textMatches) {
      const text = match[1].trim();
      
      if (!text) continue;
      
      // 检查是否包含中文字符
      if (this.chineseRegex.test(text)) {
        // 检查是否已经使用了 i18n
        if (!this.isAlreadyI18n(text) && !this.isAlreadyI18n(line)) {
          issues.push({
            type: 'text',
            line: lineNumber,
            content: text,
            context: line.trim(),
            description: '文本内容包含中文但未使用 i18n'
          });
        }
      }
      
      // 检查英文硬编码文本 (可选 - 如果项目也要求英文国际化)
      if (this.containsHardcodedEnglish(text) && !this.isAlreadyI18n(line)) {
        issues.push({
          type: 'english-text',
          line: lineNumber,
          content: text,
          context: line.trim(),
          description: '英文文本内容可能需要 i18n 化'
        });
      }
    }
    
    // 检查 option 标签内的文本 (跨行检查)
    if (line.includes('<option')) {
      // 处理单行 option
      const optionMatches = line.matchAll(/<option[^>]*>([^<]*)<\/option>/g);
      for (const match of optionMatches) {
        const text = match[1].trim();
        if (text && (this.chineseRegex.test(text) || this.containsHardcodedEnglish(text))) {
          if (!this.isAlreadyI18n(text) && !this.isAlreadyI18n(line)) {
            issues.push({
              type: 'option-text',
              line: lineNumber,
              content: text,
              context: line.trim(),
              description: 'option 选项文本包含硬编码内容但未使用 i18n'
            });
          }
        }
      }
      
      // 处理跨行 option (option 开始标签在这一行，但内容可能在下一行)
      if (line.includes('<option') && !line.includes('</option>')) {
        // 这种情况需要在更高层级处理，这里先记录
        // 实际检查会在下面的文本内容检查中处理
      }
    }
    
    return issues;
  }

  /**
   * 检查是否包含需要国际化的英文文本
   */
  containsHardcodedEnglish(text) {
    // 检查常见的英文硬编码模式
    const englishPatterns = [
      /^Font\s+\d+$/i,      // Font 1, Font 2 等
      /^(Back|Settings|Cancel|OK|Yes|No|Save|Load|Delete|Edit|Add|Remove)$/i,
      /^(Default|Enable|Disable|Success|Error|Warning|Info)$/i,
      /\b(MB|GB|KB|byte|bytes)\b/i
    ];
    
    return englishPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 检查属性中的中文
   */
  checkAttributesContent(line, lineNumber) {
    const issues = [];
    
    // 查找所有属性
    const attrMatches = line.matchAll(/(\w+)=["']([^"']*?)["']/g);
    
    for (const match of attrMatches) {
      const [, attrName, attrValue] = match;
      
      // 检查需要关注的属性
      if (this.checkAttributes.some(attr => 
        attrName === attr || 
        attrName.includes(attr) || 
        attr.includes(attrName)
      )) {
        if (this.chineseRegex.test(attrValue) && !this.isAlreadyI18n(attrValue)) {
          issues.push({
            type: 'attribute',
            line: lineNumber,
            content: attrValue,
            attribute: attrName,
            context: line.trim(),
            description: `属性 ${attrName} 包含中文但未使用 i18n`
          });
        }
      }
    }
    
    // 检查特殊的 Vue 指令属性（如 :title, :placeholder 等）
    const vueAttrMatches = line.matchAll(/:(\w+)=["']([^"']*?)["']/g);
    
    for (const match of vueAttrMatches) {
      const [, attrName, attrValue] = match;
      
      if (this.checkAttributes.includes(attrName)) {
        if (this.chineseRegex.test(attrValue) && !this.isAlreadyI18n(attrValue)) {
          issues.push({
            type: 'vue-attribute',
            line: lineNumber,
            content: attrValue,
            attribute: `:${attrName}`,
            context: line.trim(),
            description: `Vue 属性 :${attrName} 包含中文但未使用 i18n`
          });
        }
      }
    }
    
    return issues;
  }

  /**
   * 检查文本是否已经使用了 i18n
   */
  isAlreadyI18n(text) {
    // 检查是否包含 i18n 函数调用
    return this.skipPatterns.some(pattern => pattern.test(text));
  }

  /**
   * 打印检查结果
   */
  printResults() {
    console.log('\n' + '='.repeat(50));
    console.log('检查结果汇总');
    console.log('='.repeat(50));
    
    if (this.results.length === 0) {
      console.log('✅ 太好了！没有发现未 i18n 化的内容。');
      return;
    }
    
    console.log(`❌ 发现 ${this.results.length} 个文件包含未 i18n 化的内容：\n`);
    
    let totalIssues = 0;
    
    this.results.forEach(result => {
      console.log(`📄 文件: ${result.file}`);
      console.log(`   问题数量: ${result.issues.length}`);
      
      result.issues.forEach(issue => {
        console.log(`   第 ${issue.line} 行 [${issue.type}]: ${issue.description}`);
        console.log(`   内容: "${issue.content}"`);
        if (issue.attribute) {
          console.log(`   属性: ${issue.attribute}`);
        }
        console.log(`   上下文: ${issue.context}`);
        console.log('');
      });
      
      totalIssues += result.issues.length;
      console.log('-'.repeat(30));
    });
    
    console.log(`\n总计发现 ${totalIssues} 个未 i18n 化的问题。`);
    return totalIssues;
  }
}

/**
 * 检查语言包（JSON）的键一致性、占位符一致性、乱码与简繁混杂
 */
class LocaleChecker {
  constructor() {
    this.localesDir = path.join(__dirname, '../src/i18n/locales');
    this.referenceLocale = 'en-US.json';
    this.errors = [];
    this.cjkRegex = /[\u4e00-\u9fff]/;
  }

  /**
   * 基于内置 TextDecoder 生成 GB2312 (6763 汉字) 字符集
   * 用于校验 zh-Hans 中是否混入非 GB2312 繁体字
   */
  buildGb2312Set() {
    const decoder = new TextDecoder('gb2312', { fatal: true });
    const set = new Set();
    for (let b1 = 0xB0; b1 <= 0xF7; b1++) {
      for (let b2 = 0xA1; b2 <= 0xFE; b2++) {
        try {
          const ch = decoder.decode(Uint8Array.of(b1, b2));
          if (ch.length === 1 && this.cjkRegex.test(ch)) {
            set.add(ch);
          }
        } catch {}
      }
    }
    return set;
  }

  /**
   * 基于内置 TextDecoder 生成 Big5 汉字字符集
   * 用于校验 zh-Hant 中是否混入非 Big5 简体字
   */
  buildBig5Set() {
    const decoder = new TextDecoder('big5', { fatal: true });
    const set = new Set();
    for (let b1 = 0xA4; b1 <= 0xF9; b1++) {
      if (b1 === 0xC7 || b1 === 0xC8) continue;
      for (let b2 = 0x40; b2 <= 0xFE; b2++) {
        if (b2 > 0x7E && b2 < 0xA1) continue;
        try {
          const ch = decoder.decode(Uint8Array.of(b1, b2));
          if (ch.length === 1 && this.cjkRegex.test(ch)) {
            set.add(ch);
          }
        } catch {}
      }
    }
    return set;
  }

  flatten(obj, prefix = '') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      const key = prefix ? `${prefix}.${k}` : k;
      if (v && typeof v === 'object' && !Array.isArray(v)) {
        Object.assign(out, this.flatten(v, key));
      } else {
        out[key] = v;
      }
    }
    return out;
  }

  extractPlaceholders(str) {
    return (String(str).match(/\{[^}]+\}/g) || []).sort();
  }

  checkAllLocales() {
    if (!fs.existsSync(this.localesDir)) {
      this.errors.push(`语言包目录不存在: ${this.localesDir}`);
      return this.printResults();
    }

    const files = fs.readdirSync(this.localesDir).filter(f => f.endsWith('.json')).sort();
    const localeMaps = {};

    for (const file of files) {
      const fullPath = path.join(this.localesDir, file);
      try {
        const parsed = JSON.parse(fs.readFileSync(fullPath, 'utf8'));
        localeMaps[file] = this.flatten(parsed);
      } catch (err) {
        this.errors.push(`[${file}] JSON 解析失败: ${err.message}`);
      }
    }

    const loadedFiles = Object.keys(localeMaps);
    if (loadedFiles.length === 0) {
      this.errors.push('未找到有效的语言包 JSON 文件');
      return this.printResults();
    }

    const allKeys = [...new Set(loadedFiles.flatMap(f => Object.keys(localeMaps[f])))];

    // 1. 键一致性 & 空值 & 乱码检查
    for (const file of loadedFiles) {
      const map = localeMaps[file];
      const missing = allKeys.filter(k => !(k in map));
      if (missing.length > 0) {
        this.errors.push(`[${file}] 缺失 ${missing.length} 个键: ${missing.slice(0, 10).join(', ')}${missing.length > 10 ? ' ...' : ''}`);
      }

      for (const [k, v] of Object.entries(map)) {
        if (typeof v !== 'string' || v.trim() === '') {
          this.errors.push(`[${file}] 键 "${k}" 的值为空或非字符串`);
          continue;
        }
        if (/\?{2,}/.test(v) || v.includes('\uFFFD')) {
          this.errors.push(`[${file}] 键 "${k}" 疑似存在乱码/编码损坏: "${v}"`);
        }
      }
    }

    // 2. 占位符一致性检查
    const refMap = localeMaps[this.referenceLocale] || localeMaps[loadedFiles[0]];
    const refName = localeMaps[this.referenceLocale] ? this.referenceLocale : loadedFiles[0];
    for (const key of allKeys) {
      if (!(key in refMap)) continue;
      const refPh = this.extractPlaceholders(refMap[key]);
      for (const file of loadedFiles) {
        if (file === refName || !(key in localeMaps[file])) continue;
        const ph = this.extractPlaceholders(localeMaps[file][key]);
        if (ph.join(',') !== refPh.join(',')) {
          this.errors.push(`[${file}] 键 "${key}" 占位符不一致: 期望 [${refPh.join(', ')}]，实际 [${ph.join(', ')}]`);
        }
      }
    }

    // 3. 简繁体混杂检查（基于 GB2312 与 Big5 字符集范围）
    if (localeMaps['zh-Hans.json']) {
      const gb2312Set = this.buildGb2312Set();
      for (const [k, v] of Object.entries(localeMaps['zh-Hans.json'])) {
        if (typeof v !== 'string') continue;
        const hits = [...new Set([...v].filter(c => this.cjkRegex.test(c) && !gb2312Set.has(c)))];
        if (hits.length > 0) {
          this.errors.push(`[zh-Hans.json] 键 "${k}" 包含非 GB2312 字符（疑似繁体字） [${hits.join('')}]: "${v}"`);
        }
      }
    }

    if (localeMaps['zh-Hant.json']) {
      const big5Set = this.buildBig5Set();
      for (const [k, v] of Object.entries(localeMaps['zh-Hant.json'])) {
        if (typeof v !== 'string') continue;
        const hits = [...new Set([...v].filter(c => this.cjkRegex.test(c) && !big5Set.has(c)))];
        if (hits.length > 0) {
          this.errors.push(`[zh-Hant.json] 键 "${k}" 包含非 Big5 字符（疑似简体字） [${hits.join('')}]: "${v}"`);
        }
      }
    }

    return this.printResults(loadedFiles.length, allKeys.length);
  }

  printResults(fileCount = 0, keyCount = 0) {
    console.log('\n' + '='.repeat(50));
    console.log(`语言包检查汇总（共 ${fileCount} 个文件，${keyCount} 个键）`);
    console.log('='.repeat(50));

    if (this.errors.length === 0) {
      console.log('✅ 所有语言包键一致性、占位符、编码与简繁校验均通过。');
      return 0;
    }

    console.log(`❌ 发现 ${this.errors.length} 个语言包问题：\n`);
    for (const err of this.errors) {
      console.log(`  - ${err}`);
    }
    return this.errors.length;
  }
}

// 检查是否安装了 glob 依赖
try {
  require('glob');
} catch (e) {
  console.error('请先安装 glob 依赖: npm install glob');
  process.exit(1);
}

// 运行检查
(async () => {
  const checker = new I18nChecker();
  await checker.checkAllFiles();
  const vueIssues = checker.results.reduce((sum, r) => sum + r.issues.length, 0);

  const localeChecker = new LocaleChecker();
  const localeIssues = localeChecker.checkAllLocales();

  if (vueIssues > 0 || localeIssues > 0) {
    process.exitCode = 1;
  }
})().catch(err => {
  console.error(err);
  process.exit(1);
});