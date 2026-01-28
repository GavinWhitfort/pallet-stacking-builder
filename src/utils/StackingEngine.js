
/**
 * AutoPallet v2.5 - Forklift-Optimal Orientation Engine
 */

export const PALLET_TYPES = {
    AU_CHEP: { name: 'AU CHEP', width: 1165, depth: 1165, height: 150, weight: 30 },
    US_STD: { name: 'US STND', width: 1016, depth: 1219, height: 150, weight: 20 },
    EU_EURO: { name: 'EU EPAL', width: 1200, depth: 800, height: 144, weight: 25 },
    PLASTIC_STD: { name: 'Plastic Unit', width: 1100, depth: 1000, height: 125, weight: 15 },
};

const STEP = 25;
const MAX_HEIGHT = 2600;
const OVERHANG_X = 200; // 100mm overhang per side
const OVERHANG_Z = 200; // 100mm overhang per side (even on all sides)
const RAIL_OVERHANG = 1200; // Extra overhang for long WaterRower rail boxes

function packSinglePallet(queue, pallet, presetOrientations = new Map()) {
    const arranged = [];
    
    // Check if we have WaterRower rail boxes in the queue
    const hasRailBoxes = queue.some(b => (b.productId === 'wr-s4' || b.productId === 'wr-a1') && b.boxIndex === 1);
    
    // Use extra overhang if we have rail boxes
    const effW = hasRailBoxes ? pallet.width + RAIL_OVERHANG : pallet.width + OVERHANG_X;
    const effD = hasRailBoxes ? pallet.depth + RAIL_OVERHANG : pallet.depth + OVERHANG_Z;
    const cols = Math.ceil(effW / STEP);
    const rows = Math.ceil(effD / STEP);

    const grid = Array(cols).fill(null).map(() => Array(rows).fill(null).map(() => ({ y: 0, productId: null, boxIndex: null })));
    const usedIndices = new Set();
    const lockedOrientations = new Map(presetOrientations);

    for (let i = 0; i < queue.length; i++) {
        const box = queue[i];
        const typeKey = `${box.productId}-${box.boxIndex}`;
        let bestPos = null;
        let bestScore = Infinity;

        // --- orientation choice (per product type) ---
        if (!lockedOrientations.has(typeKey)) {
            const trials = [];
            trials.push({ w: box.width, d: box.depth, h: box.height, rotated: false });
            trials.push({ w: box.depth, d: box.width, h: box.height, rotated: true });

            if (box.allowEdge) {
                trials.push({ w: box.width, d: box.height, h: box.depth, rotated: true });
                trials.push({ w: box.height, d: box.width, h: box.depth, rotated: true });
                trials.push({ w: box.height, d: box.depth, h: box.width, rotated: true });
                trials.push({ w: box.depth, d: box.height, h: box.width, rotated: true });
            }

            let bestTrial = null;
            let bestTrialScore = Infinity;
            const typeCount = queue.filter(b => `${b.productId}-${b.boxIndex}` === typeKey).length;

            for (const orient of trials) {
                if (orient.d > effD || orient.w > effW) continue;
                const bc = Math.ceil(orient.w / STEP);
                const br = Math.ceil(orient.d / STEP);
                const palletCenter = effW / 2;

                for (let c = 0; c <= cols - bc; c++) {
                    for (let r = 0; r <= rows - br; r++) {
                        let curY = 0;
                        for (let ic = c; ic < c + bc; ic++) {
                            for (let ir = r; ir < r + br; ir++) {
                                if (grid[ic][ir].y > curY) curY = grid[ic][ir].y;
                            }
                        }
                        if (curY + orient.h + pallet.height > MAX_HEIGHT) continue;

                        const boxCenter = (c * STEP) + (orient.w / 2);
                        const targetX = typeCount >= 2 ? (palletCenter - orient.w / 2) : palletCenter;
                        const centeringPenalty = Math.abs(boxCenter - targetX);
                        let tScore = (curY * 100) + (centeringPenalty * 10);
                        if (curY > 0) tScore += 1000000;

                        if (tScore < bestTrialScore) {
                            bestTrialScore = tScore;
                            bestTrial = orient;
                        }
                    }
                }
            }
            lockedOrientations.set(typeKey, bestTrial || trials[0]);
        }

        const orientation = lockedOrientations.get(typeKey);
        const bc = Math.ceil(orientation.w / STEP);
        const br = Math.ceil(orientation.d / STEP);
        const typeCountForPos = queue.filter(b => `${b.productId}-${b.boxIndex}` === typeKey).length;

        for (let c = 0; c <= cols - bc; c++) {
            for (let r = 0; r <= rows - br; r++) {
                let maxY = 0;
                let topProductId = null;
                let topBoxIndex = null;
                
                for (let ic = c; ic < c + bc; ic++) {
                    for (let ir = r; ir < r + br; ir++) {
                        if (grid[ic][ir].y > maxY) {
                            maxY = grid[ic][ir].y;
                            topProductId = grid[ic][ir].productId;
                            topBoxIndex = grid[ic][ir].boxIndex;
                        }
                    }
                }
                if (maxY + orientation.h + pallet.height > MAX_HEIGHT) continue;

                // --- STACKING SCORING ---
                const palletCenter = effW / 2;
                const xStart = c * STEP;
                const boxCenter = xStart + orientation.w / 2;
                const centeringPenalty = Math.abs(boxCenter - palletCenter);

                let score = (maxY * 100) + (centeringPenalty * 10);

                // SPECIAL HANDLING FOR WATERROWER PRODUCTS
                const isWaterRowerTank = (box.productId === 'wr-s4' || box.productId === 'wr-a1') && box.boxIndex === 0;
                const isWaterRowerRail = (box.productId === 'wr-s4' || box.productId === 'wr-a1') && box.boxIndex === 1;
                const isOnOtherWaterRowerTank = (topProductId === 'wr-s4' || topProductId === 'wr-a1') && topBoxIndex === 0;
                const isOnSameProductTank = topProductId === box.productId && topBoxIndex === 0;
                
                if (isWaterRowerTank) {
                    // Strongly prefer ground level for WaterRower tanks
                    if (maxY === 0) {
                        score -= 8000000;
                    }
                    // NEVER stack WaterRower tanks on top of each other
                    if (maxY > 0 && isOnOtherWaterRowerTank) {
                        score += 50000000; // Massive penalty
                    }
                    // Prefer positions next to other WaterRower tanks (side by side)
                    const adjacentTanks = arranged.filter(i => 
                        (i.productId === 'wr-s4' || i.productId === 'wr-a1') && 
                        i.boxIndex === 0 &&
                        Math.abs((i.position[1] - i.height / 2) - pallet.height) < 5
                    ).length;
                    if (maxY === 0 && adjacentTanks > 0) {
                        score -= 2000000; // Bonus for being next to other tanks on ground
                    }
                } else if (isWaterRowerRail) {
                    // WaterRower rail boxes MUST stack on top of their own tank
                    if (maxY > 0 && isOnSameProductTank) {
                        score -= 20000000; // Massive bonus for stacking on own tank
                    } else if (maxY === 0) {
                        score += 100000000; // Massive penalty for ground placement
                    } else {
                        score += 50000000; // Massive penalty for stacking on wrong items
                    }
                } else {
                    // PRIORITY 1: Stack identical items directly on top of each other
                    if (maxY > 0 && topProductId === box.productId && topBoxIndex === box.boxIndex) {
                        score -= 10000000; // Huge bonus for stacking same items
                    }
                    
                    // PRIORITY 2: Prefer ground level for first items
                    if (maxY === 0) {
                        score -= 5000000;
                    }
                    
                    // PENALTY: Avoid stacking on different items
                    if (maxY > 0 && (topProductId !== box.productId || topBoxIndex !== box.boxIndex)) {
                        score += 3000000;
                    }
                }

                if (score < bestScore) {
                    bestScore = score;
                    bestPos = {
                        x: c * STEP,
                        z: r * STEP,
                        y: maxY,
                        w: orientation.w,
                        d: orientation.d,
                        h: orientation.h,
                        c, r,
                        rotated: orientation.rotated
                    };
                }
            }
        }

        if (bestPos) {
            arranged.push({
                ...box,
                rotated: bestPos.rotated,
                width: bestPos.w,
                depth: bestPos.d,
                height: bestPos.h,
                position: [
                    bestPos.x + bestPos.w / 2 - effW / 2,
                    bestPos.y + bestPos.h / 2 + pallet.height,
                    bestPos.z + bestPos.d / 2 - effD / 2
                ]
            });
            const bcArr = Math.ceil(bestPos.w / STEP);
            const brArr = Math.ceil(bestPos.d / STEP);
            for (let ic = bestPos.c; ic < bestPos.c + bcArr; ic++) {
                for (let ir = bestPos.r; ir < bestPos.r + brArr; ir++) {
                    grid[ic][ir] = { y: bestPos.y + bestPos.h, productId: box.productId, boxIndex: box.boxIndex };
                }
            }
            usedIndices.add(i);
        } else {
            break;
        }
    }

    const remainingQueue = queue.filter((_, idx) => !usedIndices.has(idx));
    let loadWidth = 0;
    let loadDepth = 0;

    if (arranged.length > 0) {
        const minX = Math.min(...arranged.map(i => i.position[0] - i.width / 2));
        const maxX = Math.max(...arranged.map(i => i.position[0] + i.width / 2));
        const minZ = Math.min(...arranged.map(i => i.position[2] - i.depth / 2));
        const maxZ = Math.max(...arranged.map(i => i.position[2] + i.depth / 2));
        const shiftX = -(minX + maxX) / 2;
        const shiftZ = -(minZ + maxZ) / 2;
        arranged.forEach(i => { i.position[0] += shiftX; i.position[2] += shiftZ; });

        // Account for pallet dimension as the floor: if load is smaller, report pallet size.
        loadWidth = Math.round(Math.max(pallet.width, maxX - minX));
        loadDepth = Math.round(Math.max(pallet.depth, maxZ - minZ));
    } else {
        loadWidth = pallet.width;
        loadDepth = pallet.depth;
    }

    return {
        arranged,
        remainingQueue,
        totalHeight: Math.round(arranged.length > 0 ? Math.max(...arranged.map(i => i.position[1] + i.height / 2)) : pallet.height),
        loadWidth,
        loadDepth,
        orientations: lockedOrientations
    };
}

export function calculateVisGeometry(items, palletType = 'AU_CHEP') {
    const pallet = PALLET_TYPES[palletType];
    let totalQueue = [];
    items.forEach(i => {
        for (let q = 0; q < i.quantity; q++) {
            totalQueue.push({ ...i, quantity: 1, boxUid: Math.random().toString(36).substr(2, 6) });
        }
    });

    // Group boxes by productId to keep multi-box products together
    const grouped = {};
    totalQueue.forEach(item => {
        const key = item.productId;
        if (!grouped[key]) grouped[key] = [];
        grouped[key].push(item);
    });

    // Sort each group internally by boxIndex (tank first, rail second)
    Object.values(grouped).forEach(group => {
        group.sort((a, b) => a.boxIndex - b.boxIndex);
    });

    // Sort groups by the size of their largest box (tanks)
    const sortedGroups = Object.values(grouped).sort((groupA, groupB) => {
        const largestA = groupA[0]; // First item (tank)
        const largestB = groupB[0];
        const areaA = largestA.width * largestA.depth;
        const areaB = largestB.width * largestB.depth;
        if (areaA !== areaB) return areaB - areaA;
        const volA = areaA * largestA.height;
        const volB = areaB * largestB.height;
        if (volA !== volB) return volB - volA;
        if (largestA.weight !== largestB.weight) return largestB.weight - largestA.weight;
        return (largestB.rigidityRating || 10) - (largestA.rigidityRating || 10);
    });

    // Flatten back to a queue (tanks followed immediately by their rails)
    totalQueue = sortedGroups.flat();

    const pallets = [];
    let currentQueue = totalQueue;
    let safety = 0;

    while (currentQueue.length > 0 && safety < 100) {
        safety++;
        const firstBox = currentQueue[0];
        const typeKey = `${firstBox.productId}-${firstBox.boxIndex}`;

        const o1 = { w: firstBox.width, d: firstBox.depth, h: firstBox.height, rotated: false };
        const o2 = { w: firstBox.depth, d: firstBox.width, h: firstBox.height, rotated: true };

        // If user forced a rotation OR allowed edge-stacking, we skip the automated "best of 2" trial 
        // because the user wants control (manual rotate) or the packSinglePallet will handle the 6-trial complexity.
        let winner;
        if (firstBox.forceRotation || firstBox.allowEdge) {
            winner = packSinglePallet(currentQueue, pallet, new Map([[typeKey, o1]]));
        } else {
            const r1 = packSinglePallet(currentQueue, pallet, new Map([[typeKey, o1]]));
            const r2 = packSinglePallet(currentQueue, pallet, new Map([[typeKey, o2]]));

            winner = r1;
            if (r2.arranged.length > r1.arranged.length) winner = r2;
            else if (r2.arranged.length === r1.arranged.length && r2.totalHeight < r1.totalHeight) winner = r2;
        }

        if (winner.arranged.length === 0) {
            // EMERGENCY SAFETY: If we can't pack the first box, it might be too large for the pallet.
            // Skip the problematic box to prevent infinite loops or long hangs.
            currentQueue = currentQueue.slice(1);
            continue;
        }

        pallets.push({
            pallet,
            items: winner.arranged,
            totalHeight: Math.round(winner.totalHeight),
            loadWidth: winner.loadWidth,
            loadDepth: winner.loadDepth,
            totalWeight: Math.round(winner.arranged.reduce((sum, item) => sum + item.weight, 0) + pallet.weight)
        });
        currentQueue = winner.remainingQueue;
    }

    return pallets;
}
