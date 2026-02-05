
import React, { useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Stage, Grid, Text, PerspectiveCamera, ContactShadows, Environment } from '@react-three/drei';
import * as THREE from 'three';

// --- Constants ---
const CHEP_BLUE = "#00539F";
const CHEP_DARK = "#003e78";
const WOOD_COLOR = "#E3BC8B";
const WOOD_ROUGHNESS = 0.9;
const PAINT_ROUGHNESS = 0.6;

// --- Sub-Components ---

function Plank({ position, args, isTop = false }) {
    const materials = useMemo(() => {
        const blueMat = new THREE.MeshStandardMaterial({ color: CHEP_BLUE, roughness: PAINT_ROUGHNESS });
        const woodMat = new THREE.MeshStandardMaterial({ color: WOOD_COLOR, roughness: WOOD_ROUGHNESS });

        if (!isTop) return blueMat;
        // Material Indices: 0:Right, 1:Left, 2:Top, 3:Bottom, 4:Front, 5:Back
        return [blueMat, blueMat, woodMat, blueMat, blueMat, blueMat];
    }, [isTop]);

    return (
        <mesh position={position} material={materials} castShadow receiveShadow>
            <boxGeometry args={args} />
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(...args)]} />
                <lineBasicMaterial color="#000" linewidth={1} transparent opacity={0.2} />
            </lineSegments>
        </mesh>
    );
}

function ChepPallet({ width: w, depth: d, height: h }) {
    const deckThick = 25;
    const bearerW = 50;
    const bearerH = h - (deckThick * 2);

    const topPlanks = useMemo(() => {
        const planks = [];
        const leadW = 145;
        const innerW = 98;
        const totalWood = (leadW * 2) + (innerW * 5);
        const gap = (d - totalWood) / 6;

        let currentZ = -d / 2 + leadW / 2;
        planks.push({ w: w, h: deckThick, d: leadW, z: currentZ });
        currentZ += leadW / 2 + gap + innerW / 2;
        for (let i = 0; i < 5; i++) {
            planks.push({ w: w, h: deckThick, d: innerW, z: currentZ });
            currentZ += innerW / 2 + gap + (i === 4 ? leadW / 2 : innerW / 2);
        }
        planks.push({ w: w, h: deckThick, d: leadW, z: d / 2 - leadW / 2 });
        return planks;
    }, [w, d]);

    const bearers = [-w / 2 + bearerW / 2, 0, w / 2 - bearerW / 2];

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
            {topPlanks.map((p, i) => (
                <Plank key={`top-${i}`} position={[0, h / 2 - p.h / 2, p.z]} args={[p.w, p.h, p.d]} isTop={true} />
            ))}
            {bearers.map((x, i) => (
                <group key={`bearer-${i}`} position={[x, 0, 0]}>
                    <Plank position={[0, 0, 0]} args={[bearerW, bearerH, d]} />
                    {i !== 1 && (
                        <group position={[i === 0 ? -bearerW / 2 - 1 : bearerW / 2 + 1, 0, 0]} rotation={[0, i === 0 ? -Math.PI / 2 : Math.PI / 2, 0]}>
                            <Text position={[0, 0, 0]} fontSize={32} color="white" fontWeight={800}>CHEP</Text>
                        </group>
                    )}
                </group>
            ))}
            {bottomPlanks.map((p, i) => (
                <Plank key={`bot-${i}`} position={[0, -h / 2 + p.h / 2, p.z]} args={[p.w, p.h, p.d]} />
            ))}
        </group>
    );
}

function EpalPallet({ width: w, depth: d, height: h }) {
    const deckThick = 22;
    const blockH = 78;
    const FRESH_WOOD = "#d2a679";

    return (
        <group position={[0, h / 2, 0]}>
            {/* Simple but recognizable EPAL */}
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color={FRESH_WOOD} roughness={WOOD_ROUGHNESS} />
            </mesh>
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
                <lineBasicMaterial color="#000" linewidth={1} transparent opacity={0.3} />
            </lineSegments>
            <Text position={[w / 2 - 100, 0, d / 2 + 2]} fontSize={40} color="black" fontWeight={900}>EUR</Text>
            <Text position={[-w / 2 + 100, 0, d / 2 + 2]} fontSize={40} color="black" fontWeight={900}>EPAL</Text>
        </group>
    );
}

function PlasticPallet({ width: w, depth: d, height: h }) {
    return (
        <group position={[0, h / 2, 0]}>
            <mesh position={[0, 0, 0]} castShadow receiveShadow>
                <boxGeometry args={[w, h, d]} />
                <meshStandardMaterial color="#222" roughness={0.5} />
            </mesh>
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(w, h, d)]} />
                <lineBasicMaterial color="#000" linewidth={1} transparent opacity={0.5} />
            </lineSegments>
            <Text position={[0, h / 2 + 1, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={40} color="#444" fontWeight={900}>PLASTIC</Text>
        </group>
    );
}

function PalletBase({ pallet }) {
    if (pallet.name.includes('CHEP')) return <ChepPallet {...pallet} />;
    if (pallet.name.includes('EPAL')) return <EpalPallet {...pallet} />;
    if (pallet.name.includes('Plastic')) return <PlasticPallet {...pallet} />;
    return (
        <group position={[0, pallet.height / 2, 0]}>
            <mesh castShadow receiveShadow>
                <boxGeometry args={[pallet.width, pallet.height, pallet.depth]} />
                <meshStandardMaterial color="#C19A6B" />
            </mesh>
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(pallet.width, pallet.height, pallet.depth)]} />
                <lineBasicMaterial color="#000" linewidth={1} transparent opacity={0.4} />
            </lineSegments>
        </group>
    );
}

function BoxItem({ item, isHovered, onSelect }) {
    // Safety check: dimensions and position must be valid numbers to prevent 3D context crash
    if (!item.width || !item.height || !item.depth ||
        item.width <= 0 || item.height <= 0 || item.depth <= 0) {
        return null;
    }
    if (!item.position || item.position.length < 3 || item.position.some(v => isNaN(v))) {
        return null;
    }

    const label = item.productId === 'slimbeam' ? 'SLIM' :
        item.productId === 'sprintbok' ? 'SPRINT' :
            item.productId?.includes('wr-') ? 'WR' : 'BOX';

    const dimsLabel = `${(item.width / 10).toFixed(0)}×${(item.depth / 10).toFixed(0)}×${(item.height / 10).toFixed(0)}cm`;
    const isUnderStress = item.crushRisk > 0.7;

    return (
        <group
            position={item.position}
            onClick={(e) => {
                e.stopPropagation();
                onSelect(item.id || item.productId);
            }}
        >
            <mesh castShadow receiveShadow>
                <boxGeometry args={[item.width, item.height, item.depth]} />
                <meshStandardMaterial
                    color={isHovered ? "#3b82f6" : (isUnderStress ? "#ef4444" : item.color || "#faa")}
                    emissive={isHovered ? "#3b82f6" : (isUnderStress ? "#b91c1c" : "#000")}
                    emissiveIntensity={isHovered ? 0.2 : (isUnderStress ? 0.4 : 0)}
                    roughness={0.7}
                />
            </mesh>

            {/* Permanent Technical Outlines */}
            <lineSegments>
                <edgesGeometry args={[new THREE.BoxGeometry(item.width, item.height, item.depth)]} />
                <lineBasicMaterial color={isHovered ? "#fff" : "#000"} linewidth={1} transparent={false} opacity={1} />
            </lineSegments>

            {isHovered && (
                <mesh>
                    <boxGeometry args={[item.width + 2, item.height + 2, item.depth + 2]} />
                    <meshBasicMaterial color="#FF4D00" wireframe />
                </mesh>
            )}

            <Text
                position={[0, item.height / 2 + 2, 0]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={Math.max(16, Math.min(item.width, item.depth) * 0.12)}
                color={isHovered ? "#fff" : "#000"}
                fontWeight={900}
            // Removed external font to prevent potential network/loading crashes
            >
                {label}
            </Text>

            {isHovered && (
                <Text
                    position={[0, 0, item.depth / 2 + 20]}
                    fontSize={24}
                    color="#fff"
                    fontWeight={400}
                // Removed external font
                >
                    {dimsLabel}
                </Text>
            )}
        </group>
    );
}

export default function Pallet3D({ data, hoveredItemId, onSelectItem }) {
    const { pallet, items } = data;

    return (
        <div style={{ width: '100%', height: '100%', minHeight: '600px', background: '#111', borderRadius: '12px', overflow: 'hidden' }}>
            <Canvas shadows camera={{ position: [3000, 3000, 3000], fov: 35, near: 1, far: 50000 }} onPointerMissed={() => onSelectItem(null)}>
                <color attach="background" args={['#1a1b1e']} />

                <ambientLight intensity={1.0} />
                <pointLight position={[2000, 5000, 2000]} intensity={1.5} castShadow shadow-mapSize={[2048, 2048]} />
                <directionalLight position={[-2000, 3000, 1000]} intensity={0.8} />



                <group position={[0, -500, 0]}>
                    <PalletBase pallet={pallet} />

                    {/* LASER-LOGIC CG Marker */}
                    {data.cg && (
                        <group position={[data.cg.x, 5, data.cg.z]}>
                            <mesh>
                                <boxGeometry args={[120, 2, 2]} />
                                <meshBasicMaterial color="#FF4D00" />
                            </mesh>
                            <mesh>
                                <boxGeometry args={[2, 2, 120]} />
                                <meshBasicMaterial color="#FF4D00" />
                            </mesh>
                            <Text position={[20, 10, 20]} rotation={[-Math.PI / 2, 0, 0]} fontSize={24} color="#FF4D00" fontWeight={900}>CG</Text>
                        </group>
                    )}

                    {items && items.map((item, idx) => (
                        <BoxItem
                            key={idx}
                            item={item}
                            isHovered={hoveredItemId === (item.id || item.productId)}
                            onSelect={onSelectItem}
                        />
                    ))}

                    <ContactShadows
                        position={[0, 0, 0]}
                        opacity={0.4}
                        scale={5000}
                        blur={2}
                        far={1000}
                    />
                </group>

                <OrbitControls makeDefault target={[0, 0, 0]} minDistance={500} maxDistance={20000} />
                <Grid infiniteGrid sectionColor="#444" cellColor="#222" position={[0, -501, 0]} fadeDistance={10000} sectionSize={1000} />
            </Canvas>
        </div>
    );
}
