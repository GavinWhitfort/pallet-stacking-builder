/**
 * Pallet Stacking Engine - Rule-Based Approach
 * 
 * Follows explicit stacking rules provided by Gav
 */

export const PALLET_TYPES = {
    AU_CHEP: { name: 'AU CHEP', width: 1165, depth: 1165, height: 150, weight: 30 },
    US_STD: { name: 'US STND', width: 1016, depth: 1219, height: 150, weight: 20 },
    EU_EURO: { name: 'EU EPAL', width: 1200, depth: 800, height: 144, weight: 25 },
    PLASTIC_STD: { name: 'Plastic Unit', width: 1100, depth: 1000, height: 125, weight: 15 },
};

// RULE #1: Max 20cm overhang on any side
const MAX_OVERHANG = 200; // 20cm per side

// RULE #4: Max height
const MAX_HEIGHT = 2300; // 2.3m

/**
 * RULE #3: Rotation to minimize footprint
 * Returns best orientation (normal or rotated 90°, or upright for rails)
 * Max 20cm overhang allowed
 */
function getBestOrientation(box, palletWidth, palletDepth) {
    // Check if this is a rail box (WaterRower boxIndex 1)
    const isRail = box.boxIndex === 1 &&
        (box.productId === 'wr-s4' || box.productId === 'wr-a1');

    const orientations = [
        { w: box.width, d: box.depth, h: box.height, rotated: false },
        { w: box.depth, d: box.width, h: box.height, rotated: true }
    ];

    // Rails can also stand upright (on their edge)
    if (isRail) {
        orientations.push(
            { w: box.width, d: box.height, h: box.depth, rotated: 'upright-1' },
            { w: box.height, d: box.width, h: box.depth, rotated: 'upright-2' },
            { w: box.depth, d: box.height, h: box.width, rotated: 'upright-3' },
            { w: box.height, d: box.depth, h: box.width, rotated: 'upright-4' }
        );
    }

    const maxWidth = palletWidth + MAX_OVERHANG * 2;
    const maxDepth = palletDepth + MAX_OVERHANG * 2;

    // Filter to orientations that fit within overhang limits
    const validOrientations = orientations.filter(o =>
        o.w <= maxWidth && o.d <= maxDepth
    );

    if (validOrientations.length === 0) return null;

    // Pick orientation that minimizes footprint (area)
    validOrientations.sort((a, b) => (a.w * a.d) - (b.w * b.d));

    return validOrientations[0];
}

/**
 * RULE #7 & #8: Check if item can stack on layer below
 */
function canStackOn(item, layerBelow) {
    if (layerBelow.length === 0) return true; // Ground level always OK

    // Check fragility rules
    for (const belowItem of layerBelow) {
        // SlimBeam is very fragile - no heavy items on top
        if (belowItem.productId === 'slimbeam' && item.weight > 30) {
            return false;
        }

        // Rails are fragile - nothing on top
        if (belowItem.productId &&
            (belowItem.productId.includes('wr-') || belowItem.productId.includes('waterrower')) &&
            belowItem.boxIndex === 1) {
            return false; // This is a rail box
        }
    }

    return true;
}

/**
 * RULE #5: Group products - place multiples side by side
 * Returns { placed, notPlaced } arrays
 * Prioritize pallet footprint, allow up to 20cm overhang if needed
 */
function layoutProductGroup(boxes, palletWidth, palletDepth, offsetX = 0, offsetZ = 0) {
    // Try strict pallet bounds first (no overhang)
    const strictResult = tryLayoutWithBounds(boxes, palletWidth, palletDepth, palletWidth, palletDepth);

    // If everything fits within strict bounds, use that
    if (strictResult.notPlaced.length === 0) {
        return strictResult;
    }

    // Otherwise allow up to 20cm overhang
    const maxWidth = palletWidth + MAX_OVERHANG * 2;
    const maxDepth = palletDepth + MAX_OVERHANG * 2;

    return tryLayoutWithBounds(boxes, palletWidth, palletDepth, maxWidth, maxDepth);
}

/**
 * Helper: Try to layout boxes within specified bounds
 */
function tryLayoutWithBounds(boxes, palletWidth, palletDepth, maxWidth, maxDepth) {
    // Build rows - checking both width and depth constraints
    const rows = [];
    let currentRow = [];
    let currentRowWidth = 0;
    let totalDepthUsed = 0;
    let placedBoxes = [];

    for (let i = 0; i < boxes.length; i++) {
        const box = boxes[i];
        const orient = getBestOrientation(box, palletWidth, palletDepth);
        if (!orient) continue;

        // Check if adding this box exceeds max width
        if (currentRowWidth + orient.w > maxWidth && currentRow.length > 0) {
            // Check if we can fit another row depth-wise
            const currentRowDepth = Math.max(...currentRow.map(b => b.depth));
            if (totalDepthUsed + currentRowDepth + orient.d > maxDepth) {
                // Can't fit more rows, stop here
                break;
            }

            // Start new row
            rows.push(currentRow);
            totalDepthUsed += currentRowDepth;
            currentRow = [];
            currentRowWidth = 0;
        }

        const orientedBox = {
            ...box,
            width: orient.w,
            depth: orient.d,
            height: orient.h,
            rotated: orient.rotated
        };

        currentRow.push(orientedBox);
        placedBoxes.push(box);
        currentRowWidth += orient.w;
    }

    // Add last row if it fits
    if (currentRow.length > 0) {
        const currentRowDepth = Math.max(...currentRow.map(b => b.depth));
        if (totalDepthUsed + currentRowDepth <= maxDepth) {
            rows.push(currentRow);
        } else {
            // Last row doesn't fit, remove those boxes from placedBoxes
            currentRow.forEach(box => {
                const idx = placedBoxes.findIndex(b => b.id === box.id);
                if (idx >= 0) placedBoxes.splice(idx, 1);
            });
        }
    }

    // Calculate total depth of all rows to center vertically
    const totalRowsDepth = rows.reduce((sum, row) => {
        return sum + Math.max(...row.map(box => box.depth));
    }, 0);

    // Start from center, offset by half the total depth
    let zOffset = -totalRowsDepth / 2;

    const positioned = [];
    for (const row of rows) {
        const rowWidth = row.reduce((sum, box) => sum + box.width, 0);
        const rowDepth = Math.max(...row.map(box => box.depth));

        // Center this row horizontally
        let xOffset = -rowWidth / 2;

        for (const box of row) {
            positioned.push({
                ...box,
                x: xOffset,
                z: zOffset
            });
            xOffset += box.width;
        }

        zOffset += rowDepth;
    }

    // Return which boxes were placed and which weren't
    const notPlaced = boxes.filter(box => !placedBoxes.includes(box));

    return { placed: positioned, notPlaced };
}

/**
 * RULE #2: Sort by weight × rigidity for bottom layer
 */
function sortByWeightAndRigidity(items) {
    return [...items].sort((a, b) => {
        const scoreA = a.weight * (a.rigidityRating || 5);
        const scoreB = b.weight * (b.rigidityRating || 5);
        return scoreB - scoreA; // Heaviest + most rigid first
    });
}

/**
 * Group boxes by product ID
 */
function groupByProduct(boxes) {
    const groups = {};

    for (const box of boxes) {
        const key = box.productId || box.id;
        if (!groups[key]) groups[key] = [];
        groups[key].push(box);
    }

    return Object.values(groups);
}

/**
 * Pack a single pallet following the rules
 */
function packSinglePallet(boxes, pallet) {
    const layers = [];
    let remaining = [...boxes];
    let currentHeight = pallet.height;

    // RULE #8: Separate tank boxes and rail boxes for WaterRower products
    const tankBoxes = remaining.filter(b =>
        (b.productId === 'wr-s4' || b.productId === 'wr-a1') && b.boxIndex === 0
    );
    const railBoxes = remaining.filter(b =>
        (b.productId === 'wr-s4' || b.productId === 'wr-a1') && b.boxIndex === 1
    );
    const otherBoxes = remaining.filter(b =>
        !tankBoxes.includes(b) && !railBoxes.includes(b)
    );

    // RULE #2: Sort bottom layer by weight × rigidity
    const sortedOthers = sortByWeightAndRigidity(otherBoxes);

    // Build queue: tanks first (grouped), then others (sorted), rails at end
    const queue = [...tankBoxes, ...sortedOthers, ...railBoxes];

    let queueIndex = 0;
    let attemptCount = 0;
    const maxAttempts = 100;

    while (queueIndex < queue.length && currentHeight < MAX_HEIGHT && attemptCount < maxAttempts) {
        attemptCount++;

        // Get next product group from queue
        const currentProduct = queue[queueIndex];
        if (!currentProduct) break;

        const productId = currentProduct.productId || currentProduct.id;
        const currentBoxIndex = currentProduct.boxIndex || 0;

        // RULE #5: Collect boxes of this product + boxIndex that are next in queue
        // (Group by product AND box index to handle multi-box products)
        const productGroup = [];
        let i = queueIndex;
        while (i < queue.length &&
            (queue[i].productId || queue[i].id) === productId &&
            (queue[i].boxIndex || 0) === currentBoxIndex) {
            productGroup.push(queue[i]);
            i++;
        }

        // Check if this product can stack on current layer
        const lastLayer = layers.length > 0 ? layers[layers.length - 1] : [];
        if (!canStackOn(productGroup[0], lastLayer)) {
            queueIndex += productGroup.length; // Skip these boxes
            continue;
        }

        // Layout this product group (determines orientation)
        const layoutResult = layoutProductGroup(productGroup, pallet.width, pallet.depth);

        if (layoutResult.placed.length === 0) {
            queueIndex += productGroup.length; // Skip these boxes
            continue;
        }

        // Check height limit AFTER orientation is determined
        const layerHeight = layoutResult.placed[0].height;
        if (currentHeight + layerHeight > MAX_HEIGHT) {
            queueIndex += productGroup.length; // Skip these boxes - too tall
            continue;
        }

        // Add Y position
        const layer = layoutResult.placed.map(item => ({
            ...item,
            y: currentHeight
        }));

        layers.push(layer);
        currentHeight += layerHeight; // Use actual height after orientation

        // Move queue forward by how many we successfully placed
        queueIndex += layoutResult.placed.length;

        // Items from productGroup that didn't fit remain in queue at current position
        // They'll be tried again (and likely fail, going to remaining) or work later
    }

    // Items that didn't fit
    // remaining = queue.slice(queueIndex); <--- OLD BROKEN LOGIC

    // NEW LOGIC: Filter out items that were actually placed
    // We need to check against arranged items (calculated below) or track placed items
    const placedItems = [];
    for (const layer of layers) {
        for (const item of layer) {
            placedItems.push(item);
        }
    }
    const placedIds = new Set(placedItems.map(i => i.id));
    remaining = queue.filter(item => !placedIds.has(item.id));

    // Flatten layers into arranged items
    const arranged = [];
    for (const layer of layers) {
        for (const item of layer) {
            arranged.push({
                ...item,
                position: [
                    item.x + item.width / 2,
                    item.y + item.height / 2,
                    item.z + item.depth / 2
                ]
            });
        }
    }

    // Calculate load dimensions
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

    return {
        arranged,
        remaining,
        totalHeight: currentHeight,
        loadWidth,
        loadDepth,
        layers
    };
}

/**
 * Main entry point
 */
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
            layers: []
        }];
    }

    // Pack pallets
    const pallets = [];
    let currentQueue = totalQueue;
    let safetyCounter = 0;

    while (currentQueue.length > 0 && safetyCounter < 50) {
        safetyCounter++;

        const result = packSinglePallet(currentQueue, pallet);

        if (result.arranged.length === 0) {
            console.warn('Could not pack item:', currentQueue[0]);
            currentQueue = currentQueue.slice(1);
            continue;
        }

        const totalWeight = result.arranged.reduce((sum, item) => sum + item.weight, 0) + pallet.weight;

        // Calculate efficiency
        const usedVolume = result.arranged.reduce((sum, item) => sum + (item.width * item.depth * item.height), 0);
        const boundingVolume = result.loadWidth * result.loadDepth * (result.totalHeight - pallet.height || 1);
        const efficiency = boundingVolume > 0 ? usedVolume / boundingVolume : 0;

        pallets.push({
            pallet,
            items: result.arranged,
            totalHeight: Math.round(result.totalHeight),
            loadWidth: result.loadWidth,
            loadDepth: result.loadDepth,
            totalWeight: Math.round(totalWeight),
            layers: result.layers,
            efficiency: efficiency,
            cg: {
                x: 0, // Center of gravity X
                z: 0  // Center of gravity Z
            }
        });

        currentQueue = result.remaining;
    }

    return pallets;
}
