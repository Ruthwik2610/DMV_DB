/**
 * Skill Loader
 * Scans the skills/ directory, loads SKILL.md metadata, and returns
 * relevant skill content based on user intent.
 */

import fs from 'fs';
import path from 'path';

let skillIndex = null;

/**
 * Loads all skills from the skills/ directory.
 * Returns array of { name, description, content, dir }
 */
export function loadSkills(skillsDir) {
    if (skillIndex) return skillIndex;

    skillIndex = [];

    if (!fs.existsSync(skillsDir)) {
        console.log('[Skills] No skills directory found at', skillsDir);
        return skillIndex;
    }

    const entries = fs.readdirSync(skillsDir, { withFileTypes: true });
    for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const skillPath = path.join(skillsDir, entry.name, 'SKILL.md');
        if (!fs.existsSync(skillPath)) continue;

        try {
            const raw = fs.readFileSync(skillPath, 'utf-8');
            const frontmatterMatch = raw.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
            if (!frontmatterMatch) continue;

            const frontmatter = frontmatterMatch[1];
            const body = frontmatterMatch[2].trim();

            const nameMatch = frontmatter.match(/^name:\s*(.+)$/m);
            const descMatch = frontmatter.match(/^description:\s*(.+)$/m);

            const skill = {
                name: nameMatch ? nameMatch[1].trim() : entry.name,
                description: descMatch ? descMatch[1].trim() : '',
                content: body,
                dir: path.join(skillsDir, entry.name),
            };

            skillIndex.push(skill);
            console.log(`[Skills] Loaded: ${skill.name}`);
        } catch (e) {
            console.warn(`[Skills] Failed to load ${entry.name}:`, e.message);
        }
    }

    console.log(`[Skills] ${skillIndex.length} skills loaded`);
    return skillIndex;
}

/**
 * Finds the most relevant skill for a given user message.
 * Returns the skill object or null.
 */
export function matchSkill(userMessage, skills) {
    if (!skills || skills.length === 0) return null;
    const text = userMessage.toLowerCase();

    // Figma queries
    if (text.match(/\bfigma\b/) || text.match(/figma\.com\//)) {
        return skills.find(s => s.name === 'figma-to-code') || null;
    }

    // MCP-related queries
    if (text.match(/\b(mcp|model context protocol)\b/) && text.match(/\b(create|build|make|generate|connect|server|setup)\b/)) {
        return skills.find(s => s.name === 'mcp-builder') || null;
    }

    // Salesforce queries
    if (text.match(/\b(salesforce|soql|sobject|apex|sf)\b/)) {
        return skills.find(s => s.name === 'salesforce-hosted-mcp') || null;
    }

    // BigQuery queries
    if (text.match(/\b(bigquery|bq|big query)\b/)) {
        return skills.find(s => s.name === 'bigquery-query') || null;
    }

    // Deploy queries
    if (text.match(/\b(deploy|publish|go live|launch|host)\b/) && text.match(/\b(vercel|github|site|website|app)\b/)) {
        return skills.find(s => s.name === 'deploy-website') || null;
    }

    // Frontend design (when specifically asking for design quality)
    if (text.match(/\b(design|beautiful|stunning|modern|professional|polished|sleek|elegant|clean|minimal)\b/) && text.match(/\b(website|page|ui|interface|app|dashboard|landing|portfolio)\b/)) {
        return skills.find(s => s.name === 'frontend-design') || null;
    }

    // Generic website/app creation — use frontend-design for better output quality
    if (text.match(/\b(build|create|generate|make|code|develop)\b/) && text.match(/\b(website|webpage|landing\s*page|app|application|dashboard|portfolio|blog|ecommerce|store|homepage|page|ui|component|layout|form|interface|template)\b/)) {
        return skills.find(s => s.name === 'frontend-design') || null;
    }

    return null;
}

/**
 * Loads additional reference files from a skill's directory.
 * Used for skills like mcp-builder that have reference/ folders.
 */
export function loadSkillReferences(skill, fileNames) {
    const refs = {};
    for (const fileName of fileNames) {
        const refPath = path.join(skill.dir, 'reference', fileName);
        if (fs.existsSync(refPath)) {
            refs[fileName] = fs.readFileSync(refPath, 'utf-8');
        }
    }
    return refs;
}
