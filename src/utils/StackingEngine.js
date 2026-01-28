/**
 * AutoPallet v3.0 - Advanced Layer-Based Packing with Stability Analysis
 * 
 * Improvements:
 * - Layer-based packing (complete layers before stacking)
 * - Maximal Rectangles bin packing algorithm
 * - Weight distribution & center of gravity checks
 * - Smart fragility handling (never heavy on fragile)
 * - Stability scoring
 * - Loading order optimization
 */

export const PALLET_TYPES = {
    AU_CHEP: { name: 'AU CHEP', width: 1165, depth: 1165, height: 150, weight: 30 },
    US_STD: { name: 'US STND', width: 1016, depth: 1219, height: 150, weight: 20 },
    EU_EURO: { name: 'EU EPAL', width: 1200, depth: 800, height: 144, weight: 25 },
    PLASTIC_STD: { name: 'Plastic Unit', width: 1100, depth: 1000, height: 125, weight: 15 },
};

const MAX_HEIGHT = 2600;
const OVERHANG_TOLERANCE = 100; // 10cm max overhang per side
const MAX_COG_OFFSET = 150; // Maximum center of gravity offset (mm)
const MIN_SUPPORT_PERCENTAGE = 0.7; // 70% of box base must be supported

// Maximal Rectangles Free Space Tracker
class FreeRectangles {
    constructor(width, depth) {
        this.rects = [{ x: 0, z: 0, width, depth }];
    }

    findBestFit(boxW, boxD) {
        let best = null;
        let bestScore = Infinity;

        for (const rect of this.rects) {
            // Try both orientations
            const fits = [
                { w: boxW, d: boxD, rotated: false },
                { w: boxD, d: boxW, rotated: true }
            ];

            for (const fit of fits) {
                if (fit.w <= rect.width && fit.d <= rect.depth) {
                    // Score: prefer tight fits, prefer bottom-left
                    const wastedArea = (rect.width - fit.w) * (rect.depth - fit.d);
                    const positionScore = rect.x + rect.z; // Bottom-left preference
                    const score = wastedArea * 100 + positionScore;

                    if (score < bestScore) {
                        bestScore = score;
                        best = {
                            x: rect.x,
                            z: rect.z,
                            width: fit.w,
                            depth: fit.d,
                            rotated: fit.rotated,
                            rect
                        };
                    }
                }
            }
        }

        return best;
    }

    placeBox(placement) {
        // Remove the used rectangle
        const index = this.rects.indexOf(placement.rect);
        this.rects.splice(index, 1);

        // Generate new free rectangles from splits
        const splits = [];
        
        // Right split
        if (placement.rect.width > placement.width) {
            splits.push({
                x: placement.x + placement.width,
                z: placement.rect.z,
                width: placement.rect.width - placement.width,
                depth: placement.rect.depth
            });
        }
        
        // Top split
        if (placement.rect.depth > placement.depth) {
            splits.push({
                x: placement.rect.x,
                z: placement.z + placement.depth,
                width: placement.rect.width,
                depth: placement.rect.depth - placement.depth
            });
        }

        // Add splits and remove overlaps
        for (const split of splits) {
            if (split.width > 0 && split.depth > 0) {
                this.addRectangle(split);
            }
        }
    }

    addRectangle(newRect) {
        // Check if new rect is contained in an existing rect
        for (const rect of this.rects) {
            if (this.contains(rect, newRect)) {
                return; // Don't add, already covered
            }
        }

        // Remove existing rects that are contained in new rect
        this.rects = this.rects.filter(rect => !this.contains(newRect, rect));
        
        this.rects.push(newRect);
    }

    contains(outer, inner) {
        return inner.x >= outer.x &&
               inner.z >= outer.z &&
               inner.x + inner.width <= outer.x + outer.width &&
               inner.z + inner.depth <= outer.z + outer.depth;
    }
}

// Layer packing using Maximal Rectangles
function packLayer(boxes, palletWidth, palletDepth, allowedOverhang = OVERHANG_TOLERANCE) {
    const effectiveW = palletWidth + allowedOverhang * 2;
    const effectiveD = palletDepth + allowedOverhang * 2;
    
    const freeRects = new FreeRectangles(effectiveW, effectiveD);
    const placed = [];
    const remaining = [...boxes];

    // Sort boxes by area (largest first) for better packing
    remaining.sort((a, b) => (b.width * b.depth) - (a.width * a.depth));

    for (let i = 0; i < remaining.length; i++) {
        const box = remaining[i];
        const placement = freeRects.findBestFit(box.width, box.depth);

        if (placement) {
            placed.push({
                ...box,
                x: placement.x - allowedOverhang,
                z: placement.z - allowedOverhang,
                width: placement.width,
                depth: placement.depth,
                rotated: placement.rotated
            });
            freeRects.placeBox(placement);
            remaining.splice(i, 1);
            i--; // Adjust index after removal
        }
    }

    return { placed, remaining };
}

// Calculate center of gravity for a layer
function calculateCenterOfGravity(boxes) {
    if (boxes.length === 0) return { x: 0, z: 0, totalWeight: 0 };

    let totalWeight = 0;
    let weightedX = 0;
    let weightedZ = 0;

    for (const box of boxes) {
        const weight = box.weight || 1;
        totalWeight += weight;
        weightedX += (box.x + box.width / 2) * weight;
        weightedZ += (box.z + box.depth / 2) * weight;
    }

    return {
        x: weightedX / totalWeight,
        z: weightedZ / totalWeight,
        totalWeight
    };
}

// Check if boxes in upper layer are properly supported
function calculateSupportPercentage(upperBox, lowerLayer) {
    const upperArea = upperBox.width * upperBox.depth;
    let supportedArea = 0;

    const ux1 = upperBox.x;
    const ux2 = upperBox.x + upperBox.width;
    const uz1 = upperBox.z;
    const uz2 = upperBox.z + upperBox.depth;

    for (const lowerBox of lowerLayer) {
        const lx1 = lowerBox.x;
        const lx2 = lowerBox.x + lowerBox.width;
        const lz1 = lowerBox.z;
        const lz2 = lowerBox.z + lowerBox.depth;

        // Calculate overlap
        const overlapX = Math.max(0, Math.min(ux2, lx2) - Math.max(ux1, lx1));
        const overlapZ = Math.max(0, Math.min(uz2, lz2) - Math.max(uz1, lz1));
        supportedArea += overlapX * overlapZ;
    }

    return supportedArea / upperArea;
}

// Check if a box can be safely placed on a layer
function canPlaceOnLayer(box, layer, palletWidth, palletDepth) {
    if (layer.length === 0) return true; // Ground level always OK

    // Check fragility: never place heavy boxes on fragile ones
    const maxFragilityBelow = Math.max(...layer.map(b => b.fragileRating || 5));
    const currentRigidity = box.rigidityRating || 5;
    
    if (maxFragilityBelow > 7 && box.weight > 30) {
        return false; // Too heavy for fragile items below
    }

    // Check support percentage
    const support = calculateSupportPercentage(box, layer);
    if (support < MIN_SUPPORT_PERCENTAGE) {
        return false; // Insufficient support
    }

    // Check that box is not entirely outside pallet bounds
    const centerX = box.x + box.width / 2;
    const centerZ = box.z + box.depth / 2;
    
    if (Math.abs(centerX) > palletWidth / 2 + OVERHANG_TOLERANCE ||
        Math.abs(centerZ) > palletDepth / 2 + OVERHANG_TOLERANCE) {
        return false;
    }

    return true;
}

// Calculate stability score for entire stack
function calculateStabilityScore(layers, palletWidth, palletDepth) {
    let totalScore = 0;
    let totalWeight = 0;

    for (let i = 0; i < layers.length; i++) {
        const layer = layers[i];
        const cog = calculateCenterOfGravity(layer);
        
        // Penalize off-center weight distribution
        const cogOffset = Math.sqrt(cog.x * cog.x + cog.z * cog.z);
        const cogPenalty = Math.max(0, cogOffset - MAX_COG_OFFSET) * 10;
        
        // Penalize fragile items with heavy items above
        let fragilityPenalty = 0;
        if (i < layers.length - 1) {
            const maxFragility = Math.max(...layer.map(b => b.fragileRating || 5));
            const weightAbove = layers.slice(i + 1).reduce((sum, l) => 
                sum + l.reduce((s, b) => s + b.weight, 0), 0
            );
            
            if (maxFragility > 6 && weightAbove > 50) {
                fragilityPenalty = (maxFragility - 6) * weightAbove;
            }
        }
        
        totalScore += cogPenalty + fragilityPenalty;
        totalWeight += cog.totalWeight;
    }

    // Bonus for even weight distribution across layers
    const avgLayerWeight = totalWeight / layers.length;
    const weightVariance = layers.reduce((sum, layer) => {
        const layerWeight = layer.reduce((s, b) => s + b.weight, 0);
        return sum + Math.abs(layerWeight - avgLayerWeight);
    }, 0);
    
    totalScore += weightVariance * 0.1;

    return totalScore;
}

// Main layer-based packing function
function packSinglePallet(boxes, pallet) {
    const layers = [];
    let remaining = [...boxes];
    let currentHeight = pallet.height;
    
    // Special handling for WaterRower products (keep together)
    const waterRowerBoxes = remaining.filter(b => 
        b.productId && (b.productId.startsWith('wr-') || b.productId.includes('waterrower'))
    );
    const otherBoxes = remaining.filter(b => !waterRowerBoxes.includes(b));
    
    // Sort by weight (heaviest first for base layer)
    remaining = [...waterRowerBoxes.sort((a, b) => b.weight - a.weight), 
                 ...otherBoxes.sort((a, b) => b.weight - a.weight)];

    let attemptCount = 0;
    const maxAttempts = 100;

    while (remaining.length > 0 && currentHeight < MAX_HEIGHT && attemptCount < maxAttempts) {
        attemptCount++;
        
        // Group boxes by similar height for efficient layering
        const heightGroups = {};
        for (const box of remaining) {
            const h = box.height;
            if (!heightGroups[h]) heightGroups[h] = [];
            heightGroups[h].push(box);
        }

        // Pick the most common height group
        let bestGroup = null;
        let maxCount = 0;
        for (const [height, group] of Object.entries(heightGroups)) {
            if (group.length > maxCount) {
                maxCount = group.length;
                bestGroup = { height: Number(height), boxes: group };
            }
        }

        if (!bestGroup || currentHeight + bestGroup.height > MAX_HEIGHT) {
            break; // Can't fit any more layers
        }

        // Try to pack this height group into a layer
        const { placed, remaining: layerRemaining } = packLayer(
            bestGroup.boxes, 
            pallet.width, 
            pallet.depth,
            layers.length === 0 ? OVERHANG_TOLERANCE * 2 : OVERHANG_TOLERANCE // More overhang on bottom
        );

        if (placed.length === 0) {
            // Couldn't place anything, try smaller boxes
            remaining = remaining.filter(b => b.height !== bestGroup.height);
            continue;
        }

        // Validate layer stability
        const validPlaced = placed.filter(box => 
            canPlaceOnLayer(box, layers.length > 0 ? layers[layers.length - 1] : [], pallet.width, pallet.depth)
        );

        if (validPlaced.length === 0) {
            // Layer not stable, skip this height group
            remaining = remaining.filter(b => b.height !== bestGroup.height);
            continue;
        }

        // Add layer with height information
        const layer = validPlaced.map(box => ({
            ...box,
            y: currentHeight
        }));

        layers.push(layer);
        currentHeight += bestGroup.height;

        // Update remaining boxes
        const placedIds = new Set(validPlaced.map(b => b.id));
        remaining = remaining.filter(b => !placedIds.has(b.id));
    }

    // Flatten layers into arranged items with proper 3D positions
    const arranged = [];
    for (const layer of layers) {
        for (const item of layer) {
            arranged.push({
                ...item,
                position: [
                    item.x + item.width / 2 - pallet.width / 2,
                    item.y + item.height / 2,
                    item.z + item.depth / 2 - pallet.depth / 2
                ]
            });
        }
    }

    // Calculate actual load dimensions
    let loadWidth = pallet.width;
    let loadDepth = pallet.depth;
    
    if (arranged.length > 0) {
        const minX = Math.min(...arranged.map(i => i.position[0] - i.width / 2));
        const maxX = Math.max(...arranged.map(i => i.position[0] + i.width / 2));
        const minZ = Math.min(...arranged.map(i => i.position[2] - i.depth / 2));
        const maxZ = Math.max(...arranged.map(i => i.position[2] + i.depth / 2));
        
        loadWidth = Math.max(pallet.width, Math.round(maxX - minX));
        loadDepth = Math.max(pallet.depth, Math.round(maxZ - minZ));
    }

    const stabilityScore = calculateStabilityScore(layers, pallet.width, pallet.depth);

    return {
        arranged,
        remaining,
        totalHeight: currentHeight,
        loadWidth,
        loadDepth,
        layers,
        stabilityScore
    };
}

export function calculateVisGeometry(items, palletType = 'AU_CHEP') {
    const pallet = PALLET_TYPES[palletType];
    
    // Flatten items with quantities
    let totalQueue = [];
    items.forEach(item => {
        for (let q = 0; q < item.quantity; q++) {
            totalQueue.push({ 
                ...item, 
                quantity: 1,
                id: `${item.id || item.productId}-${q}-${item.boxIndex || 0}-${Math.random().toString(36).substr(2, 6)}`
            });
        }
    });

    if (totalQueue.length === 0) {
        return [{
            pallet,
            items: [],
            totalHeight: pallet.height,
            loadWidth: pallet.width,
            loadDepth: pallet.depth,
            totalWeight: pallet.weight,
            layers: [],
            stabilityScore: 0
        }];
    }

    // Group by product to keep multi-box products together
    const productGroups = {};
    totalQueue.forEach(item => {
        const key = item.productId || item.id;
        if (!productGroups[key]) productGroups[key] = [];
        productGroups[key].push(item);
    });

    // Sort groups: WaterRower first, then by weight
    const sortedGroups = Object.values(productGroups).sort((a, b) => {
        const aIsWR = a[0].productId && a[0].productId.startsWith('wr-');
        const bIsWR = b[0].productId && b[0].productId.startsWith('wr-');
        
        if (aIsWR && !bIsWR) return -1;
        if (!aIsWR && bIsWR) return 1;
        
        const aWeight = a.reduce((sum, item) => sum + item.weight, 0);
        const bWeight = b.reduce((sum, item) => sum + item.weight, 0);
        return bWeight - aWeight;
    });

    // Flatten back to queue
    totalQueue = sortedGroups.flat();

    // Pack pallets
    const pallets = [];
    let currentQueue = totalQueue;
    let safetyCounter = 0;

    while (currentQueue.length > 0 && safetyCounter < 50) {
        safetyCounter++;
        
        const result = packSinglePallet(currentQueue, pallet);
        
        if (result.arranged.length === 0) {
            // Can't pack first item, skip it to prevent infinite loop
            console.warn('Could not pack item:', currentQueue[0]);
            currentQueue = currentQueue.slice(1);
            continue;
        }

        const totalWeight = result.arranged.reduce((sum, item) => sum + item.weight, 0) + pallet.weight;

        pallets.push({
            pallet,
            items: result.arranged,
            totalHeight: Math.round(result.totalHeight),
            loadWidth: result.loadWidth,
            loadDepth: result.loadDepth,
            totalWeight: Math.round(totalWeight),
            layers: result.layers,
            stabilityScore: Math.round(result.stabilityScore)
        });

        currentQueue = result.remaining;
    }

    return pallets;
}
