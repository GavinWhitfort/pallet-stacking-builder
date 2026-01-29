
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Text, PerspectiveCamera } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const CHEP_BLUE = "#00539F";
const CHEP_DARK = "#003e78";
const WOOD_COLOR = "#E3BC8B"; // Fresh pine look
const WOOD_ROUGHNESS = 0.9;
const PAINT_ROUGHNESS = 0.6;

// --- Sub-Components ---

function Plank({ position, args, isTop = false }) {
    // Use useMemo to create the material array once to save perf
    const materials = useMemo(() => {
        const blueMat = new THREE.MeshBasicMaterial({ color: CHEP_BLUE });
        const woodMat = new THREE.MeshBasicMaterial({ color: WOOD_COLOR });

        if (!isTop) return blueMat; // Full blue for bottom boards/bearers

        // For Top Planks: Sides are blue, Top is wood
        // Material Indices: 0:Right, 1:Left, 2:Top, 3:Bottom, 4:Front, 5:Back
        return [
            blueMat, // Right
            blueMat, // Left
            woodMat, // Top
            blueMat, // Bottom
            blueMat, // Front
            blueMat  // Back (Ends)
        ];
    }, [isTop]);

    return (
        <mesh position={position} material={materials}>
            <boxGeometry args={args} />
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(...args)]} />
                <lineBasicMaterial color="rgba(0,0,0,0.1)" linewidth={1} />
            </lineSegments>
        </mesh>
    );
}

function ChepPallet({ width: w, depth: d, height: h }) {
    // Dimensions 
    const deckThick = 25;
    const boardCount = 7; // 2 Lead (150mm), 5 Internal (100mm) approx
    const bearerW = 50;   // Width of the 3 runners
    const bearerH = h - (deckThick * 2);

    // -- Generators --

    // 1. Top Deck Planks (Wood Top, Blue Sides)
    // Logic: 2 lead boards (wide), 5 internal (narrower), spaced evenly
    const topPlanks = useMemo(() => {
        const planks = [];
        const leadW = 145;
        const innerW = 98;
        const totalWood = (leadW * 2) + (innerW * 5);
        const gap = (d - totalWood) / 6; // 6 gaps for 7 boards

        let currentZ = -d / 2 + leadW / 2;

        // 1. Front Lead
        planks.push({ w: w, h: deckThick, d: leadW, z: currentZ });
        currentZ += leadW / 2 + gap + innerW / 2;

        // 2. Internal 5
        for (let i = 0; i < 5; i++) {
            planks.push({ w: w, h: deckThick, d: innerW, z: currentZ });
            currentZ += innerW / 2 + gap + (i === 4 ? leadW / 2 : innerW / 2);
        }

        // 3. Back Lead
        planks.push({ w: w, h: deckThick, d: leadW, z: d / 2 - leadW / 2 });

        return planks;
    }, [w, d]);

    // 2. Bearers (Solid Blue) - Left, Center, Right
    const bearers = [-w / 2 + bearerW / 2, 0, w / 2 - bearerW / 2];

    // 3. Bottom Boards (Solid Blue)
    // Logic: Matches Top layout roughly, but usually just 3-5 boards. Let's do 3 wider structural boards + 2 thin
    // Simpler: 5 uniform boards for stability
    const bottomPlanks = useMemo(() => {
        const planks = [];
        const bW = 120;
        const gap = (d - (bW * 5)) / 4;
        let z = -d / 2 + bW / 2;
        for (let i = 0; i < 5; i++) {
            planks.push({ w: w, h: deckThick, d: bW, z: z });
            z += bW + gap;
        }
        return planks;
    }, [w, d]);

    return (
        <group position={[0, h / 2, 0]}>

            {/* Top Deck */}
            {topPlanks.map((p, i) => (
                <Plank key={`top-${i}`} position={[0, h / 2 - p.h / 2, p.z]} args={[p.w, p.h, p.d]} isTop={true} />
            ))}

            {/* Bearers */}
            {bearers.map((x, i) => (
                <group key={`bearer-${i}`} position={[x, 0, 0]}>
                    <Plank position={[0, 0, 0]} args={[bearerW, bearerH, d]} />

                    {/* Text Decals on Outer Bearers */}
                    {i !== 1 && (
                        <group position={[i === 0 ? -bearerW / 2 - 1 : bearerW / 2 + 1, 0, 0]} rotation={[0, i === 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
                            {/* Left Logo Block */}
                            <mesh position={[-d / 2 + 70, 0, 0]} rotation={[0, 0, 0]}>
                                <Text fontSize={32} color="white" anchorX="center" anchorY="middle" letterSpacing={-0.05} fontWeight={800}>
                                    CHE
                                </Text>
                                {/* P hack to look like logo */}
                                <Text fontSize={32} color="white" position={[38, 0, 0]} anchorX="center" anchorY="middle" fontWeight={800}>P</Text>
                            </mesh>

                            {/* Right Text Block */}
                            <mesh position={[d / 2 - 100, 0, 0]}>
                                <Text fontSize={12} color="white" anchorX="right" anchorY="middle" position={[0, 8, 0]}>PROPERTY</Text>
                                <Text fontSize={12} color="white" anchorX="right" anchorY="middle" position={[0, -8, 0]}>OF CHEP</Text>
                            </mesh>
                        </group>
                    )}
                </group>
            ))}

            {/* Bottom Deck */}
            {bottomPlanks.map((p, i) => (
                <Plank key={`bot-${i}`} position={[0, -h / 2 + p.h / 2, p.z]} args={[p.w, p.h, p.d]} />
            ))}
        </group>
    );
}



function BrandStamp({ text, type = 'oval' }) {
    return (
        <group>
            {/* Oval Border */}
            {type === 'oval' && (
                <mesh rotation={[0, 0, 0]}>
                    <ringGeometry args={[28, 30, 32]} />
                    <meshBasicMaterial color="black" side={THREE.DoubleSide} />
                </mesh>
            )}
            {/* Rect Border for center */}
            {type === 'rect' && (
                <mesh>
                    <planeGeometry args={[60, 40]} />
                    <meshBasicMaterial color="#d4c5a9" />
                    <lineSegments>
                        <edgesGeometry args={[new THREE.PlaneGeometry(60, 40)]} />
                        <lineBasicMaterial color="black" linewidth={1} />
                    </lineSegments>
                </mesh>
            )}
            <Text position={[0, 0, 0]} fontSize={16} color="black" fontWeight={900} anchorX="center" anchorY="middle">
                {text}
            </Text>
        </group>
    );
}

function EpalPallet({ width: w, depth: d, height: h }) {
    // Dimensions 1200(W) x 800(D)
    // Top boards run along W (1200)
    // Cross boards run along D (800)

    const deckThick = 22;
    const blockH = 78;
    const blockSize = 145;

    // Wood Colors
    const FRESH_WOOD = "#d2a679"; // Warm Oak
    const DARK_WOOD = "#a67f53"; // Darker Oak End grains

    // --- 1. Bottom Deck (Runs along W) ---
    const botBoards = [
        { z: -d / 2 + 50, w: w, d: 100 }, // Front
        { z: 0, w: w, d: 145 },         // Mid
        { z: d / 2 - 50, w: w, d: 100 }   // Back
    ];

    // --- 2. Blocks ---
    const blocks = [
        // Front Row (Near Z)
        { x: -w / 2 + 72.5, z: -d / 2 + 50, label: 'EPAL' },   // Left
        { x: 0, z: -d / 2 + 50, label: 'IPPC', shape: 'rect' },            // Center
        { x: w / 2 - 72.5, z: -d / 2 + 50, label: 'EUR' },    // Right

        // Middle Row
        { x: -w / 2 + 72.5, z: 0 },
        { x: 0, z: 0 },
        { x: w / 2 - 72.5, z: 0 },

        // Back Row
        { x: -w / 2 + 72.5, z: d / 2 - 50, label: 'EPAL' },
        { x: 0, z: d / 2 - 50, label: 'IPPC', shape: 'rect' },
        { x: w / 2 - 72.5, z: d / 2 - 50, label: 'EUR' },
    ];

    // --- 3. Cross Boards (Runs along D) ---
    // Sit on top of blocks
    const crossBoards = [
        { x: -w / 2 + 72.5, w: 145, d: d }, // Left
        { x: 0, w: 145, d: d },           // Center
        { x: w / 2 - 72.5, w: 145, d: d }   // Right
    ];

    // --- 4. Top Deck (Runs along W) ---
    // Sit on top of cross boards
    // 5 Boards
    const topConfig = [145, 100, 145, 100, 145];
    // Calculate gaps
    const totalWoodDepth = topConfig.reduce((a, b) => a + b, 0); // 635
    const gap = (d - totalWoodDepth) / 4; // Approx 41mm

    let currentZ = -d / 2 + 145 / 2;
    const topBoards = topConfig.map((bw, i) => {
        const posZ = currentZ;
        if (i < 4) currentZ += bw / 2 + gap + topConfig[i + 1] / 2;
        return { w: w, d: bw, z: posZ };
    });


    return (
        <group position={[0, h / 2, 0]}>

            {/* BOTTOM DECK */}
            {botBoards.map((b, i) => (
                <mesh key={`bot-${i}`} position={[0, -h / 2 + deckThick / 2, b.z]}>
                    <boxGeometry args={[b.w, deckThick, b.d]} />
                    <meshBasicMaterial color={FRESH_WOOD} />
                    <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(b.w, deckThick, b.d)]} /><lineBasicMaterial color="#AA9977" /></lineSegments>
                </mesh>
            ))}

            {/* BLOCKS */}
            {blocks.map((blk, i) => (
                <group key={`blk-${i}`} position={[blk.x, -h / 2 + deckThick + blockH / 2, blk.z]}>
                    <mesh>
                        <boxGeometry args={[145, blockH, 100]} />{/* Average block size */}
                        <meshBasicMaterial color={DARK_WOOD} />
                        <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(145, blockH, 100)]} /><lineBasicMaterial color="#887755" /></lineSegments>
                    </mesh>

                    {/* Labels on Outer Blocks (Z faces) */}
                    {blk.label && (
                        <group position={[0, 0, (blk.z < 0 ? -51 : 51)]} rotation={[0, (blk.z < 0 ? Math.PI : 0), 0]}>
                            <BrandStamp text={blk.label} type={blk.shape || 'oval'} />
                        </group>
                    )}
                    {/* Labels on Outer Blocks (X faces - Sides) */}
                    {(i === 0 || i === 2 || i === 6 || i === 8) && (
                        <group position={[(blk.x < 0 ? -73 : 73), 0, 0]} rotation={[0, (blk.x < 0 ? -Math.PI / 2 : Math.PI / 2), 0]}>
                            <BrandStamp text={blk.label} type='oval' />
                        </group>
                    )}
                </group>
            ))}

            {/* CROSS BOARDS */}
            {crossBoards.map((cb, i) => (
                <mesh key={`cross-${i}`} position={[cb.x, -h / 2 + deckThick + blockH + deckThick / 2, 0]}>
                    <boxGeometry args={[cb.w, deckThick, cb.d]} />
                    <meshBasicMaterial color={FRESH_WOOD} />
                    <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(cb.w, deckThick, cb.d)]} /><lineBasicMaterial color="#AA9977" /></lineSegments>
                </mesh>
            ))}

            {/* TOP DECK */}
            {topBoards.map((tb, i) => (
                <mesh key={`top-${i}`} position={[0, h / 2 - deckThick / 2, tb.z]}>
                    <boxGeometry args={[tb.w, deckThick, tb.d]} />
                    <meshBasicMaterial color={FRESH_WOOD} />
                    <lineSegments><edgesGeometry args={[new THREE.BoxGeometry(tb.w, deckThick, tb.d)]} /><lineBasicMaterial color="#AA9977" /></lineSegments>
                </mesh>
            ))}
        </group>
    );
}

function PlasticPallet({ width: w, depth: d, height: h }) {
    const PLASTIC_COLOR = "#ffffff";
    const deckThick = 35;
    const blockH = h - deckThick;
    const runnerW = 160;

    // Legs (9 blocks)
    const legPositions = [
        { x: -w / 2 + runnerW / 2, z: -d / 2 + runnerW / 2 },
        { x: 0, z: -d / 2 + runnerW / 2 },
        { x: w / 2 - runnerW / 2, z: -d / 2 + runnerW / 2 },
        { x: -w / 2 + runnerW / 2, z: 0 },
        { x: 0, z: 0 },
        { x: w / 2 - runnerW / 2, z: 0 },
        { x: -w / 2 + runnerW / 2, z: d / 2 - runnerW / 2 },
        { x: 0, z: d / 2 - runnerW / 2 },
        { x: w / 2 - runnerW / 2, z: d / 2 - runnerW / 2 },
    ];

    return (
        <group position={[0, h / 2, 0]}>
            {/* Top Deck - Grid Structure */}
            <group position={[0, h / 2 - deckThick / 2, 0]}>
                {/* Frame */}
                <mesh position={[0, 0, -d / 2 + 20]}><boxGeometry args={[w, deckThick, 40]} /><meshBasicMaterial color={PLASTIC_COLOR} /></mesh>
                <mesh position={[0, 0, d / 2 - 20]}><boxGeometry args={[w, deckThick, 40]} /><meshBasicMaterial color={PLASTIC_COLOR} /></mesh>
                <mesh position={[-w / 2 + 20, 0, 0]}><boxGeometry args={[40, deckThick, d]} /><meshBasicMaterial color={PLASTIC_COLOR} /></mesh>
                <mesh position={[w / 2 - 20, 0, 0]}><boxGeometry args={[40, deckThick, d]} /><meshBasicMaterial color={PLASTIC_COLOR} /></mesh>

                {/* Main Cross */}
                <mesh position={[0, 0, 0]}><boxGeometry args={[w, deckThick, 40]} /><meshBasicMaterial color={PLASTIC_COLOR} /></mesh>
                <mesh position={[0, 0, 0]}><boxGeometry args={[40, deckThick, d]} /><meshBasicMaterial color={PLASTIC_COLOR} /></mesh>

                {/* Grid Fill */}
                {[...Array(8)].map((_, i) => (
                    <mesh key={`v-${i}`} position={[-w / 2 + (w / 9) * (i + 1), 0, 0]}>
                        <boxGeometry args={[8, deckThick - 10, d]} />
                        <meshBasicMaterial color="#eeeeee" />
                    </mesh>
                ))}
                {[...Array(8)].map((_, i) => (
                    <mesh key={`h-${i}`} position={[0, 0, -d / 2 + (d / 9) * (i + 1)]}>
                        <boxGeometry args={[w, deckThick - 10, 8]} />
                        <meshBasicMaterial color="#eeeeee" />
                    </mesh>
                ))}
            </group>

            {/* Blocks/Legs */}
            {legPositions.map((pos, i) => (
                <mesh key={i} position={[pos.x, -h / 2 + blockH / 2, pos.z]}>
                    <boxGeometry args={[runnerW, blockH, runnerW]} />
                    <meshBasicMaterial color={PLASTIC_COLOR} />
                    <lineSegments>
                        <edgesGeometry args={[new THREE.BoxGeometry(runnerW, blockH, runnerW)]} />
                        <lineBasicMaterial color="#cccccc" />
                    </lineSegments>
                </mesh>
            ))}

            {/* Bottom Connectors */}
            {[-w / 2 + runnerW / 2, 0, w / 2 - runnerW / 2].map((x, i) => (
                <mesh key={`run-${i}`} position={[x, -h / 2 + 10, 0]}>
                    <boxGeometry args={[runnerW, 20, d]} />
                    <meshBasicMaterial color={PLASTIC_COLOR} />
                </mesh>
            ))}
        </group>
    );
}

function PalletBase({ pallet }) {
    const isChep = pallet.name.includes('CHEP');
    const isEpal = pallet.name.includes('EPAL');
    const isPlastic = pallet.name.includes('Plastic');

    if (isChep) {
        return <ChepPallet width={pallet.width} depth={pallet.depth} height={pallet.height} />;
    }
    if (isEpal) {
        return <EpalPallet width={pallet.width} depth={pallet.depth} height={pallet.height} />;
    }
    if (isPlastic) {
        return <PlasticPallet width={pallet.width} depth={pallet.depth} height={pallet.height} />;
    }

    // Fallback Generic
    return (
        <group position={[0, pallet.height / 2, 0]}>
            <mesh position={[0, 0, 0]}>
                <boxGeometry args={[pallet.width, pallet.height, pallet.depth]} />
                <meshBasicMaterial color="#C19A6B" />
                <lineSegments>
                    <edgesGeometry args={[new THREE.BoxGeometry(pallet.width, pallet.height, pallet.depth)]} />
                    <lineBasicMaterial color="rgba(0,0,0,0.2)" />
                </lineSegments>
            </mesh>
        </group>
    );
}

function BoxItem({ item }) {
    // Extract short label from product name (e.g., "WaterRower S4" -> "S4")
    const getShortLabel = (name) => {
        if (!name) return '?';
        
        // Handle specific product patterns
        if (name.includes('SlimBeam')) return 'SLIM';
        if (name.includes('Sprintbok')) return 'SPRINT';
        if (name.includes('NOHrD Bike')) return 'BIKE';
        if (name.includes('Jumpsport')) {
            const match = name.match(/\d+/); // Extract number
            return match ? `JS${match[0]}` : 'JS';
        }
        if (name.includes('PD Rower')) return 'PD-R';
        if (name.includes('PD Bike')) return 'PD-B';
        
        // Default: Extract the last word/code
        const parts = name.split(' ');
        return parts[parts.length - 1] || name.substring(0, 6).toUpperCase();
    };
    
    const label = getShortLabel(item.name);
    const fontSize = Math.min(item.width, item.height, item.depth) * 0.12; // Scale based on smallest dimension
    const minSize = 25;
    const maxSize = 70;
    const finalFontSize = Math.max(minSize, Math.min(maxSize, fontSize));
    
    return (
        <mesh position={item.position}>
            <boxGeometry args={[item.width, item.height, item.depth]} />
            <meshBasicMaterial color={item.color || "#faa"} toneMapped={false} />
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(item.width, item.height, item.depth)]} />
                <lineBasicMaterial color="#000" linewidth={1} />
            </lineSegments>
            
            {/* Labels on all 6 sides */}
            {/* Front Face (+Z) */}
            <Text 
                position={[0, 0, item.depth / 2 + 1]} 
                fontSize={finalFontSize} 
                color="#000" 
                fontWeight={900}
                anchorX="center" 
                anchorY="middle"
            >
                {label}
            </Text>
            
            {/* Back Face (-Z) */}
            <Text 
                position={[0, 0, -item.depth / 2 - 1]} 
                rotation={[0, Math.PI, 0]} 
                fontSize={finalFontSize} 
                color="#000" 
                fontWeight={900}
                anchorX="center" 
                anchorY="middle"
            >
                {label}
            </Text>
            
            {/* Right Face (+X) */}
            <Text 
                position={[item.width / 2 + 1, 0, 0]} 
                rotation={[0, Math.PI / 2, 0]} 
                fontSize={finalFontSize} 
                color="#000" 
                fontWeight={900}
                anchorX="center" 
                anchorY="middle"
            >
                {label}
            </Text>
            
            {/* Left Face (-X) */}
            <Text 
                position={[-item.width / 2 - 1, 0, 0]} 
                rotation={[0, -Math.PI / 2, 0]} 
                fontSize={finalFontSize} 
                color="#000" 
                fontWeight={900}
                anchorX="center" 
                anchorY="middle"
            >
                {label}
            </Text>
            
            {/* Top Face (+Y) */}
            <Text 
                position={[0, item.height / 2 + 1, 0]} 
                rotation={[-Math.PI / 2, 0, 0]} 
                fontSize={finalFontSize} 
                color="#000" 
                fontWeight={900}
                anchorX="center" 
                anchorY="middle"
            >
                {label}
            </Text>
            
            {/* Bottom Face (-Y) */}
            <Text 
                position={[0, -item.height / 2 - 1, 0]} 
                rotation={[Math.PI / 2, 0, 0]} 
                fontSize={finalFontSize} 
                color="#000" 
                fontWeight={900}
                anchorX="center" 
                anchorY="middle"
            >
                {label}
            </Text>
        </mesh>
    );
}

export default function Pallet3D({ data }) {
    const { pallet, items } = data;

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '400px', background: '#111', borderRadius: '12px', overflow: 'hidden' }}>
            <Canvas flat linear>
                <PerspectiveCamera makeDefault position={[4000, 4000, 4000]} fov={35} near={10} far={50000} />
                <color attach="background" args={['#1a1b1e']} />

                {/* Scene */}
                <group position={[0, -200, 0]}>
                    <PalletBase pallet={pallet} />
                    {items.map((item, idx) => <BoxItem key={idx} item={item} />)}
                </group>

                {/* Controls */}
                <OrbitControls makeDefault target={[0, 400, 0]} minDistance={1000} maxDistance={10000} />
                <Grid infiniteGrid sectionColor="#444" cellColor="#222" position={[0, -200, 0]} fadeDistance={4000} cellSize={100} sectionSize={1000} />
            </Canvas>
        </div>
    );
}
