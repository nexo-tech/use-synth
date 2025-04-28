import { useState, useEffect } from "react";

interface KnobProps {
    value: number;
    min: number;
    max: number;
    step?: number;
    label: string;
    onChange: (value: number) => void;
    size?: 'sm' | 'md' | 'lg';
    formatLabel?: (value: number) => string;
}

export const Knob: React.FC<KnobProps> = ({
    value,
    min,
    max,
    step = 1,
    label,
    onChange,
    size = 'md',
    formatLabel,
}) => {
    const [isDragging, setIsDragging] = useState(false);
    const [startY, setStartY] = useState(0);
    const [startValue, setStartValue] = useState(value);

    // Calculate rotation angle based on value
    const range = max - min;
    const percentage = (value - min) / range;
    const degrees = percentage * 270 - 135; // -135 to +135 degrees

    const handleMouseDown = (e: React.MouseEvent) => {
        e.preventDefault();
        setIsDragging(true);
        setStartY(e.clientY);
        setStartValue(value);
    };

    const handleMouseMove = (e: MouseEvent) => {
        if (!isDragging) return;

        const deltaY = startY - e.clientY;
        const sensitivityFactor = 0.5;
        const newValue = Math.min(
            max,
            Math.max(min, startValue + deltaY * sensitivityFactor * (range / 100))
        );

        onChange(parseFloat(newValue.toFixed(step < 1 ? 2 : 0)));
    };

    const handleMouseUp = () => {
        setIsDragging(false);
    };

    useEffect(() => {
        if (isDragging) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
            return () => {
                document.removeEventListener('mousemove', handleMouseMove);
                document.removeEventListener('mouseup', handleMouseUp);
            };
        }
    }, [isDragging, startY, startValue]);

    // Size classes
    const sizeClasses = {
        sm: 'w-8 h-8 text-xs',
        md: 'w-10 h-10 text-sm',
        lg: 'w-12 h-12 text-base',
    };

    return (
        <div className="flex flex-col items-center">
            <div
                className={`relative ${sizeClasses[size]} rounded-full bg-gray-800 border-2 border-gray-700 shadow-lg cursor-pointer select-none ${isDragging ? 'ring-2 ring-blue-500' : ''
                    }`}
                onMouseDown={handleMouseDown}
            >
                <div
                    className="absolute w-1 h-3 bg-white rounded-full top-1 left-1/2 transform -translate-x-1/2 origin-bottom"
                    style={{ transform: `translateX(-50%) rotate(${degrees}deg)` }}
                />
                <div className="absolute inset-0 rounded-full border-2 border-transparent hover:border-blue-500 transition-colors" />
            </div>
            <div className="mt-0.5 text-center font-quantico">
                <div className="text-[10px] font-bold">{label}</div>
                <div className="text-[8px] text-gray-400">
                    {formatLabel ? formatLabel(value) : value.toFixed(step < 1 ? 2 : 0)}
                </div>
            </div>
        </div>
    );
};
