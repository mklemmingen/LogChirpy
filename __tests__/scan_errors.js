#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Common error patterns we've encountered
const errorPatterns = [
    {
        name: 'Invalid color "inverse"',
        pattern: /color=['"]inverse['"]/g,
        description: 'ThemedIcon/ThemedText using invalid "inverse" color'
    },
    {
        name: 'Missing colors variable',
        pattern: /colors\./g,
        description: 'Using colors object without importing useColors hook'
    },
    {
        name: 'Invalid icon type',
        pattern: /name=\{[^}]*\}/g,
        description: 'Potential invalid icon name (needs manual check)'
    },
    {
        name: 'Missing semantic colors',
        pattern: /useSemanticColors|useColorVariants|useTheme/g,
        description: 'Using theme hooks without proper import'
    },
    {
        name: 'Conditional style issue',
        pattern: /\w+\s+&&\s+styles\.\w+/g,
        description: 'Conditional styles that may cause false | ViewStyle error'
    },
    {
        name: 'Invalid text variants',
        pattern: /variant=['"](?:headlineLarge|headlineMedium|headlineSmall|bodyMedium|displayLarge|displayMedium)['"]/g,
        description: 'Invalid ThemedText variant names'
    },
    {
        name: 'Missing style definition',
        pattern: /styles\.(\w+)/g,
        description: 'Potential missing style definition (needs manual check)'
    }
];

function scanDirectory(dirPath) {
    const results = [];
    
    function scanFile(filePath) {
        if (!filePath.endsWith('.tsx') && !filePath.endsWith('.ts')) return;
        
        try {
            const content = fs.readFileSync(filePath, 'utf8');
            const lines = content.split('\n');
            
            lines.forEach((line, lineIndex) => {
                errorPatterns.forEach(pattern => {
                    const matches = line.match(pattern.pattern);
                    if (matches) {
                        results.push({
                            file: filePath.replace('/mnt/c/dev/l/', ''),
                            line: lineIndex + 1,
                            content: line.trim(),
                            error: pattern.name,
                            description: pattern.description,
                            matches: matches
                        });
                    }
                });
            });
        } catch (error) {
            console.error(`Error reading file ${filePath}:`, error.message);
        }
    }
    
    function walkDirectory(dir) {
        const entries = fs.readdirSync(dir);
        
        for (const entry of entries) {
            const fullPath = path.join(dir, entry);
            const stat = fs.statSync(fullPath);
            
            if (stat.isDirectory() && !entry.startsWith('.') && entry !== 'node_modules') {
                walkDirectory(fullPath);
            } else if (stat.isFile()) {
                scanFile(fullPath);
            }
        }
    }
    
    walkDirectory(dirPath);
    return results;
}

// Scan the app directory
const appDir = '/mnt/c/dev/l/app';
const errors = scanDirectory(appDir);

// Group errors by type
const errorsByType = {};
errors.forEach(error => {
    if (!errorsByType[error.error]) {
        errorsByType[error.error] = [];
    }
    errorsByType[error.error].push(error);
});

// Output results
console.log('='.repeat(80));
console.log('TYPESCRIPT ERROR SCAN RESULTS');
console.log('='.repeat(80));
console.log();

Object.keys(errorsByType).forEach(errorType => {
    const errorList = errorsByType[errorType];
    console.log(`   ${errorType} (${errorList.length} occurrences)`);
    console.log(`   ${errorList[0].description}`);
    console.log();
    
    errorList.forEach(error => {
        console.log(`      ${error.file}:${error.line}`);
        console.log(`      ${error.content}`);
        if (error.matches && error.matches.length > 0) {
            console.log(`      Matches: ${error.matches.join(', ')}`);
        }
        console.log();
    });
    console.log('-'.repeat(60));
    console.log();
});

console.log(`Total errors found: ${errors.length}`);
console.log(`Unique error types: ${Object.keys(errorsByType).length}`);