import React, { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera, Environment } from '@react-three/drei';
import { TankModel } from './TankModel';
import './TankViewer.css';

interface TankViewerProps {
    fuelLevel: number;
    fuelType: string;
    capacity: number;
    tankName: string;
    shape?: 'cylinder' | 'rectangular' | 'capsule';
    height?: number;
    diameter?: number;
    length?: number;
}

export const TankViewer: React.FC<TankViewerProps> = ({
    fuelLevel,
    fuelType,
    capacity,
    tankName,
    shape,
    height,
    diameter,
    length
}) => {
    return (
        <div className="tank-viewer-container">
            <div className="tank-viewer-overlay">
                <h3>{tankName}</h3>
                <p className="text-secondary">{fuelLevel}% Full</p>
            </div>

            <Canvas>
                <PerspectiveCamera makeDefault position={[4, 2, 4]} fov={50} />
                <OrbitControls
                    enablePan={false}
                    minDistance={3}
                    maxDistance={10}
                    maxPolarAngle={Math.PI / 2}
                />

                <ambientLight intensity={0.7} />
                <pointLight position={[10, 10, 10]} intensity={1.2} />
                <spotLight position={[-10, 10, 10]} angle={0.15} penumbra={1} intensity={0.8} />

                <Suspense fallback={null}>
                    <TankModel
                        fuelLevel={fuelLevel}
                        fuelType={fuelType}
                        capacity={capacity}
                        shape={shape}
                        height={height}
                        diameter={diameter}
                        length={length}
                    />
                    <Environment preset="city" />
                    {/* Shadow disabled for stability */}
                </Suspense>
            </Canvas>

            <div className="tank-viewer-controls">
                <div className="control-hint">Left-click to rotate • Scroll to zoom</div>
            </div>
        </div>
    );
};
