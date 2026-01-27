import React, { useMemo } from 'react';
import { View, StyleSheet } from 'react-native';
import Svg, { Rect } from 'react-native-svg';

interface QRCodeDisplayProps {
  data: string;
  size?: number;
  backgroundColor?: string;
  foregroundColor?: string;
}

export default function QRCodeDisplay({
  data,
  size = 160,
  backgroundColor = '#FFFFFF',
  foregroundColor = '#000000',
}: QRCodeDisplayProps) {
  const pattern = useMemo(() => {
    const hash = data.split('').reduce((acc, char, i) => {
      return acc + char.charCodeAt(0) * (i + 1);
    }, 0);

    const gridSize = 21;
    const cells: boolean[][] = [];

    for (let y = 0; y < gridSize; y++) {
      cells[y] = [];
      for (let x = 0; x < gridSize; x++) {
        const isPositionMarker =
          (x < 7 && y < 7) ||
          (x >= gridSize - 7 && y < 7) ||
          (x < 7 && y >= gridSize - 7);

        const isPositionMarkerBorder =
          isPositionMarker &&
          (x === 0 || x === 6 || y === 0 || y === 6 ||
           x === gridSize - 7 || x === gridSize - 1 ||
           y === gridSize - 7 || y === gridSize - 1);

        const isPositionMarkerInner =
          isPositionMarker &&
          ((x >= 2 && x <= 4 && y >= 2 && y <= 4) ||
           (x >= gridSize - 5 && x <= gridSize - 3 && y >= 2 && y <= 4) ||
           (x >= 2 && x <= 4 && y >= gridSize - 5 && y <= gridSize - 3));

        if (isPositionMarkerBorder || isPositionMarkerInner) {
          cells[y][x] = true;
        } else if (isPositionMarker) {
          cells[y][x] = false;
        } else {
          const seed = (hash + x * 31 + y * 17) % 100;
          cells[y][x] = seed > 45;
        }
      }
    }

    return cells;
  }, [data]);

  const cellSize = size / 21;
  const padding = cellSize * 2;
  const totalSize = size + padding * 2;

  return (
    <View style={[styles.container, { width: totalSize, height: totalSize }]}>
      <Svg width={totalSize} height={totalSize}>
        <Rect
          x={0}
          y={0}
          width={totalSize}
          height={totalSize}
          fill={backgroundColor}
          rx={8}
        />
        {pattern.map((row, y) =>
          row.map((cell, x) =>
            cell ? (
              <Rect
                key={`${x}-${y}`}
                x={padding + x * cellSize}
                y={padding + y * cellSize}
                width={cellSize}
                height={cellSize}
                fill={foregroundColor}
              />
            ) : null
          )
        )}
      </Svg>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
});
