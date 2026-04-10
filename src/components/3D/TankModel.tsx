import React, { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, DoubleSide } from 'three';
import { Cylinder, Box, Capsule, Text, Float } from '@react-three/drei';

interface TankModelProps {
    fuelLevel: number; // 0-100
    fuelType: string;
    capacity: number;
    shape?: 'cylinder' | 'rectangular' | 'capsule';
    height?: number;
    diameter?: number;
    length?: number;
}

export const TankModel: React.FC<TankModelProps> = ({
    fuelLevel,
    fuelType,
    shape = 'cylinder',
    height = 200,
    diameter = 150,
    length = 0,
}) => {
    const liquidRef = useRef<Mesh>(null);

    // Determine fuel color
    const fuelColor = useMemo(() => {
        switch (fuelType) {
            case 'diesel': return '#FFD700'; // Golden
            case 'gasoline': return '#FF4500'; // Orange-red
            case 'kerosene': return '#ADD8E6'; // Light blue
            default: return '#00D4FF'; // Electric Cyan
        }
    }, [fuelType]);

    // Scale factors to fit in a 3-unit high scene
    const scaleFactor = 3 / (height || 200);
    const radius = (diameter / 2) * scaleFactor;
    const boxWidth = (diameter * scaleFactor);
    const boxLength = (length || diameter) * scaleFactor;

    // Liquid animation (simple wave effect)
    useFrame((state) => {
        if (liquidRef.current) {
            const time = state.clock.getElapsedTime();
            liquidRef.current.rotation.y = Math.sin(time * 0.5) * 0.02;

            // Adjust position based on level
            const levelScale = fuelLevel / 100;
            if (shape === 'rectangular') {
                liquidRef.current.scale.set(1, levelScale, 1);
                liquidRef.current.position.y = (3 * levelScale) / 2 - 1.5;
            } else {
                // Cylinder and Capsule
                liquidRef.current.scale.set(1, levelScale || 0.01, 1);
                liquidRef.current.position.y = (3 * levelScale) / 2 - 1.5;
            }
        }
    });

    const renderShell = () => {
        const material = (
            <meshPhysicalMaterial
                color="#888888"
                transparent
                opacity={0.15}
                roughness={0.1}
                metalness={0.8}
                side={DoubleSide}
            />
        );

        switch (shape) {
            case 'rectangular':
                return <Box args={[boxWidth * 1.05, 3, boxLength * 1.05]}>{material}</Box>;
            case 'capsule':
                return <Capsule args={[radius * 1.05, 3 - radius * 2, 32, 32]}>{material}</Capsule>;
            case 'cylinder':
            default:
                return <Cylinder args={[radius * 1.05, radius * 1.05, 3, 32]}>{material}</Cylinder>;
        }
    };

    const renderLiquid = () => {
        const material = (
            <meshStandardMaterial
                color={fuelColor}
                transparent
                opacity={0.7}
                roughness={0.2}
                metalness={0.3}
            />
        );

        switch (shape) {
            case 'rectangular':
                return <Box args={[boxWidth, 3, boxLength]} ref={liquidRef}>{material}</Box>;
            case 'capsule':
                return <Capsule args={[radius, 3 - radius * 2, 32, 32]} ref={liquidRef}>{material}</Capsule>;
            case 'cylinder':
            default:
                return <Cylinder args={[radius, radius, 3, 32]} ref={liquidRef}>{material}</Cylinder>;
        }
    };

    return (
        <group>
            {/* Tank Shell (Outer) */}
            {renderShell()}

            {/* Fuel Liquid */}
            {renderLiquid()}

            {/* Level Labels */}
            <group position={[1.5, 0, 0]}>
                <Float speed={2} rotationIntensity={0.2} floatIntensity={0.5}>
                    <Text position={[0, 1.5, 0]} fontSize={0.15} color="#64748B" anchorX="left">100%</Text>
                    <Text position={[0, 0, 0]} fontSize={0.15} color="#64748B" anchorX="left">50%</Text>
                    <Text position={[0, -1.5, 0]} fontSize={0.15} color="#64748B" anchorX="left">0%</Text>
                </Float>
            </group>

            {/* Floating Level Indicator */}
            <group position={[0, (fuelLevel / 100) * 3 - 1.5, 0]}>
                <mesh position={[0, 0, radius * 1.1]}>
                    <sphereGeometry args={[0.04]} />
                    <meshStandardMaterial color="white" emissive="white" emissiveIntensity={2} />
                </mesh>
            </group>
        </group>
    );
};
