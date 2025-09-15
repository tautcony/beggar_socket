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
const checker = new I18nChecker();
checker.checkAllFiles().catch(console.error);