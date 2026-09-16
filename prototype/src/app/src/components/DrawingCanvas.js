import React, { forwardRef, useImperativeHandle, useRef, useState } from "react";
import { View, PanResponder, StyleSheet } from "react-native";
import Svg, { Path } from "react-native-svg";
import { colors } from "../lib/theme";

// A freehand sketch canvas that works in plain Expo Go: react-native-svg + PanResponder,
// no custom dev client required. Exports the sketch as a base64 PNG on demand.
const DrawingCanvas = forwardRef(function DrawingCanvas(_props, ref) {
  const [paths, setPaths] = useState([]);
  const [currentPath, setCurrentPath] = useState("");
  const [size, setSize] = useState({ width: 0, height: 0 });
  const svgRef = useRef(null);

  const panResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: () => true,
      onPanResponderGrant: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath(`M${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderMove: (evt) => {
        const { locationX, locationY } = evt.nativeEvent;
        setCurrentPath((prev) => `${prev} L${locationX.toFixed(1)},${locationY.toFixed(1)}`);
      },
      onPanResponderRelease: () => {
        setCurrentPath((prev) => {
          if (prev) setPaths((p) => [...p, prev]);
          return "";
        });
      },
    })
  ).current;

  useImperativeHandle(ref, () => ({
    isEmpty: () => paths.length === 0,
    clear: () => {
      setPaths([]);
      setCurrentPath("");
    },
    exportPng: () =>
      new Promise((resolve, reject) => {
        if (!svgRef.current) return reject(new Error("Canvas not ready."));
        if (typeof svgRef.current.toDataURL !== "function") {
          return reject(new Error("Drawing export isn't supported in this preview — test on a phone via Expo Go."));
        }
        svgRef.current.toDataURL((base64) => {
          if (!base64) return reject(new Error("Could not export drawing."));
          resolve(`data:image/png;base64,${base64}`);
        });
      }),
  }));

  return (
    <View
      style={styles.wrap}
      onLayout={(e) => setSize(e.nativeEvent.layout)}
      {...panResponder.panHandlers}
    >
      {size.width > 0 && (
        <Svg
          ref={svgRef}
          width={size.width}
          height={size.height}
          viewBox={`0 0 ${size.width} ${size.height}`}
        >
          {paths.map((d, i) => (
            <Path key={i} d={d} stroke="#1c2038" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ))}
          {currentPath ? (
            <Path d={currentPath} stroke="#1c2038" strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          ) : null}
        </Svg>
      )}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: {
    height: 260,
    borderRadius: 12,
    backgroundColor: "#f5f6fb",
    borderWidth: 1,
    borderColor: colors.border,
    overflow: "hidden",
  },
});

export default DrawingCanvas;
