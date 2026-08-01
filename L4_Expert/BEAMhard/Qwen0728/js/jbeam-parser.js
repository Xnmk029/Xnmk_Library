/**
 * JBeam Parser - Phase 1 Task 1.1
 * Parses BeamNG JBeam structural definitions (Node and Beam topology matrices)
 */
export class JBeamParser {
    constructor() {
        this.nodes = new Map();
        this.beams = [];
        this.torsionbars = [];
        this.flexbodies = [];
        this.slots = [];
        this.variables = [];
        this.sections = new Map();
    }

    /**
     * Parse a JBeam JSON string (handles BeamNG's non-standard JSON with comments)
     */
    parse(text) {
        const cleaned = this._stripComments(text);
        const data = this._lenientJSONParse(cleaned);
        if (!data) return null;

        const result = { nodes: [], beams: [], torsionbars: [], flexbodies: [], slots: [], variables: [], information: null };

        for (const key of Object.keys(data)) {
            const section = data[key];
            if (!section || typeof section !== 'object') continue;

            if (section.information) result.information = section.information;
            if (section.nodes) result.nodes.push(...this._parseNodes(section.nodes));
            if (section.beams) result.beams.push(...this._parseBeams(section.beams));
            if (section.torsionbars) result.torsionbars.push(...this._parseTorsionbars(section.torsionbars));
            if (section.flexbodies) result.flexbodies.push(...this._parseFlexbodies(section.flexbodies));
            if (section.slots) result.slots.push(...this._parseSlots(section.slots));
            if (section.variables) result.variables.push(...section.variables.slice(1));
        }
        return result;
    }

    /**
     * Parse multiple JBeam files and merge into unified topology
     */
    parseMultiple(fileContents) {
        const merged = { nodes: [], beams: [], torsionbars: [], flexbodies: [], slots: [], variables: [], information: null };
        for (const content of fileContents) {
            const parsed = this.parse(content);
            if (!parsed) continue;
            merged.nodes.push(...parsed.nodes);
            merged.beams.push(...parsed.beams);
            merged.torsionbars.push(...parsed.torsionbars);
            merged.flexbodies.push(...parsed.flexbodies);
            merged.slots.push(...parsed.slots);
            merged.variables.push(...parsed.variables);
            if (parsed.information && !merged.information) merged.information = parsed.information;
        }
        // Deduplicate nodes by id
        const nodeMap = new Map();
        for (const node of merged.nodes) {
            nodeMap.set(node.id, node);
        }
        merged.nodes = Array.from(nodeMap.values());
        return merged;
    }

    _parseNodes(nodeArray) {
        const nodes = [];
        let currentProps = { nodeWeight: 5.0, frictionCoef: 0.5, collision: true, selfCollision: true, nodeMaterial: '|NM_METAL', group: '' };

        for (let i = 0; i < nodeArray.length; i++) {
            const entry = nodeArray[i];
            if (!Array.isArray(entry)) {
                if (typeof entry === 'object' && entry !== null) {
                    Object.assign(currentProps, entry);
                }
                continue;
            }
            if (entry[0] === 'id') continue; // header row
            if (entry.length >= 4) {
                nodes.push({
                    id: entry[0],
                    pos: [entry[1], entry[2], entry[3]],
                    weight: currentProps.nodeWeight || 5.0,
                    friction: currentProps.frictionCoef || 0.5,
                    collision: currentProps.collision !== false,
                    selfCollision: currentProps.selfCollision !== false,
                    material: currentProps.nodeMaterial || '|NM_METAL',
                    group: currentProps.group || ''
                });
            }
        }
        return nodes;
    }

    _parseBeams(beamArray) {
        const beams = [];
        let currentProps = { beamSpring: 1000000, beamDamp: 100, beamDeform: 30000, beamStrength: 'FLT_MAX', beamType: '|NORMAL', beamPrecompression: 1.0, beamLongBound: 1.0, beamShortBound: 1.0, breakGroup: '', deformGroup: '', optional: false };

        for (let i = 0; i < beamArray.length; i++) {
            const entry = beamArray[i];
            if (!Array.isArray(entry)) {
                if (typeof entry === 'object' && entry !== null) {
                    Object.assign(currentProps, entry);
                }
                continue;
            }
            if (entry[0] === 'id1:') continue; // header row
            if (entry.length >= 2) {
                beams.push({
                    id1: entry[0],
                    id2: entry[1],
                    spring: currentProps.beamSpring || 1000000,
                    damp: currentProps.beamDamp || 100,
                    deform: currentProps.beamDeform || 30000,
                    strength: currentProps.beamStrength || 'FLT_MAX',
                    type: currentProps.beamType || '|NORMAL',
                    precompression: currentProps.beamPrecompression || 1.0,
                    longBound: currentProps.beamLongBound || 1.0,
                    shortBound: currentProps.beamShortBound || 1.0,
                    breakGroup: currentProps.breakGroup || '',
                    optional: currentProps.optional || false
                });
            }
        }
        return beams;
    }

    _parseTorsionbars(tbArray) {
        const torsionbars = [];
        let currentProps = { spring: 100000, damp: 10, deform: 75000, strength: 150000 };

        for (let i = 0; i < tbArray.length; i++) {
            const entry = tbArray[i];
            if (!Array.isArray(entry)) {
                if (typeof entry === 'object' && entry !== null) {
                    Object.assign(currentProps, entry);
                }
                continue;
            }
            if (entry[0] === 'id1:') continue;
            if (entry.length >= 4) {
                torsionbars.push({
                    ids: [entry[0], entry[1], entry[2], entry[3]],
                    spring: currentProps.spring,
                    damp: currentProps.damp,
                    deform: currentProps.deform,
                    strength: currentProps.strength
                });
            }
        }
        return torsionbars;
    }

    _parseFlexbodies(fbArray) {
        const flexbodies = [];
        for (let i = 0; i < fbArray.length; i++) {
            const entry = fbArray[i];
            if (!Array.isArray(entry)) continue;
            if (entry[0] === 'mesh') continue;
            if (entry.length >= 2) {
                flexbodies.push({ mesh: entry[0], groups: entry[1] });
            }
        }
        return flexbodies;
    }

    _parseSlots(slotArray) {
        const slots = [];
        for (let i = 0; i < slotArray.length; i++) {
            const entry = slotArray[i];
            if (!Array.isArray(entry)) continue;
            if (entry[0] === 'type') continue;
            slots.push({ type: entry[0], default: entry[1], description: entry[2], options: entry[3] || {} });
        }
        return slots;
    }

    /**
     * Strip C-style and C++ style comments from JBeam text
     */
    _stripComments(text) {
        let result = '';
        let i = 0;
        let inString = false;
        let stringChar = '';

        while (i < text.length) {
            if (inString) {
                result += text[i];
                if (text[i] === stringChar && text[i - 1] !== '\\') inString = false;
                i++;
            } else if (text[i] === '"' || text[i] === "'") {
                inString = true;
                stringChar = text[i];
                result += text[i];
                i++;
            } else if (text[i] === '/' && text[i + 1] === '/') {
                while (i < text.length && text[i] !== '\n') i++;
            } else if (text[i] === '/' && text[i + 1] === '*') {
                i += 2;
                while (i < text.length && !(text[i] === '*' && text[i + 1] === '/')) i++;
                i += 2;
            } else {
                result += text[i];
                i++;
            }
        }
        return result;
    }

    /**
     * Lenient JSON parser that handles trailing commas, unquoted values,
     * and missing commas between array elements (common in JBeam files)
     */
    _lenientJSONParse(text) {
        try {
            let cleaned = text;
            // Remove trailing commas before } or ]
            cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
            // Add missing commas: } followed by [ or " or { (without comma)
            cleaned = cleaned.replace(/\}\s*\n\s*\[/g, '},\n[');
            cleaned = cleaned.replace(/\]\s*\n\s*\{/g, '],\n{');
            cleaned = cleaned.replace(/\]\s*\n\s*\[/g, '],\n[');
            cleaned = cleaned.replace(/\}\s*\n\s*\{/g, '},\n{');
            // Handle special values
            cleaned = cleaned.replace(/"FLT_MAX"/g, '999999999');
            return JSON.parse(cleaned);
        } catch (e) {
            // Try more aggressive cleanup
            try {
                let cleaned = text;
                // Insert commas between any } or ] followed by [ or { on next lines
                cleaned = cleaned.replace(/([}\]])\s*([\[{])/g, '$1,$2');
                // Remove trailing commas
                cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
                // Handle special values
                cleaned = cleaned.replace(/"FLT_MAX"/g, '999999999');
                // Handle $= expressions (replace with string)
                cleaned = cleaned.replace(/"\$=[^"]*"/g, '"expr"');
                return JSON.parse(cleaned);
            } catch (e2) {
                // Final attempt: line-by-line reconstruction
                try {
                    return this._reconstructJSON(text);
                } catch (e3) {
                    console.warn('JBeam parse failed:', e3.message);
                    return null;
                }
            }
        }
    }

    /**
     * Last-resort JSON reconstruction for heavily non-standard JBeam
     */
    _reconstructJSON(text) {
        // Remove all single-line comments
        let cleaned = text.replace(/\/\/[^\n]*/g, '');
        // Remove multi-line comments
        cleaned = cleaned.replace(/\/\*[\s\S]*?\*\//g, '');
        // Add missing commas between elements
        cleaned = cleaned.replace(/([}\]])\s*\n\s*([\[{"\-\d])/g, '$1,\n$2');
        // Remove trailing commas
        cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
        // Replace FLT_MAX
        cleaned = cleaned.replace(/"FLT_MAX"/g, '999999999');
        // Replace $= expressions
        cleaned = cleaned.replace(/"\$=[^"]*"/g, '"0"');
        // Handle nil references
        cleaned = cleaned.replace(/\bnil\b/g, 'null');
        return JSON.parse(cleaned);
    }

    /**
     * Extract tire node groups from parsed data
     */
    static extractTireNodes(parsedData) {
        const tireNodes = [];
        const tirePatterns = ['wheel', 'tire', 'hub', 'wf', 'wr', 'hf', 'hr'];
        for (const node of parsedData.nodes) {
            const id = node.id.toLowerCase();
            const group = Array.isArray(node.group) ? node.group.join(' ').toLowerCase() : String(node.group).toLowerCase();
            if (tirePatterns.some(p => id.includes(p) || group.includes(p))) {
                tireNodes.push(node);
            }
        }
        return tireNodes;
    }

    /**
     * Extract chassis nodes (non-tire, non-suspension extremities)
     */
    static extractChassisNodes(parsedData) {
        const chassisNodes = [];
        const excludePatterns = ['wf', 'wr', 'hf', 'hr', 'wheel', 'tire'];
        for (const node of parsedData.nodes) {
            const id = node.id.toLowerCase();
            if (!excludePatterns.some(p => id.startsWith(p))) {
                chassisNodes.push(node);
            }
        }
        return chassisNodes;
    }
}
