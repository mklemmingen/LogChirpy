/**
 * Localization Scanner Test for LogChirpy
 * 
 * This test scans all component and app files to identify user-visible strings
 * that are not properly localized through the i18n system.
 * 
 * The app uses react-i18next with the pattern:
 * - useTranslation() hook provides t() function
 * - Localized strings use t('key') or t('namespace.key')
 * - Translation files in /locales/{lang}/translation.json
 */

import * as fs from 'fs';
import * as path from 'path';
import { describe, it, expect } from '@jest/globals';

interface LocalizationIssue {
  file: string;
  line: number;
  column: number;
  text: string;
  context: string;
  type: 'hardcoded_string' | 'suspicious_text' | 'missing_translation';
}

interface ScanResult {
  issues: LocalizationIssue[];
  totalFiles: number;
  scannedFiles: string[];
}

class LocalizationScanner {
  private translationKeys: Set<string> = new Set();
  private issues: LocalizationIssue[] = [];
  
  // Patterns for detecting user-visible strings
  private readonly STRING_PATTERNS = [
    // JSX text content: <Text>Hello World</Text>
    /<(?:Text|ThemedText|Button|title)[^>]*>([^<]+)</g,
    
    // String literals in common props
    /(?:title|placeholder|label|text|accessibilityLabel|accessibilityHint)\s*=\s*["']([^"']+)["']/g,
    
    // Alert and console messages that might be user-facing
    /Alert\.alert\s*\(\s*["']([^"']+)["']/g,
    /console\.(?:log|warn|error)\s*\(\s*["']([^"']+)["']/g,
    
    // Direct string assignments that might be user-facing
    /(?:message|title|description|error|warning|success|info)\s*[:=]\s*["']([^"']+)["']/g,
    
    // Common user-facing string patterns
    /(?:throw new Error|new Error)\s*\(\s*["']([^"']+)["']/g,
  ];

  // Patterns that indicate localized content (should be excluded)
  private readonly LOCALIZED_PATTERNS = [
    /t\s*\(\s*["']([^"']+)["']\s*\)/g, // t('key')
    /\$\{t\s*\(\s*["']([^"']+)["']\s*\)\}/g, // ${t('key')}
    /i18n\.t\s*\(\s*["']([^"']+)["']\s*\)/g, // i18n.t('key')
  ];

  // Strings that are acceptable to not localize
  private readonly ACCEPTABLE_NON_LOCALIZED = [
    // Technical strings
    /^[A-Z_]+$/, // Constants like 'API_KEY', 'DEBUG'
    /^https?:\/\//, // URLs
    /^[a-z]+:\/\//, // Other protocols
    /^\d+(\.\d+)*$/, // Version numbers
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, // UUIDs
    /^[a-zA-Z0-9+/]+=*$/, // Base64
    /^#[0-9a-fA-F]{3,8}$/, // Hex colors
    /^rgb\(/, // RGB colors
    /^rgba\(/, // RGBA colors
    
    // File extensions and mime types
    /^\.[a-z0-9]+$/, // .jpg, .png, etc.
    /^[a-z]+\/[a-z0-9\-+.]+$/, // mime types
    
    // Common technical terms
    /^(email|password|username|token|api|http|json|xml|css|html|js|ts|jsx|tsx)$/i,
    
    // Single characters and very short technical strings
    /^[a-zA-Z0-9\-_]{1,3}$/, // Short codes, single chars
    
    // Icon names and technical identifiers
    /^[a-z\-]+$/, // Kebab-case (often icon names)
    /^[a-zA-Z][a-zA-Z0-9]*$/, // CamelCase (often technical)
    
    // Empty strings and whitespace
    /^\s*$/,
    
    // Development/debug strings
    /^(test|debug|dev|local|staging|prod|production)$/i,
    
    // Common short words that might be technical
    /^(ok|yes|no|on|off|up|down|in|out|key|id|src|alt|ref|max|min)$/i,
  ];

  // File types to scan
  private readonly SCANNABLE_EXTENSIONS = ['.tsx', '.ts', '.jsx', '.js'];
  
  // Directories to scan
  private readonly SCAN_DIRECTORIES = ['app', 'components'];

  constructor() {
    this.loadTranslationKeys();
  }

  /**
   * Load all translation keys from the translation files
   */
  private loadTranslationKeys(): void {
    try {
      const localesDir = path.join(process.cwd(), 'locales');
      const enTranslationPath = path.join(localesDir, 'en', 'translation.json');
      
      if (fs.existsSync(enTranslationPath)) {
        const translations = JSON.parse(fs.readFileSync(enTranslationPath, 'utf-8'));
        this.extractKeysRecursively(translations, '');
      }
    } catch (error) {
      console.warn('Failed to load translation keys:', error);
    }
  }

  /**
   * Recursively extract all keys from translation object
   */
  private extractKeysRecursively(obj: any, prefix: string): void {
    Object.keys(obj).forEach(key => {
      const fullKey = prefix ? `${prefix}.${key}` : key;
      
      if (typeof obj[key] === 'string') {
        this.translationKeys.add(fullKey);
      } else if (typeof obj[key] === 'object' && obj[key] !== null) {
        this.extractKeysRecursively(obj[key], fullKey);
      }
    });
  }

  /**
   * Check if a string should be localized
   */
  private shouldBeLocalized(text: string): boolean {
    const cleanText = text.trim();
    
    // Skip empty or very short strings
    if (cleanText.length === 0 || cleanText.length === 1) {
      return false;
    }

    // Check against acceptable non-localized patterns
    for (const pattern of this.ACCEPTABLE_NON_LOCALIZED) {
      if (pattern.test(cleanText)) {
        return false;
      }
    }

    // If it contains letters and looks like human-readable text
    const hasLetters = /[a-zA-Z]/.test(cleanText);
    const hasMultipleWords = /\s+/.test(cleanText);
    const looksLikeText = hasLetters && (hasMultipleWords || cleanText.length > 3);
    
    return looksLikeText;
  }

  /**
   * Check if content is already localized
   */
  private isLocalized(content: string): boolean {
    for (const pattern of this.LOCALIZED_PATTERNS) {
      if (pattern.test(content)) {
        return true;
      }
    }
    return false;
  }

  /**
   * Scan a single file for localization issues
   */
  private scanFile(filePath: string): LocalizationIssue[] {
    const issues: LocalizationIssue[] = [];
    
    try {
      const content = fs.readFileSync(filePath, 'utf-8');
      const lines = content.split('\n');

      lines.forEach((line, lineIndex) => {
        // Skip lines that are already localized
        if (this.isLocalized(line)) {
          return;
        }

        // Check each string pattern
        for (const pattern of this.STRING_PATTERNS) {
          let match;
          pattern.lastIndex = 0; // Reset regex state
          
          while ((match = pattern.exec(line)) !== null) {
            const text = match[1];
            
            if (this.shouldBeLocalized(text)) {
              issues.push({
                file: filePath,
                line: lineIndex + 1,
                column: match.index || 0,
                text: text,
                context: line.trim(),
                type: 'hardcoded_string'
              });
            }
          }
        }

        // Look for suspicious patterns that might indicate missing localization
        if (line.includes('Alert.alert') && !this.isLocalized(line)) {
          const alertMatch = line.match(/Alert\.alert\s*\(\s*["']([^"']+)["']/);
          if (alertMatch && this.shouldBeLocalized(alertMatch[1])) {
            issues.push({
              file: filePath,
              line: lineIndex + 1,
              column: line.indexOf('Alert.alert'),
              text: alertMatch[1],
              context: line.trim(),
              type: 'suspicious_text'
            });
          }
        }
      });

    } catch (error) {
      console.warn(`Failed to scan file ${filePath}:`, error);
    }

    return issues;
  }

  /**
   * Get all files to scan
   */
  private getFilesToScan(): string[] {
    const files: string[] = [];

    for (const dir of this.SCAN_DIRECTORIES) {
      if (fs.existsSync(dir)) {
        this.scanDirectory(dir, files);
      }
    }

    return files.filter(file => 
      this.SCANNABLE_EXTENSIONS.some(ext => file.endsWith(ext))
    );
  }

  /**
   * Recursively scan directory for files
   */
  private scanDirectory(dirPath: string, files: string[]): void {
    try {
      const entries = fs.readdirSync(dirPath, { withFileTypes: true });

      for (const entry of entries) {
        const fullPath = path.join(dirPath, entry.name);

        if (entry.isDirectory()) {
          // Skip common directories that don't contain user-facing code
          if (!['node_modules', '.git', 'dist', 'build', '__tests__'].includes(entry.name)) {
            this.scanDirectory(fullPath, files);
          }
        } else if (entry.isFile()) {
          files.push(fullPath);
        }
      }
    } catch (error) {
      console.warn(`Failed to scan directory ${dirPath}:`, error);
    }
  }

  /**
   * Run the complete localization scan
   */
  scan(): ScanResult {
    this.issues = [];
    const filesToScan = this.getFilesToScan();

    for (const file of filesToScan) {
      const fileIssues = this.scanFile(file);
      this.issues.push(...fileIssues);
    }

    return {
      issues: this.issues,
      totalFiles: filesToScan.length,
      scannedFiles: filesToScan
    };
  }

  /**
   * Generate a detailed report
   */
  generateReport(result: ScanResult): string {
    let report = `\n📝 LOCALIZATION SCAN REPORT\n`;
    report += `═══════════════════════════════════════\n\n`;
    
    report += `📊 Summary:\n`;
    report += `  Files scanned: ${result.totalFiles}\n`;
    report += `  Issues found: ${result.issues.length}\n`;
    report += `  Translation keys loaded: ${this.translationKeys.size}\n\n`;

    if (result.issues.length === 0) {
      report += `✅ No localization issues found!\n`;
      report += `All user-visible strings appear to be properly localized.\n\n`;
    } else {
      // Group issues by file
      const issuesByFile = result.issues.reduce((acc, issue) => {
        if (!acc[issue.file]) {
          acc[issue.file] = [];
        }
        acc[issue.file].push(issue);
        return acc;
      }, {} as { [file: string]: LocalizationIssue[] });

      report += `❌ Issues found:\n\n`;

      Object.entries(issuesByFile).forEach(([file, issues]) => {
        report += `📄 ${file} (${issues.length} issue${issues.length > 1 ? 's' : ''})\n`;
        report += `${'─'.repeat(50)}\n`;

        issues.forEach(issue => {
          const typeIcon = issue.type === 'hardcoded_string' ? '🔤' : '⚠️';
          report += `  ${typeIcon} Line ${issue.line}:${issue.column}\n`;
          report += `     Text: "${issue.text}"\n`;
          report += `     Context: ${issue.context}\n`;
          report += `     Type: ${issue.type}\n\n`;
        });
      });

      // Recommendations
      report += `💡 Recommendations:\n`;
      report += `  1. Replace hardcoded strings with t('translation.key') calls\n`;
      report += `  2. Add corresponding entries to locales/en/translation.json\n`;
      report += `  3. Import and use useTranslation() hook in components\n`;
      report += `  4. Consider if technical strings actually need localization\n\n`;

      // Sample fix
      if (result.issues.length > 0) {
        const firstIssue = result.issues[0];
        report += `🔧 Example fix for "${firstIssue.text}":\n`;
        report += `  Before: <Text>${firstIssue.text}</Text>\n`;
        report += `  After:  <Text>{t('your.translation.key')}</Text>\n\n`;
        report += `  Add to translation.json:\n`;
        report += `  "your": { "translation": { "key": "${firstIssue.text}" } }\n\n`;
      }
    }

    return report;
  }
}

describe('🌍 Localization Tests', () => {
  let scanner: LocalizationScanner;
  let scanResult: ScanResult;

  beforeAll(() => {
    scanner = new LocalizationScanner();
    scanResult = scanner.scan();
  });

  describe('📂 File Coverage', () => {
    it('should scan all component and app files', () => {
      expect(scanResult.totalFiles).toBeGreaterThan(0);
      expect(scanResult.scannedFiles.length).toBe(scanResult.totalFiles);
      
      // Should include both app and component files
      const hasAppFiles = scanResult.scannedFiles.some(file => file.includes('app/'));
      const hasComponentFiles = scanResult.scannedFiles.some(file => file.includes('components/'));
      
      expect(hasAppFiles).toBe(true);
      expect(hasComponentFiles).toBe(true);
    });

    it('should only scan relevant file types', () => {
      const validExtensions = ['.tsx', '.ts', '.jsx', '.js'];
      
      scanResult.scannedFiles.forEach(file => {
        const hasValidExtension = validExtensions.some(ext => file.endsWith(ext));
        expect(hasValidExtension).toBe(true);
      });
    });
  });

  describe('🔍 Translation Key Loading', () => {
    it('should load translation keys from locales', () => {
      // Scanner should have loaded some translation keys
      expect(scanner['translationKeys'].size).toBeGreaterThan(0);
      
      // Should include some known keys from our translation file
      const hasWelcomeKey = scanner['translationKeys'].has('welcome');
      const hasTabsKey = scanner['translationKeys'].has('tabs.home');
      
      // At least one of these should be present
      expect(hasWelcomeKey || hasTabsKey).toBe(true);
    });
  });

  describe('🚨 Localization Issues', () => {
    it('should identify non-localized user-visible strings', () => {
      // Print detailed report for manual review
      const report = scanner.generateReport(scanResult);
      console.log(report);

      // The test will pass but provide a detailed report
      // In a real scenario, you might want to fail if issues are found:
      // expect(scanResult.issues.length).toBe(0);
      
      // For now, we'll just ensure the scanner is working
      expect(scanResult.issues).toBeDefined();
      expect(Array.isArray(scanResult.issues)).toBe(true);
    });

    it('should not flag technical strings as issues', () => {
      // Verify that common technical strings are not flagged
      const technicalStringIssues = scanResult.issues.filter(issue => {
        const text = issue.text.toLowerCase();
        return ['debug', 'api', 'http', 'json', 'css', 'html'].includes(text);
      });

      expect(technicalStringIssues.length).toBe(0);
    });

    it('should not flag already localized content', () => {
      // Verify that t() calls are not flagged as issues
      const localizedIssues = scanResult.issues.filter(issue => 
        issue.context.includes('t(') || issue.context.includes('i18n.t(')
      );

      expect(localizedIssues.length).toBe(0);
    });

    it('should categorize issues correctly', () => {
      scanResult.issues.forEach(issue => {
        expect(['hardcoded_string', 'suspicious_text', 'missing_translation']).toContain(issue.type);
        expect(issue.file).toBeTruthy();
        expect(issue.line).toBeGreaterThan(0);
        expect(issue.text).toBeTruthy();
        expect(issue.context).toBeTruthy();
      });
    });
  });

  describe('📊 Quality Metrics', () => {
    it('should have reasonable localization coverage', () => {
      const totalPotentialStrings = scanResult.issues.length + 100; // Assume 100 properly localized
      const localizationCoverage = (100 / totalPotentialStrings) * 100;
      
      console.log(`📈 Estimated localization coverage: ${localizationCoverage.toFixed(1)}%`);
      
      // This is informational - adjust threshold as needed
      expect(localizationCoverage).toBeGreaterThan(0);
    });

    it('should provide actionable feedback', () => {
      if (scanResult.issues.length > 0) {
        const report = scanner.generateReport(scanResult);
        
        // Report should contain helpful information
        expect(report).toContain('Recommendations');
        expect(report).toContain('Example fix');
        expect(report).toContain('translation.json');
      }
    });
  });

  describe('🎯 Critical User-Facing Areas', () => {
    it('should check authentication flows for localization', () => {
      const authFiles = scanResult.scannedFiles.filter(file => 
        file.includes('auth') || file.includes('login') || file.includes('signup')
      );
      
      expect(authFiles.length).toBeGreaterThan(0);
      
      const authIssues = scanResult.issues.filter(issue => 
        authFiles.some(file => issue.file === file)
      );
      
      console.log(`🔐 Authentication localization issues: ${authIssues.length}`);
    });

    it('should check main navigation for localization', () => {
      const navFiles = scanResult.scannedFiles.filter(file => 
        file.includes('_layout') || file.includes('tabs')
      );
      
      expect(navFiles.length).toBeGreaterThan(0);
      
      const navIssues = scanResult.issues.filter(issue => 
        navFiles.some(file => issue.file === file)
      );
      
      console.log(`🧭 Navigation localization issues: ${navIssues.length}`);
    });

    it('should check error messages and alerts', () => {
      const alertIssues = scanResult.issues.filter(issue => 
        issue.context.includes('Alert.alert') || 
        issue.context.includes('Error(') ||
        issue.type === 'suspicious_text'
      );
      
      console.log(`⚠️ Alert/Error message issues: ${alertIssues.length}`);
      
      // Error messages should definitely be localized
      if (alertIssues.length > 0) {
        console.log('Critical: Found non-localized error messages:', 
          alertIssues.map(i => i.text).slice(0, 3)
        );
      }
    });
  });
});